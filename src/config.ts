import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4100),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  MATUDB_URL: z.string().default('https://db.matudb.com'),
  MATUDB_PROJECT_ID: z.string().default(''),
  MATUDB_API_KEY: z.string().default(''),
  MATUDB_USE_SUPABASE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  MATUDB_DEMO: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  TURN_URLS: z.string().default(''),
  TURN_USERNAME: z.string().default(''),
  TURN_CREDENTIAL: z.string().default(''),
  INVITE_BASE_URL: z.string().default('https://call.matubyte.com/join'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid env:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isDev: parsed.data.NODE_ENV !== 'production',
  demoMode:
    parsed.data.MATUDB_DEMO ||
    !parsed.data.MATUDB_PROJECT_ID ||
    !parsed.data.MATUDB_API_KEY ||
    parsed.data.MATUDB_PROJECT_ID === 'your-project-id',
  iceServers(): Array<Record<string, unknown>> {
    const servers: Array<Record<string, unknown>> = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    const urls = parsed.data.TURN_URLS.split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length && parsed.data.TURN_USERNAME && parsed.data.TURN_CREDENTIAL) {
      servers.push({
        urls,
        username: parsed.data.TURN_USERNAME,
        credential: parsed.data.TURN_CREDENTIAL,
      });
    }
    return servers;
  },
};
