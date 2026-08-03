import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { dataService } from '../services/dataService.js';
import { SocketEvents } from '../sockets/events.js';
import { getIo } from '../sockets/ioRegistry.js';
import { roomService } from '../sockets/roomService.js';

export const apiRouter = Router();

apiRouter.use(requireAuth);

apiRouter.get('/me', async (req, res) => {
  const profile = await dataService.getProfile(req.user!.id);
  if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
  return res.json({ data: profile });
});

apiRouter.get('/ice', async (_req, res) => {
  return res.json({ data: { iceServers: env.iceServers() } });
});

apiRouter.get('/stats', async (req, res) => {
  const meetings = await dataService.listMeetingsForUser(req.user!.id);
  const today = new Date().toISOString().slice(0, 10);
  const meetingsToday = meetings.filter((m) => m.created_at.startsWith(today) || m.status === 'live').length;
  const peopleOnline = await dataService.listOnlineCount();
  return res.json({
    data: {
      meetings_today: meetingsToday || meetings.length,
      people_online: peopleOnline,
      call_quality: 4.9,
    },
  });
});

apiRouter.get('/meetings', async (req, res) => {
  const meetings = await dataService.listMeetingsForUser(req.user!.id);
  return res.json({ data: meetings });
});

apiRouter.post('/meetings/join-by-code', async (req, res) => {
  const schema = z.object({ room_code: z.string().min(3) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Código de sala inválido' });
  try {
    const found = await dataService.findMeetingByRoomCode(parsed.data.room_code.trim());
    if (!found) return res.status(404).json({ error: 'Sala no encontrada' });
    if (found.is_locked && found.created_by !== req.user!.id) {
      return res.status(403).json({ error: 'La reunión está bloqueada' });
    }
    const full = await dataService.joinMeeting(found.id, req.user!.id);
    if (!full) return res.status(404).json({ error: 'Reunión no encontrada' });
    return res.json({ data: full });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'No se pudo unir' });
  }
});

apiRouter.get('/meetings/:id', async (req, res) => {
  const meeting = await dataService.getMeeting(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Reunión no encontrada' });
  return res.json({ data: meeting });
});

apiRouter.post('/meetings', async (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    tone: z.enum(['pink', 'blue', 'green', 'yellow']).default('pink'),
    icon_type: z.enum(['group', 'briefcase', 'document', 'calendar']).default('group'),
    waiting_room_enabled: z.boolean().optional().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos de reunión inválidos' });
  try {
    const meeting = await dataService.createMeeting({
      ...parsed.data,
      created_by: req.user!.id,
    });
    return res.status(201).json({ data: meeting });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'No se pudo crear' });
  }
});

apiRouter.patch('/meetings/:id', async (req, res) => {
  const schema = z.object({
    waiting_room_enabled: z.boolean().optional(),
    is_locked: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos' });
  try {
    const updated = await dataService.updateMeetingSettings(req.params.id, req.user!.id, parsed.data);
    if (!updated) return res.status(404).json({ error: 'Reunión no encontrada' });
    return res.json({ data: updated });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'No se pudo actualizar' });
  }
});

apiRouter.post('/meetings/:id/join', async (req, res) => {
  try {
    const meeting = await dataService.getMeeting(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Reunión no encontrada' });
    if (meeting.status === 'ended' || meeting.status === 'cancelled') {
      return res.status(410).json({ error: 'Esta reunión ya finalizó' });
    }
    if (meeting.is_locked && meeting.created_by !== req.user!.id) {
      return res.status(403).json({ error: 'La reunión está bloqueada' });
    }
    if (meeting.waiting_room_enabled && meeting.created_by !== req.user!.id) {
      const lobby = await dataService.requestLobby(req.params.id, req.user!.id);
      return res.json({ data: { ...meeting, lobby_status: lobby.status, waiting: lobby.status === 'waiting' } });
    }
    const full = await dataService.joinMeeting(req.params.id, req.user!.id);
    if (!full) return res.status(404).json({ error: 'Reunión no encontrada' });
    return res.json({ data: full });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'No se pudo unir' });
  }
});

apiRouter.post('/meetings/:id/lobby/admit', async (req, res) => {
  const targetUserId = req.body?.user_id as string | undefined;
  if (!targetUserId) return res.status(400).json({ error: 'Falta user_id' });
  try {
    const result = await dataService.resolveLobby(req.params.id, req.user!.id, targetUserId, 'admitted');
    if (!result) return res.status(404).json({ error: 'Solicitud no encontrada' });
    const full = await dataService.joinMeeting(req.params.id, targetUserId);
    return res.json({ data: full });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'No se pudo admitir' });
  }
});

