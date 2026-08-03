import { randomUUID } from 'node:crypto';
import { env } from '../config.js';
import { asArray, firstRow, getMatuDb, nowIso, roomCode, type DbRow } from '../lib/matudb.js';
import {
  memoryStore,
  type ChatMessage,
  type ChatThread,
  type Meeting,
  type MeetingParticipant,
  type Notification,
  type Profile,
} from '../store/memory.js';

function mapProfile(row: DbRow): Profile {
  return {
    id: String(row.id),
    email: String(row.email ?? ''),
    full_name: String(row.full_name ?? ''),
    first_name: String(row.first_name ?? ''),
    avatar_url: (row.avatar_url as string | null) ?? null,
    title: String(row.title ?? 'Member'),
    bio: String(row.bio ?? ''),
    status: (row.status as Profile['status']) ?? 'online',
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
  };
}

function mapMeeting(row: DbRow): Meeting {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    room_code: String(row.room_code ?? ''),
    status: (row.status as Meeting['status']) ?? 'scheduled',
    tone: (row.tone as Meeting['tone']) ?? 'pink',
    icon_type: (row.icon_type as Meeting['icon_type']) ?? 'group',
    agenda: (row.agenda as string | null) ?? null,
    started_at: (row.started_at as string | null) ?? null,
    ended_at: (row.ended_at as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
  };
}

