import type { RoomUser, JoinRoomPayload } from './events.js';

const rooms = new Map<string, Map<string, RoomUser>>();
const hosts = new Map<string, string>(); // roomId -> hostUserId
const locked = new Map<string, boolean>();

export const roomService = {
  joinRoom(socketId: string, payload: JoinRoomPayload): RoomUser {
    if (!rooms.has(payload.roomId)) rooms.set(payload.roomId, new Map());
    const users = rooms.get(payload.roomId)!;
    const isFirst = users.size === 0;
    const role = payload.asHost || isFirst ? 'host' : 'participant';
    if (role === 'host') hosts.set(payload.roomId, payload.userId);
    const user: RoomUser = {
      socketId,
      userId: payload.userId,
      userName: payload.userName,
      avatarUrl: payload.avatarUrl,
      muted: false,
      handRaised: false,
      cameraOn: false,
      role,
      connectionState: 'connected',
      joinedAt: new Date().toISOString(),
    };
    users.set(payload.userId, user);
    return user;
  },

  leaveRoom(roomId: string, userId: string) {
    const users = rooms.get(roomId);
    if (!users) return false;
    const removed = users.delete(userId);
    if (hosts.get(roomId) === userId) {
      const next = users.values().next().value as RoomUser | undefined;
      if (next) {
        next.role = 'host';
        hosts.set(roomId, next.userId);
      } else {
        hosts.delete(roomId);
      }
    }
    if (users.size === 0) {
      rooms.delete(roomId);
      locked.delete(roomId);
    }
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

  setHand(roomId: string, userId: string, raised: boolean) {
    const user = rooms.get(roomId)?.get(userId);
    if (!user) return null;
    user.handRaised = raised;
    return user;
  },

  setCamera(roomId: string, userId: string, cameraOn: boolean) {
    const user = rooms.get(roomId)?.get(userId);
    if (!user) return null;
    user.cameraOn = cameraOn;
    return user;
  },

  setSpeaking(roomId: string, userId: string, speaking: boolean) {
    const user = rooms.get(roomId)?.get(userId);
    if (!user) return null;
    user.speaking = speaking;
    return user;
  },

  setQuality(roomId: string, userId: string, quality: string) {
    const user = rooms.get(roomId)?.get(userId);
    if (!user) return null;
    user.quality = quality;
    return user;
  },

  setRole(roomId: string, userId: string, role: RoomUser['role']) {
    const user = rooms.get(roomId)?.get(userId);
    if (!user) return null;
    user.role = role;
    if (role === 'host') hosts.set(roomId, userId);
    return user;
  },

  setConnectionState(
    roomId: string,
    userId: string,
    connectionState: NonNullable<RoomUser['connectionState']>,
  ) {
    const user = rooms.get(roomId)?.get(userId);
    if (!user) return null;
    user.connectionState = connectionState;
    return user;
  },

  isHost(roomId: string, userId: string) {
    return hosts.get(roomId) === userId;
  },

  getHost(roomId: string) {
    return hosts.get(roomId);
  },

  setLocked(roomId: string, value: boolean) {
    locked.set(roomId, value);
  },

  isLocked(roomId: string) {
    return locked.get(roomId) === true;
  },

  clearRoom(roomId: string) {
    rooms.delete(roomId);
    hosts.delete(roomId);
    locked.delete(roomId);
  },
};
