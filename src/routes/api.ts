import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { dataService } from '../services/dataService.js';

export const apiRouter = Router();

apiRouter.use(requireAuth);

apiRouter.get('/me', async (req, res) => {
  const profile = await dataService.getProfile(req.user!.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  return res.json({ data: profile });
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

apiRouter.get('/meetings/:id', async (req, res) => {
  const meeting = await dataService.getMeeting(req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  return res.json({ data: meeting });
});

apiRouter.post('/meetings', async (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    tone: z.enum(['pink', 'blue', 'green', 'yellow']).default('pink'),
    icon_type: z.enum(['group', 'briefcase', 'document', 'calendar']).default('group'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const meeting = await dataService.createMeeting({
      ...parsed.data,
      created_by: req.user!.id,
    });
    return res.status(201).json({ data: meeting });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Create failed' });
  }
});

apiRouter.post('/meetings/:id/join', async (req, res) => {
  try {
    const meeting = await dataService.setMeetingLive(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    const full = await dataService.getMeeting(req.params.id);
    return res.json({ data: full });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Join failed' });
  }
});

apiRouter.post('/meetings/:id/end', async (req, res) => {
  try {
    const meeting = await dataService.endMeeting(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    return res.json({ data: meeting });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'End failed' });
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
  const schema = z.object({ body: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const message = await dataService.sendMessage(req.params.id, req.user!.id, parsed.data.body);
    return res.status(201).json({ data: message });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Send failed' });
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