export const dataService = {
  async upsertProfile(input: {
    id: string;
    email: string;
    full_name: string;
    first_name: string;
    avatar_url?: string | null;
  }): Promise<Profile> {
    if (env.demoMode) {
      const existing = memoryStore.profiles.get(input.id);
      const profile: Profile = {
        id: input.id,
        email: input.email,
        full_name: input.full_name,
        first_name: input.first_name,
        avatar_url: input.avatar_url ?? existing?.avatar_url ?? null,
        title: existing?.title ?? 'Member',
        bio: existing?.bio ?? '',
        status: 'online',
        created_at: existing?.created_at ?? nowIso(),
        updated_at: nowIso(),
      };
      memoryStore.profiles.set(input.id, profile);
      return profile;
    }

    const db = getMatuDb();
    const existing = await db.from('profiles').select('*').eq('id', input.id).single();
    const payload = {
      id: input.id,
      email: input.email,
      full_name: input.full_name,
      first_name: input.first_name,
      avatar_url: input.avatar_url ?? null,
      updated_at: nowIso(),
    };
    if (existing.data) {
      // MatuDB: filters before mutation (.eq().update()), unlike Supabase.
      const { data, error } = await db.from('profiles').eq('id', input.id).update(payload);
      if (error) throw new Error(error.message);
      return mapProfile(firstRow(data as DbRow | DbRow[], payload)!);
    }
    const { data, error } = await db.from('profiles').insert({
      ...payload,
      title: 'Member',
      bio: '',
      status: 'online',
      created_at: nowIso(),
    });
    if (error) throw new Error(error.message);
    return mapProfile(firstRow(data as DbRow | DbRow[], payload)!);
  },

  async getProfile(userId: string): Promise<Profile | null> {
    if (env.demoMode) return memoryStore.profiles.get(userId) ?? null;
    const { data, error } = await getMatuDb().from('profiles').select('*').eq('id', userId).single();
    if (error || !data) return null;
    return mapProfile(data as DbRow);
  },

  async listOnlineCount(): Promise<number> {
    if (env.demoMode) {
      return [...memoryStore.profiles.values()].filter((p) => p.status === 'online').length;
    }
    const { data } = await getMatuDb().from('profiles').select('id').eq('status', 'online');
    return asArray(data).length;
  },

  async listMeetingsForUser(userId: string): Promise<
    Array<Meeting & { participants: Array<Profile & { role: string }> }>
  > {
    if (env.demoMode) {
      const mine = [...memoryStore.participants.values()]
        .filter((p) => p.user_id === userId)
        .map((p) => p.meeting_id);
      const list = [...memoryStore.meetings.values()]
        .filter((m) => mine.includes(m.id) || m.created_by === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      return list.map((m) => {
        const parts = [...memoryStore.participants.values()].filter((p) => p.meeting_id === m.id);
        return {
          ...m,
          participants: parts
            .map((p) => {
              const profile = memoryStore.profiles.get(p.user_id);
              if (!profile) return null;
              return { ...profile, role: p.role };
            })
            .filter(Boolean) as Array<Profile & { role: string }>,
        };
      });
    }

    const db = getMatuDb();
    const { data: partRows } = await db
      .from('meeting_participants')
      .select('meeting_id')
      .eq('user_id', userId);
    const meetingIds = asArray(partRows as DbRow[]).map((r) => String(r.meeting_id));
    const { data: meetingRows } = await db
      .from('meetings')
      .select('*')
      .order('created_at', { ascending: false });
    const meetings = asArray(meetingRows as DbRow[])
      .map(mapMeeting)
      .filter((m) => meetingIds.includes(m.id) || m.created_by === userId);

    const result = [];
    for (const meeting of meetings) {
      const { data: parts } = await db
        .from('meeting_participants')
        .select('*')
        .eq('meeting_id', meeting.id);
      const participants: Array<Profile & { role: string }> = [];
      for (const part of asArray(parts as DbRow[])) {
        const profile = await this.getProfile(String(part.user_id));
        if (profile) participants.push({ ...profile, role: String(part.role) });
      }
      result.push({ ...meeting, participants });
    }
    return result;
  },

  async createMeeting(input: {
    title: string;
    tone: Meeting['tone'];
    icon_type: Meeting['icon_type'];
    created_by: string;
  }): Promise<
    Meeting & {
      participants: Array<Profile & { role: string }>;
      chat_thread_id?: string | null;
    }
  > {
    const meeting: Meeting = {
      id: randomUUID(),
      title: input.title,
      room_code: roomCode(),
      status: 'scheduled',
      tone: input.tone,
      icon_type: input.icon_type,
      agenda: null,
      started_at: null,
      ended_at: null,
      created_by: input.created_by,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    if (env.demoMode) {
      memoryStore.meetings.set(meeting.id, meeting);
      const part: MeetingParticipant = {
        id: randomUUID(),
        meeting_id: meeting.id,
        user_id: input.created_by,
        role: 'host',
        joined_at: nowIso(),
        left_at: null,
      };
      memoryStore.participants.set(part.id, part);
      const host = memoryStore.profiles.get(input.created_by)!;
      return { ...meeting, participants: [{ ...host, role: 'host' }] };
    }

    const db = getMatuDb();
    const { data, error } = await db.from('meetings').insert(meeting);
    if (error) throw new Error(error.message);
    const saved = mapMeeting(firstRow(data as DbRow | DbRow[], meeting)!);
    await db.from('meeting_participants').insert({
      id: randomUUID(),
      meeting_id: saved.id,
      user_id: input.created_by,
      role: 'host',
      joined_at: nowIso(),
    });
    const chat = await this.ensureMeetingChat(saved.id, saved.title, input.created_by);
    const host = await this.getProfile(input.created_by);
    return {
      ...saved,
      chat_thread_id: chat?.id ?? null,
      participants: host ? [{ ...host, role: 'host' }] : [],
    };
  },

  async ensureMeetingChat(meetingId: string, title: string, userId: string) {
    if (env.demoMode) {
      const existing = [...memoryStore.threads.values()].find((t) => t.meeting_id === meetingId);
      if (existing) {
        const members = memoryStore.threadMembers.get(existing.id) ?? new Set();
        members.add(userId);
        memoryStore.threadMembers.set(existing.id, members);
        return existing;
      }
      const thread = {
        id: randomUUID(),
        title: `${title} chat`,
        avatar_url: null as string | null,
        meeting_id: meetingId,
        updated_at: nowIso(),
        created_at: nowIso(),
      };
      memoryStore.threads.set(thread.id, thread);
      memoryStore.threadMembers.set(thread.id, new Set([userId]));
      memoryStore.messages.set(thread.id, []);
      return thread;
    }

    const db = getMatuDb();
    const { data: rows } = await db.from('chat_threads').select('*').eq('meeting_id', meetingId);
    const found = firstRow(rows as DbRow | DbRow[]);
    if (found) {
      const threadId = String(found.id);
      const { data: membership } = await db
        .from('chat_thread_members')
        .select('id')
        .eq('thread_id', threadId)
        .eq('user_id', userId);
      if (asArray(membership as DbRow[]).length === 0) {
        await db.from('chat_thread_members').insert({
          id: randomUUID(),
          thread_id: threadId,
          user_id: userId,
          unread: 0,
        });
      }
      return {
        id: threadId,
        title: String(found.title),
        avatar_url: (found.avatar_url as string | null) ?? null,
        meeting_id: meetingId,
        updated_at: String(found.updated_at),
        created_at: String(found.created_at),
      };
    }

    const thread = {
      id: randomUUID(),
      title: `${title} chat`,
      avatar_url: null as string | null,
      meeting_id: meetingId,
      updated_at: nowIso(),
      created_at: nowIso(),
    };
    const { error } = await db.from('chat_threads').insert(thread);
    if (error) throw new Error(error.message);
    await db.from('chat_thread_members').insert({
      id: randomUUID(),
      thread_id: thread.id,
      user_id: userId,
      unread: 0,
    });
    return thread;
  },

  async addParticipant(meetingId: string, userId: string, role: 'host' | 'participant' = 'participant') {
    if (env.demoMode) {
      const existing = [...memoryStore.participants.values()].find(
        (p) => p.meeting_id === meetingId && p.user_id === userId,
      );
      if (existing) {
        memoryStore.participants.set(existing.id, {
          ...existing,
          joined_at: existing.joined_at ?? nowIso(),
          left_at: null,
        });
        return existing;
      }
      const part: MeetingParticipant = {
        id: randomUUID(),
        meeting_id: meetingId,
        user_id: userId,
        role,
        joined_at: nowIso(),
        left_at: null,
      };
      memoryStore.participants.set(part.id, part);
      return part;
    }

    const db = getMatuDb();
    const { data: rows } = await db
      .from('meeting_participants')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('user_id', userId);
    const found = firstRow(rows as DbRow | DbRow[]);
    if (found) {
      await db
        .from('meeting_participants')
        .eq('id', String(found.id))
        .update({ joined_at: nowIso(), left_at: null });
      return found;
    }
    const part = {
      id: randomUUID(),
      meeting_id: meetingId,
      user_id: userId,
      role,
      joined_at: nowIso(),
    };
    const { error } = await db.from('meeting_participants').insert(part);
    if (error) throw new Error(error.message);
    return part;
  },

  async joinMeeting(meetingId: string, userId: string) {
    const meeting = await this.getMeeting(meetingId);
    if (!meeting) return null;
    await this.setMeetingLive(meetingId);
    const isHost = meeting.created_by === userId;
    await this.addParticipant(meetingId, userId, isHost ? 'host' : 'participant');
    const chat = await this.ensureMeetingChat(meetingId, meeting.title, userId);
    const full = await this.getMeeting(meetingId);
    return full ? { ...full, chat_thread_id: chat.id } : null;
  },

  async findMeetingByRoomCode(roomCodeValue: string) {
    if (env.demoMode) {
      const meeting = [...memoryStore.meetings.values()].find(
        (m) => m.room_code.toLowerCase() === roomCodeValue.toLowerCase(),
      );
      return meeting ? this.getMeeting(meeting.id) : null;
    }
    const { data } = await getMatuDb()
      .from('meetings')
      .select('*')
      .eq('room_code', roomCodeValue)
      .single();
    if (!data) return null;
    return this.getMeeting(String((data as DbRow).id));
  },

  async getMeeting(meetingId: string) {
    if (env.demoMode) {
      const meeting = memoryStore.meetings.get(meetingId);
      if (!meeting) return null;
      const parts = [...memoryStore.participants.values()].filter((p) => p.meeting_id === meetingId);
      return {
        ...meeting,
        participants: parts
          .map((p) => {
            const profile = memoryStore.profiles.get(p.user_id);
            return profile ? { ...profile, role: p.role } : null;
          })
          .filter(Boolean),
      };
    }
    const { data } = await getMatuDb().from('meetings').select('*').eq('id', meetingId).single();
    if (!data) return null;
    const meeting = mapMeeting(data as DbRow);
    const { data: parts } = await getMatuDb()
      .from('meeting_participants')
      .select('*')
      .eq('meeting_id', meetingId);
    const participants = [];
    for (const part of asArray(parts as DbRow[])) {
      const profile = await this.getProfile(String(part.user_id));
      if (profile) participants.push({ ...profile, role: String(part.role) });
    }
    return { ...meeting, participants };
  },

  async setMeetingLive(meetingId: string) {
    if (env.demoMode) {
      const m = memoryStore.meetings.get(meetingId);
      if (!m) return null;
      const updated = { ...m, status: 'live' as const, started_at: m.started_at ?? nowIso(), updated_at: nowIso() };
      memoryStore.meetings.set(meetingId, updated);
      return updated;
    }
    const { data, error } = await getMatuDb()
      .from('meetings')
      .eq('id', meetingId)
      .update({ status: 'live', started_at: nowIso(), updated_at: nowIso() });
    if (error) throw new Error(error.message);
    return mapMeeting(firstRow(data as DbRow | DbRow[])!);
  },

  async endMeeting(meetingId: string) {
    if (env.demoMode) {
      const m = memoryStore.meetings.get(meetingId);
      if (!m) return null;
      const updated = { ...m, status: 'ended' as const, ended_at: nowIso(), updated_at: nowIso() };
      memoryStore.meetings.set(meetingId, updated);
      return updated;
    }
    const { data, error } = await getMatuDb()
      .from('meetings')
      .eq('id', meetingId)
      .update({ status: 'ended', ended_at: nowIso(), updated_at: nowIso() });
    if (error) throw new Error(error.message);
    return mapMeeting(firstRow(data as DbRow | DbRow[])!);
  },

  async listThreads(userId: string) {
    if (env.demoMode) {
      return [...memoryStore.threads.values()]
        .filter((t) => memoryStore.threadMembers.get(t.id)?.has(userId))
        .map((t) => {
          const msgs = memoryStore.messages.get(t.id) ?? [];
          const last = msgs[msgs.length - 1];
          return {
            ...t,
            last_message: last?.body ?? '',
            unread: 0,
            is_online: true,
          };
        });
    }
    const db = getMatuDb();
    const { data: memberships } = await db
      .from('chat_thread_members')
      .select('*')
      .eq('user_id', userId);
    const result = [];
    for (const m of asArray(memberships as DbRow[])) {
      const { data: thread } = await db
        .from('chat_threads')
        .select('*')
        .eq('id', String(m.thread_id))
        .single();
      if (!thread) continue;
      const { data: msgs } = await db
        .from('chat_messages')
        .select('*')
        .eq('thread_id', String(m.thread_id))
        .order('created_at', { ascending: false })
        .limit(1);
      const last = firstRow(msgs as DbRow | DbRow[]);
      result.push({
        id: String((thread as DbRow).id),
        title: String((thread as DbRow).title),
        avatar_url: ((thread as DbRow).avatar_url as string | null) ?? null,
        meeting_id: ((thread as DbRow).meeting_id as string | null) ?? null,
        updated_at: String((thread as DbRow).updated_at),
        created_at: String((thread as DbRow).created_at),
        last_message: last ? String(last.body) : '',
        unread: Number(m.unread ?? 0),
        is_online: true,
      });
    }
    return result;
  },

  async getChatByMeeting(meetingId: string, userId: string) {
    const meeting = await this.getMeeting(meetingId);
    if (!meeting) return null;
    const chat = await this.ensureMeetingChat(meetingId, meeting.title, userId);
    return chat;
  },

  async listBanners() {
    const defaults = [
      {
        id: 'default-1',
        title: 'Connect\nCollaborate\ncreate',
        subtitle: 'Start a voice meeting with your team in seconds',
        image_url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
        cta_label: 'Start a Meeting',
        cta_action: 'start_meeting',
        link_url: null as string | null,
        badge_label: 'Live Now',
        accent_color: '#FF8FA3',
        sort_order: 0,
        is_active: true,
      },
      {
        id: 'default-2',
        title: 'Share your\nroom code',
        subtitle: 'Invite anyone with the room ID — they join from phone or web',
        image_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
        cta_label: 'View meetings',
        cta_action: 'none',
        link_url: null,
        badge_label: 'How to',
        accent_color: '#7EB6FF',
        sort_order: 1,
        is_active: true,
      },
      {
        id: 'default-3',
        title: 'Group chat\nin every call',
        subtitle: 'Messages stay with the meeting so the whole room stays aligned',
        image_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1200&q=80',
        cta_label: 'Open chats',
        cta_action: 'none',
        link_url: null,
        badge_label: 'Tip',
        accent_color: '#6FCF97',
        sort_order: 2,
        is_active: true,
      },
    ];

    if (env.demoMode) return defaults;

    try {
      const { data, error } = await getMatuDb()
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) return defaults;
      const rows = asArray(data as DbRow[]);
      if (rows.length === 0) {
        await this.seedBanners(defaults);
        return defaults;
      }
      return rows.map((row) => ({
        id: String(row.id),
        title: String(row.title ?? ''),
        subtitle: String(row.subtitle ?? ''),
        image_url: (row.image_url as string | null) ?? null,
        cta_label: (row.cta_label as string | null) ?? null,
        cta_action: String(row.cta_action ?? 'none'),
        link_url: (row.link_url as string | null) ?? null,
        badge_label: (row.badge_label as string | null) ?? 'News',
        accent_color: String(row.accent_color ?? '#FF6B8A'),
        sort_order: Number(row.sort_order ?? 0),
        is_active: Boolean(row.is_active),
      }));
    } catch {
      return defaults;
    }
  },

  async seedBanners(defaults: Array<Record<string, unknown>>) {
    try {
      for (const banner of defaults) {
        const { id: _id, ...rest } = banner;
        await getMatuDb().from('banners').insert({
          id: randomUUID(),
          ...rest,
          created_at: nowIso(),
          updated_at: nowIso(),
        });
      }
    } catch {
      // banners table may not exist yet
    }
  },

  async listMessages(threadId: string): Promise<ChatMessage[]> {
    if (env.demoMode) return memoryStore.messages.get(threadId) ?? [];
    const { data } = await getMatuDb()
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    return asArray(data as DbRow[]).map((row) => ({
      id: String(row.id),
      thread_id: String(row.thread_id),
      sender_id: String(row.sender_id),
      body: String(row.body),
      created_at: String(row.created_at),
    }));
  },

  async sendMessage(threadId: string, senderId: string, body: string): Promise<ChatMessage> {
    const msg: ChatMessage = {
      id: randomUUID(),
      thread_id: threadId,
      sender_id: senderId,
      body,
      created_at: nowIso(),
    };
    if (env.demoMode) {
      const list = memoryStore.messages.get(threadId) ?? [];
      list.push(msg);
      memoryStore.messages.set(threadId, list);
      const thread = memoryStore.threads.get(threadId);
      if (thread) {
        memoryStore.threads.set(threadId, { ...thread, updated_at: nowIso() });
      }
      return msg;
    }
    const { data, error } = await getMatuDb().from('chat_messages').insert(msg);
    if (error) throw new Error(error.message);
    await getMatuDb().from('chat_threads').eq('id', threadId).update({ updated_at: nowIso() });
    return firstRow(data as DbRow | DbRow[], msg) as ChatMessage;
  },

  async listNotifications(userId: string): Promise<Notification[]> {
    if (env.demoMode) return memoryStore.notifications.get(userId) ?? [];
    const { data } = await getMatuDb()
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return asArray(data as DbRow[]).map((row) => ({
      id: String(row.id),
      user_id: String(row.user_id),
      title: String(row.title),
      body: String(row.body),
      type: row.type as Notification['type'],
      is_read: Boolean(row.is_read),
      created_at: String(row.created_at),
    }));
  },

  async markNotificationsRead(userId: string, id?: string) {
    if (env.demoMode) {
      const list = memoryStore.notifications.get(userId) ?? [];
      memoryStore.notifications.set(
        userId,
        list.map((n) => (id ? (n.id === id ? { ...n, is_read: true } : n) : { ...n, is_read: true })),
      );
      return;
    }
    let q = getMatuDb().from('notifications').eq('user_id', userId);
    if (id) q = q.eq('id', id);
    await q.update({ is_read: true });
  },
};
