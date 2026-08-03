import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { env } from './config.js';
import { registerSocketHandlers } from './sockets/index.js';

const app = createApp();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

registerSocketHandlers(io);

httpServer.listen(env.PORT, () => {
  console.info(`[MatuCall API] http://localhost:${env.PORT}`);
  console.info(`[MatuCall API] health → http://localhost:${env.PORT}/health`);
  console.info(`[MatuCall API] mode → ${env.demoMode ? 'DEMO (memory)' : 'MatuDB'}`);
  if (env.demoMode) {
    console.info('[MatuCall API] Demo login: emma@matucall.app / matucall123');
  }
});
