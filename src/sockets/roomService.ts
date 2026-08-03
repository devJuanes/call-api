import type { RoomUser, JoinRoomPayload } from './events.js';

const rooms = new Map<string, Map<string, RoomUser>>();

export const roomService = {
  joinRoom(socketId: string, payload: JoinRoomPayload): RoomUser {
    if (!rooms.has(payload.roomId)) rooms.set(payload.roomId, new Map());
    const users = rooms.get(payload.roomId)!;
    const user: RoomUser = {
      socketId,
      userId: payload.userId,
      userName: payload.userName,
      avatarUrl: payload.avatarUrl,
      muted: false,
      joinedAt: new Date().toISOString(),
    };
    users.set(payload.userId, user);
    return user;
  },

  leaveRoom(roomId: string, userId: string) {
    const users = rooms.get(roomId);
    if (!users) return false;
    const removed = users.delete(userId);
    if (users.size === 0) rooms.delete(roomId);
    return removed;
  },

  getRoomUsers(roomId: string): RoomUser[] {
    return Array.from(rooms.get(roomId)?.values() ?? []);
  },

  findByUserId(roomId: string, userId: string) {
    return rooms.get(roomId)?.get(userId);
  },

  setMuted(roomId: string, userId: string, muted: boolean) {
    const user = rooms.get(roomId)?.get(userId);
    if (!user) return null;
    user.muted = muted;
    return user;
  },
};
