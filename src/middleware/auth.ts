import type { Request, Response, NextFunction } from 'express';
import { env } from '../config.js';
import { getMatuDb } from '../lib/matudb.js';
import { memoryStore } from '../store/memory.js';

export type AuthUser = {
  id: string;
  email: string;
  accessToken: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  const token = header.slice(7);

  try {
    if (env.demoMode) {
      const session = memoryStore.getSession(token);
      if (!session) return res.status(401).json({ error: 'Invalid session' });
      const profile = memoryStore.profiles.get(session.user_id);
      if (!profile) return res.status(401).json({ error: 'User not found' });
      req.user = { id: profile.id, email: profile.email, accessToken: token };
      return next();
    }

    const db = getMatuDb();
    const auth = db.auth as {
      getUser?: (jwt?: string) => Promise<{ data?: { user?: { id: string; email?: string } }; error?: { message: string } }>;
      setSession?: (s: { access_token: string }) => Promise<unknown>;
    };
    await auth.setSession?.({ access_token: token });
    const result = await auth.getUser?.(token);
    const user = result?.data?.user;
    if (!user?.id) {
      return res.status(401).json({ error: result?.error?.message ?? 'Invalid token' });
    }
    req.user = {
      id: user.id,
      email: user.email ?? '',
      accessToken: token,
    };
    return next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auth failed';
    return res.status(401).json({ error: message });
  }
}
