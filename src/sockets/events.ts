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
  SEND_MESSAGE: 'send-message',
  RECEIVE_MESSAGE: 'receive-message',
} as const;

export type RoomUser = {
  socketId: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  muted?: boolean;
  joinedAt: string;
};

export type JoinRoomPayload = {
  roomId: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
};

export type SignalPayload = {
  roomId: string;
  targetUserId: string;
  fromUserId: string;
  sdp?: unknown;
  candidate?: unknown;
};