apiRouter.post('/meetings/:id/lobby/reject', async (req, res) => {
  const targetUserId = req.body?.user_id as string | undefined;
  if (!targetUserId) return res.status(400).json({ error: 'Falta user_id' });
  try {
    const result = await dataService.resolveLobby(req.params.id, req.user!.id, targetUserId, 'rejected');
    if (!result) return res.status(404).json({ error: 'Solicitud no encontrada' });
    return res.json({ data: result });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'No se pudo rechazar' });
  }
});

apiRouter.get('/meetings/:id/chat', async (req, res) => {
  try {
    const chat = await dataService.getChatByMeeting(req.params.id, req.user!.id);
    if (!chat) return res.status(404).json({ error: 'Reunión no encontrada' });
    return res.json({ data: chat });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Chat no disponible' });
  }
});

apiRouter.get('/banners', async (_req, res) => {
  const banners = await dataService.listBanners();
  return res.json({ data: banners });
});

apiRouter.post('/meetings/:id/end', async (req, res) => {
  try {
    const existing = await dataService.getMeeting(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Reunión no encontrada' });
    if (existing.created_by && existing.created_by !== req.user!.id) {
      const isHost = roomService.isHost(existing.room_code, req.user!.id);
      if (!isHost) {
        return res.status(403).json({ error: 'Solo el anfitrión puede finalizar la reunión' });
      }
    }
    const meeting = await dataService.endMeeting(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Reunión no encontrada' });
    const roomId = meeting.room_code || existing.room_code;
    const io = getIo();
    if (io && roomId) {
      io.to(roomId).emit(SocketEvents.MEETING_ENDED, {
        meetingId: meeting.id,
        roomId,
        endedBy: req.user!.id,
      });
      roomService.clearRoom(roomId);
    }
    return res.json({ data: meeting });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'No se pudo finalizar' });
  }
});

apiRouter.get('/chats', async (req, res) => {
  const threads = await dataService.listThreads(req.user!.id);
  return res.json({ data: threads });
});

apiRouter.get('/chats/:id/messages', async (req, res) => {
  const messages = await dataService.listMessages(req.params.id);
  return res.json({ data: messages });
});

apiRouter.post('/chats/:id/messages', async (req, res) => {
  const schema = z.object({
    body: z.string().min(1),
    reply_to_id: z.string().uuid().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Mensaje inválido' });
  try {
    const message = await dataService.sendMessage(
      req.params.id,
      req.user!.id,
      parsed.data.body,
      parsed.data.reply_to_id,
    );
    return res.status(201).json({ data: message });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'No se pudo enviar' });
  }
});

apiRouter.patch('/chats/:threadId/messages/:messageId', async (req, res) => {
  const body = typeof req.body?.body === 'string' ? req.body.body : '';
  if (!body.trim()) return res.status(400).json({ error: 'Mensaje vacío' });
  try {
    const message = await dataService.editMessage(req.params.messageId, req.user!.id, body.trim());
    if (!message) return res.status(404).json({ error: 'Mensaje no encontrado' });
    return res.json({ data: message });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'No se pudo editar' });
  }
});

apiRouter.delete('/chats/:threadId/messages/:messageId', async (req, res) => {
  try {
    const ok = await dataService.deleteMessage(req.params.messageId, req.user!.id);
    if (!ok) return res.status(404).json({ error: 'Mensaje no encontrado' });
    return res.json({ data: { ok: true } });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'No se pudo eliminar' });
  }
});

apiRouter.post('/chats/:threadId/messages/:messageId/read', async (req, res) => {
  try {
    await dataService.markMessageRead(req.params.messageId, req.user!.id);
    return res.json({ data: { ok: true } });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Error' });
  }
});

apiRouter.get('/notifications', async (req, res) => {
  const list = await dataService.listNotifications(req.user!.id);
  return res.json({ data: list });
});

apiRouter.post('/notifications/read', async (req, res) => {
  const id = typeof req.body?.id === 'string' ? req.body.id : undefined;
  await dataService.markNotificationsRead(req.user!.id, id);
  return res.json({ data: { ok: true } });
});
