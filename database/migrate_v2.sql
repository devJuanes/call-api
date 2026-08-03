-- Incremental migration for existing MatuCall projects
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS waiting_room_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS invite_url TEXT;

ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS is_muted_by_host BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS hand_raised BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS connection_state TEXT NOT NULL DEFAULT 'connected';

CREATE TABLE IF NOT EXISTS meeting_lobby (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'admitted', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_lobby_meeting ON meeting_lobby(meeting_id);

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_by JSONB NOT NULL DEFAULT '[]'::jsonb;
