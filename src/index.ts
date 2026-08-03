import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { env } from './config.js';
import { registerSocketHandlers } from './sockets/index.js';

const app = createApp();
app.set('trust proxy', 1);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    credentials: true,
  },
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000,
  allowEIO3: true,
});

registerSocketHandlers(io);

httpServer.listen(env.PORT, '0.0.0.0', () => {
  console.info(`[MatuCall API] http://0.0.0.0:${env.PORT}`);
  console.info(`[MatuCall API] health → /health`);
  console.info(`[MatuCall API] mode → ${env.demoMode ? 'DEMO (memory)' : 'MatuDB'}`);
  if (env.demoMode) {
    console.info('[MatuCall API] Demo login: emma@matucall.app / matucall123');
  }
});
