import type { Server, Socket } from 'socket.io';
import { SocketEvents, type JoinRoomPayload, type SignalPayload } from './events.js';
import { roomService } from './roomService.js';

type Meta = { roomId?: string; userId?: string };
const metaMap = new WeakMap<Socket, Meta>();

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    socket.on(SocketEvents.JOIN_ROOM, (payload: JoinRoomPayload, ack?: (users: unknown) => void) => {
      if (!payload?.roomId || !payload?.userId) return;
      socket.join(payload.roomId);
      metaMap.set(socket, { roomId: payload.roomId, userId: payload.userId });
      const user = roomService.joinRoom(socket.id, payload);
      const users = roomService.getRoomUsers(payload.roomId);
      socket.to(payload.roomId).emit(SocketEvents.USER_JOINED, user);
      socket.emit(SocketEvents.ROOM_USERS, users);
      ack?.(users);
    });

    socket.on(SocketEvents.LEAVE_ROOM, (payload: { roomId: string; userId: string }) => {
      if (!payload?.roomId || !payload?.userId) return;
      roomService.leaveRoom(payload.roomId, payload.userId);
      socket.leave(payload.roomId);
      socket.to(payload.roomId).emit(SocketEvents.USER_LEFT, payload);
    });

    socket.on(SocketEvents.AUDIO_OFFER, (payload: SignalPayload) => {
      const target = roomService.findByUserId(payload.roomId, payload.targetUserId);
      if (!target) return;
      io.to(target.socketId).emit(SocketEvents.AUDIO_OFFER, payload);
    });

    socket.on(SocketEvents.AUDIO_ANSWER, (payload: SignalPayload) => {
      const target = roomService.findByUserId(payload.roomId, payload.targetUserId);
      if (!target) return;
      io.to(target.socketId).emit(SocketEvents.AUDIO_ANSWER, payload);
    });

    socket.on(SocketEvents.NEW_ICE_CANDIDATE, (payload: SignalPayload) => {
      const target = roomService.findByUserId(payload.roomId, payload.targetUserId);
      if (!target) return;
      io.to(target.socketId).emit(SocketEvents.NEW_ICE_CANDIDATE, payload);
    });

    socket.on(
      SocketEvents.MUTE_CHANGED,
      (payload: { roomId: string; userId: string; muted: boolean }) => {
        roomService.setMuted(payload.roomId, payload.userId, payload.muted);
        socket.to(payload.roomId).emit(SocketEvents.MUTE_CHANGED, payload);
      },
    );

    socket.on(
      SocketEvents.SEND_MESSAGE,
      (payload: { roomId: string; userId: string; userName: string; body: string }) => {
        const message = {
          ...payload,
          id: `${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        io.to(payload.roomId).emit(SocketEvents.RECEIVE_MESSAGE, message);
      },
    );

    socket.on('disconnect', () => {
      const meta = metaMap.get(socket);
      if (!meta?.roomId || !meta?.userId) return;
      roomService.leaveRoom(meta.roomId, meta.userId);
      socket.to(meta.roomId).emit(SocketEvents.USER_LEFT, {
        userId: meta.userId,
        roomId: meta.roomId,
      });
    });
  });
}
