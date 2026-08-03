import cors from 'cors';
import express from 'express';
import { env } from './config.js';
import { authRouter } from './routes/auth.js';
import { apiRouter } from './routes/api.js';

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'matucall-api',
      demoMode: env.demoMode,
      time: new Date().toISOString(),
    });
  });

  app.use('/auth', authRouter);
  app.use('/api', apiRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal error';
    res.status(500).json({ error: message });
  });

  return app;
}
