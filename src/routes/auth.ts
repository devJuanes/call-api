import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { env } from '../config.js';
import { getMatuDb } from '../lib/matudb.js';
import { dataService } from '../services/dataService.js';
import { memoryStore } from '../store/memory.js';

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1).optional(),
});

authRouter.post('/signup', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const field = Object.entries(flat.fieldErrors)
      .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
      .join('; ');
    return res.status(400).json({
      error: field || flat.formErrors.join('; ') || 'Invalid signup data',
      details: flat,
    });
  }
  const { email, password, full_name } = parsed.data;
  const name = full_name ?? email.split('@')[0];
  const first = name.split(' ')[0];

  try {
    if (env.demoMode) {
      if (memoryStore.findProfileByEmail(email)) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      const id = randomUUID();
      const profile = await dataService.upsertProfile({
        id,
        email,
        full_name: name,
        first_name: first,
        avatar_url: `https://i.pravatar.cc/400?u=${encodeURIComponent(email)}`,
      });
      memoryStore.passwords.set(email, password);
      const session = memoryStore.createSession(id);
      return res.json({
        data: {
          user: profile,
          session: {
            access_token: session.access_token,
            expires_at: session.expires_at,
            user: profile,
          },
        },
      });
    }

    const db = getMatuDb();
    const { data, error } = await db.auth.signUp({ email, password });
    if (error) {
      const message =
        typeof error === 'string'
          ? error
          : (error as { message?: string })?.message || JSON.stringify(error);
      return res.status(400).json({ error: message });
    }
    const user = data?.user;
    if (!user?.id) return res.status(400).json({ error: 'Signup failed' });
    const profile = await dataService.upsertProfile({
      id: user.id,
      email: user.email ?? email,
      full_name: name,
      first_name: first,
    });
    let session = data?.session;
    // Some MatuDB configs create the user but omit session — sign in immediately.
    if (!session?.access_token) {
      const signed = await db.auth.signInWithPassword({ email, password });
      if (signed.error || !signed.data?.session?.access_token) {
        return res.status(400).json({
          error:
            typeof signed.error === 'string'
              ? signed.error
              : signed.error?.message ||
                'Account created but session missing. Try Sign in.',
        });
      }
      session = signed.data.session;
    }
    return res.json({
      data: {
        user: profile,
        session: {
          access_token: session.access_token,
          expires_at: session.expires_at != null ? String(session.expires_at) : null,
          user: profile,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Signup failed' });
  }
});

authRouter.post('/signin', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const field = Object.entries(flat.fieldErrors)
      .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
      .join('; ');
    return res.status(400).json({
      error: field || flat.formErrors.join('; ') || 'Invalid credentials',
      details: flat,
    });
  }
  const { email, password } = parsed.data;

  try {
    if (env.demoMode) {
      const profile = memoryStore.findProfileByEmail(email);
      if (!profile || memoryStore.passwords.get(email) !== password) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const session = memoryStore.createSession(profile.id);
      return res.json({
        data: {
          user: profile,
          session: {
            access_token: session.access_token,
            expires_at: session.expires_at,
            user: profile,
          },
        },
      });
    }

    const db = getMatuDb();
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    const userId = data?.user?.id ?? data?.session?.user?.id;
    if (!userId || !data?.session?.access_token) {
      return res.status(401).json({ error: 'Sign in failed' });
    }
    const display = email.split('@')[0];
    const profile = await dataService.upsertProfile({
      id: userId,
      email: data.user?.email ?? email,
      full_name: display,
      first_name: display,
    });
    return res.json({
      data: {
        user: profile,
        session: {
          access_token: data.session.access_token,
          expires_at: data.session.expires_at != null ? String(data.session.expires_at) : null,
          user: profile,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Sign in failed' });
  }
});

authRouter.post('/signout', async (_req, res) => {
  if (!env.demoMode) {
    try {
      await getMatuDb().auth.signOut();
    } catch {
      // ignore
    }
  }
  return res.json({ data: { ok: true } });
});
