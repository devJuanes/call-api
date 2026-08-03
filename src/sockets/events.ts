export const SocketEvents = {
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  ROOM_USERS: 'room-users',
  AUDIO_OFFER: 'audio-offer',
  AUDIO_ANSWER: 'audio-answer',
  NEW_ICE_CANDIDATE: 'new-ice-candidate',
  MUTE_CHANGED: 'mute-changed',
  HOST_MUTE: 'host-mute',
  HOST_UNMUTE: 'host-unmute',
  KICK: 'kick',
  TRANSFER_HOST: 'transfer-host',
  LOCK_MEETING: 'lock-meeting',
  UNLOCK_MEETING: 'unlock-meeting',
  RAISE_HAND: 'raise-hand',
  LOWER_HAND: 'lower-hand',
  HAND_CHANGED: 'hand-changed',
  LOBBY_REQUEST: 'lobby-request',
  LOBBY_UPDATE: 'lobby-update',
  ADMIT: 'admit',
  REJECT: 'reject',
  WAITING: 'waiting',
  ADMITTED: 'admitted',
  REJECTED: 'rejected',
  KICKED: 'kicked',
  MEETING_LOCKED: 'meeting-locked',
  HOST_CHANGED: 'host-changed',
  SEND_MESSAGE: 'send-message',
  RECEIVE_MESSAGE: 'receive-message',
  MESSAGE_UPDATED: 'message-updated',
  MESSAGE_DELETED: 'message-deleted',
  TYPING: 'typing',
  READ_RECEIPT: 'read-receipt',
  CONNECTION_STATE: 'connection-state',
  SPEAKING: 'speaking',
} as const;

export type RoomUser = {
  socketId: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  muted?: boolean;
  handRaised?: boolean;
  role?: 'host' | 'cohost' | 'participant';
  connectionState?: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  joinedAt: string;
};

export type JoinRoomPayload = {
  roomId: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  meetingId?: string;
  asHost?: boolean;
};

export type SignalPayload = {
  roomId: string;
  targetUserId: string;
  fromUserId: string;
  sdp?: unknown;
  candidate?: unknown;
  trackKind?: 'audio' | 'video' | 'screen';
};
