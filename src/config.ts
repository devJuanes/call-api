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
};
