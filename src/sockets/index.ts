import type { Server, Socket } from 'socket.io';
import { SocketEvents, type JoinRoomPayload, type SignalPayload } from './events.js';
import { roomService } from './roomService.js';

type Meta = { roomId?: string; userId?: string };
const metaMap = new WeakMap<Socket, Meta>();

function requireHost(roomId: string, userId: string) {
  return roomService.isHost(roomId, userId);
}

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    socket.on(SocketEvents.JOIN_ROOM, (payload: JoinRoomPayload, ack?: (users: unknown) => void) => {
      if (!payload?.roomId || !payload?.userId) return;
      if (roomService.isLocked(payload.roomId) && !payload.asHost) {
        socket.emit(SocketEvents.MEETING_LOCKED, { roomId: payload.roomId });
        return;
      }
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
      const hostId = roomService.getHost(payload.roomId);
      if (hostId) {
        socket.to(payload.roomId).emit(SocketEvents.HOST_CHANGED, {
          roomId: payload.roomId,
          hostUserId: hostId,
        });
      }
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
      SocketEvents.CAMERA_CHANGED,
      (payload: { roomId: string; userId: string; cameraOn: boolean }) => {
        roomService.setCamera(payload.roomId, payload.userId, payload.cameraOn);
        socket.to(payload.roomId).emit(SocketEvents.CAMERA_CHANGED, payload);
      },
    );

    socket.on(
      SocketEvents.HOST_MUTE,
      (payload: { roomId: string; hostUserId: string; targetUserId: string }) => {
        if (!requireHost(payload.roomId, payload.hostUserId)) return;
        roomService.setMuted(payload.roomId, payload.targetUserId, true);
        io.to(payload.roomId).emit(SocketEvents.HOST_MUTE, payload);
        io.to(payload.roomId).emit(SocketEvents.MUTE_CHANGED, {
          roomId: payload.roomId,
          userId: payload.targetUserId,
          muted: true,
        });
      },
    );

    socket.on(
      SocketEvents.HOST_UNMUTE,
      (payload: { roomId: string; hostUserId: string; targetUserId: string }) => {
        if (!requireHost(payload.roomId, payload.hostUserId)) return;
        roomService.setMuted(payload.roomId, payload.targetUserId, false);
        io.to(payload.roomId).emit(SocketEvents.HOST_UNMUTE, payload);
        io.to(payload.roomId).emit(SocketEvents.MUTE_CHANGED, {
          roomId: payload.roomId,
          userId: payload.targetUserId,
          muted: false,
        });
      },
    );

    socket.on(
      SocketEvents.KICK,
      (payload: { roomId: string; hostUserId: string; targetUserId: string }) => {
        if (!requireHost(payload.roomId, payload.hostUserId)) return;
        const target = roomService.findByUserId(payload.roomId, payload.targetUserId);
        roomService.leaveRoom(payload.roomId, payload.targetUserId);
        if (target) {
          io.to(target.socketId).emit(SocketEvents.KICKED, payload);
          io.to(target.socketId).socketsLeave(payload.roomId);
        }
        io.to(payload.roomId).emit(SocketEvents.USER_LEFT, {
          roomId: payload.roomId,
          userId: payload.targetUserId,
        });
      },
    );

    socket.on(
      SocketEvents.TRANSFER_HOST,
      (payload: { roomId: string; hostUserId: string; targetUserId: string }) => {
        if (!requireHost(payload.roomId, payload.hostUserId)) return;
        roomService.setRole(payload.roomId, payload.hostUserId, 'participant');
        roomService.setRole(payload.roomId, payload.targetUserId, 'host');
        io.to(payload.roomId).emit(SocketEvents.HOST_CHANGED, {
          roomId: payload.roomId,
          hostUserId: payload.targetUserId,
        });
        io.to(payload.roomId).emit(SocketEvents.ROOM_USERS, roomService.getRoomUsers(payload.roomId));
      },
    );

    socket.on(
      SocketEvents.LOCK_MEETING,
      (payload: { roomId: string; hostUserId: string }) => {
        if (!requireHost(payload.roomId, payload.hostUserId)) return;
        roomService.setLocked(payload.roomId, true);
        io.to(payload.roomId).emit(SocketEvents.LOCK_MEETING, payload);
      },
    );

    socket.on(
      SocketEvents.UNLOCK_MEETING,
      (payload: { roomId: string; hostUserId: string }) => {
        if (!requireHost(payload.roomId, payload.hostUserId)) return;
        roomService.setLocked(payload.roomId, false);
        io.to(payload.roomId).emit(SocketEvents.UNLOCK_MEETING, payload);
      },
    );

    socket.on(
      SocketEvents.RAISE_HAND,
      (payload: { roomId: string; userId: string }) => {
        roomService.setHand(payload.roomId, payload.userId, true);
        io.to(payload.roomId).emit(SocketEvents.HAND_CHANGED, {
          ...payload,
          raised: true,
        });
      },
    );

    socket.on(
      SocketEvents.LOWER_HAND,
      (payload: { roomId: string; userId: string }) => {
        roomService.setHand(payload.roomId, payload.userId, false);
        io.to(payload.roomId).emit(SocketEvents.HAND_CHANGED, {
          ...payload,
          raised: false,
        });
      },
    );

    socket.on(
      SocketEvents.LOBBY_REQUEST,
      (payload: {
        roomId: string;
        userId: string;
        userName: string;
        avatarUrl?: string;
      }) => {
        socket.join(`lobby:${payload.roomId}`);
        io.to(payload.roomId).emit(SocketEvents.LOBBY_REQUEST, payload);
        socket.emit(SocketEvents.WAITING, payload);
      },
    );

    socket.on(
      SocketEvents.ADMIT,
      (payload: { roomId: string; hostUserId: string; targetUserId: string }) => {
        if (!requireHost(payload.roomId, payload.hostUserId)) return;
        io.to(`lobby:${payload.roomId}`).emit(SocketEvents.ADMITTED, payload);
        io.to(payload.roomId).emit(SocketEvents.LOBBY_UPDATE, {
          ...payload,
          status: 'admitted',
        });
      },
    );

    socket.on(
      SocketEvents.REJECT,
      (payload: { roomId: string; hostUserId: string; targetUserId: string }) => {
        if (!requireHost(payload.roomId, payload.hostUserId)) return;
        io.to(`lobby:${payload.roomId}`).emit(SocketEvents.REJECTED, payload);
        io.to(payload.roomId).emit(SocketEvents.LOBBY_UPDATE, {
          ...payload,
          status: 'rejected',
        });
      },
    );

    socket.on(
      SocketEvents.SEND_MESSAGE,
      (payload: {
        roomId: string;
        userId: string;
        userName: string;
        body: string;
        id?: string;
        replyToId?: string;
      }) => {
        const message = {
          ...payload,
          id: payload.id ?? `${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        io.to(payload.roomId).emit(SocketEvents.RECEIVE_MESSAGE, message);
      },
    );

    socket.on(
      SocketEvents.TYPING,
      (payload: { roomId: string; userId: string; userName: string; typing: boolean }) => {
        socket.to(payload.roomId).emit(SocketEvents.TYPING, payload);
      },
    );

    socket.on(
      SocketEvents.MESSAGE_UPDATED,
      (payload: { roomId: string; id: string; body: string; editedAt: string }) => {
        io.to(payload.roomId).emit(SocketEvents.MESSAGE_UPDATED, payload);
      },
    );

    socket.on(
      SocketEvents.MESSAGE_DELETED,
      (payload: { roomId: string; id: string }) => {
        io.to(payload.roomId).emit(SocketEvents.MESSAGE_DELETED, payload);
      },
    );

    socket.on(
      SocketEvents.READ_RECEIPT,
      (payload: { roomId: string; messageId: string; userId: string }) => {
        socket.to(payload.roomId).emit(SocketEvents.READ_RECEIPT, payload);
      },
    );

    socket.on(
      SocketEvents.CONNECTION_STATE,
      (payload: {
        roomId: string;
        userId: string;
        connectionState: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
        quality?: string;
      }) => {
        roomService.setConnectionState(payload.roomId, payload.userId, payload.connectionState);
        if (payload.quality) {
          roomService.setQuality(payload.roomId, payload.userId, payload.quality);
        }
        socket.to(payload.roomId).emit(SocketEvents.CONNECTION_STATE, payload);
      },
    );

    socket.on(
      SocketEvents.SPEAKING,
      (payload: { roomId: string; userId: string; speaking: boolean }) => {
        roomService.setSpeaking(payload.roomId, payload.userId, payload.speaking);
        socket.to(payload.roomId).emit(SocketEvents.SPEAKING, payload);
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
