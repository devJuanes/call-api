import { createClient } from '@devjuanes/matuclient';
import { env } from '../config.js';

export type DbClient = ReturnType<typeof createClient>;
export type DbRow = Record<string, unknown>;

let client: DbClient | null = null;

export function getMatuDb(): DbClient {
  if (env.demoMode) {
    throw new Error('MatuDB is in demo mode — use memory store');
  }
  if (!client) {
    client = createClient({
      url: env.MATUDB_URL,
      projectId: env.MATUDB_PROJECT_ID,
      apiKey: env.MATUDB_API_KEY,
      useSupabase: env.MATUDB_USE_SUPABASE,
    });
  }
  return client;
}

export function createUserDb(accessToken: string): DbClient {
  const db = createClient({
    url: env.MATUDB_URL,
    projectId: env.MATUDB_PROJECT_ID,
    apiKey: env.MATUDB_API_KEY,
    useSupabase: env.MATUDB_USE_SUPABASE,
  });
  // Prefer setSession when available
  const auth = db.auth as {
    setSession?: (s: { access_token: string }) => Promise<unknown>;
  };
  void auth.setSession?.({ access_token: accessToken });
  return db;
}

export function firstRow<T>(data: T | T[] | null | undefined, fallback?: T): T | null {
  if (Array.isArray(data)) return (data[0] ?? fallback ?? null) as T | null;
  if (data != null) return data as T;
  return (fallback ?? null) as T | null;
}

export function asArray<T>(data: T | T[] | null | undefined): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function roomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
