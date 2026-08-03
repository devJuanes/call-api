import { randomUUID } from 'node:crypto';
import { nowIso, roomCode } from '../lib/matudb.js';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  first_name: string;
  avatar_url: string | null;
  title: string;
  bio: string;
  status: 'online' | 'away' | 'offline';
  created_at: string;
  updated_at: string;
};

export type Meeting = {
  id: string;
  title: string;
  room_code: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  tone: 'pink' | 'blue' | 'green' | 'yellow';
  icon_type: 'group' | 'briefcase' | 'document' | 'calendar';
  agenda: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_by: string | null;
  waiting_room_enabled: boolean;
  is_locked: boolean;
  invite_url: string | null;
  created_at: string;
  updated_at: string;
};

export type MeetingParticipant = {
  id: string;
  meeting_id: string;
  user_id: string;
  role: 'host' | 'participant';
  joined_at: string | null;
  left_at: string | null;
};

export type ChatThread = {
  id: string;
  title: string;
  avatar_url: string | null;
  meeting_id: string | null;
  updated_at: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  reply_to_id?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  read_by?: string[];
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'meeting' | 'call' | 'message' | 'system';
  is_read: boolean;
  created_at: string;
};

type Session = {
  access_token: string;
  user_id: string;
  expires_at: string;
};

const profiles = new Map<string, Profile>();
const sessions = new Map<string, Session>();
const meetings = new Map<string, Meeting>();
const participants = new Map<string, MeetingParticipant>();
const threads = new Map<string, ChatThread>();
const threadMembers = new Map<string, Set<string>>();
const messages = new Map<string, ChatMessage[]>();
const notifications = new Map<string, Notification[]>();
const passwords = new Map<string, string>(); // email -> password (demo only)

function seed() {
  if (profiles.size > 0) return;

  const emmaId = randomUUID();
  const alexId = randomUUID();
  const oliviaId = randomUUID();
  const jamesId = randomUUID();

  const makeProfile = (
    id: string,
    email: string,
    fullName: string,
    first: string,
    avatar: string,
  ): Profile => ({
    id,
    email,
    full_name: fullName,
    first_name: first,
    avatar_url: avatar,
    title: 'Product Designer',
    bio: 'Building warm conversations with MatuCall.',
    status: 'online',
    created_at: nowIso(),
    updated_at: nowIso(),
  });

  profiles.set(
    emmaId,
    makeProfile(
      emmaId,
      'emma@matucall.app',
      'Emma Wilson',
      'Emma',
      'https://i.pravatar.cc/400?img=1',
    ),
  );
  profiles.set(
    alexId,
    makeProfile(
      alexId,
      'alex@matucall.app',
      'Mr. Alex',
      'Alex',
      'https://i.pravatar.cc/400?img=12',
    ),
  );
  profiles.set(
    oliviaId,
    makeProfile(
      oliviaId,
      'olivia@matucall.app',
      'Olivia Martinez',
      'Olivia',
      'https://i.pravatar.cc/400?img=5',
    ),
  );
  profiles.set(
    jamesId,
    makeProfile(
      jamesId,
      'james@matucall.app',
      'James Carter',
      'James',
      'https://i.pravatar.cc/400?img=8',
    ),
  );

  passwords.set('emma@matucall.app', 'matucall123');
  passwords.set('alex@matucall.app', 'matucall123');
  passwords.set('olivia@matucall.app', 'matucall123');
  passwords.set('james@matucall.app', 'matucall123');

  const meetingId = randomUUID();
  const meeting: Meeting = {
    id: meetingId,
    title: 'Team Sync',
    room_code: roomCode(),
    status: 'live',
    tone: 'pink',
    icon_type: 'group',
    agenda: 'Daily voice sync',
    started_at: nowIso(),
    ended_at: null,
    created_by: emmaId,
    waiting_room_enabled: false,
    is_locked: false,
    invite_url: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  meetings.set(meetingId, meeting);

  for (const [userId, role] of [
    [emmaId, 'host'],
    [alexId, 'participant'],
    [oliviaId, 'participant'],
    [jamesId, 'participant'],
  ] as const) {
    const p: MeetingParticipant = {
      id: randomUUID(),
      meeting_id: meetingId,
      user_id: userId,
      role,
      joined_at: nowIso(),
      left_at: null,
    };
    participants.set(p.id, p);
  }

  const threadId = randomUUID();
  threads.set(threadId, {
    id: threadId,
    title: 'Team Sync',
    avatar_url: 'https://i.pravatar.cc/200?img=12',
    meeting_id: meetingId,
    updated_at: nowIso(),
    created_at: nowIso(),
  });
  threadMembers.set(threadId, new Set([emmaId, alexId, oliviaId, jamesId]));
  messages.set(threadId, [
    {
      id: randomUUID(),
      thread_id: threadId,
      sender_id: alexId,
      body: 'Hey Emma, are you joining the voice call?',
      created_at: nowIso(),
    },
    {
      id: randomUUID(),
      thread_id: threadId,
      sender_id: emmaId,
      body: 'Yes! Starting in a minute.',
      created_at: nowIso(),
    },
  ]);

  notifications.set(emmaId, [
    {
      id: randomUUID(),
      user_id: emmaId,
      title: 'Team Sync is live',
      body: 'Join the voice room when you are ready.',
      type: 'meeting',
      is_read: false,
      created_at: nowIso(),
    },
  ]);
}

seed();

export const memoryStore = {
  profiles,
  sessions,
  meetings,
  participants,
  threads,
  threadMembers,
  messages,
  notifications,
  passwords,

  findProfileByEmail(email: string) {
    return [...profiles.values()].find((p) => p.email === email) ?? null;
  },

  createSession(userId: string): Session {
    const access_token = `demo_${randomUUID()}`;
    const session: Session = {
      access_token,
      user_id: userId,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    };
    sessions.set(access_token, session);
    return session;
  },

  getSession(token: string) {
    return sessions.get(token) ?? null;
  },
};
