import type { Server } from 'socket.io';
import { env } from '../config.js';
import { getMatuDb } from '../lib/matudb.js';
import { SocketEvents } from './events.js';

/**
 * Puente MatuDB Realtime → Socket.IO.
 * Si MatuDB channels no están disponibles, el API sigue con sockets directos.
 */
export function startRealtimeBridge(io: Server) {
  if (env.demoMode) {
    console.info('[realtime] demo mode — sin canales MatuDB');
    return;
  }
  try {
    const db = getMatuDb() as {
      channel?: (name: string) => {
        on: (event: string, cb: (payload: { data?: unknown; new?: unknown }) => void) => {
          subscribe: () => unknown;
        };
      };
      removeChannel?: (ch: unknown) => void;
    };
    if (typeof db.channel !== 'function') {
      console.info('[realtime] cliente MatuDB sin channel() — usando solo Socket.IO');
      return;
    }

    const chat = db
      .channel('matucall:chat_messages')
      .on('INSERT', (payload) => {
        const row = (payload.data ?? payload.new) as Record<string, unknown> | undefined;
        if (!row) return;
        io.emit(SocketEvents.RECEIVE_MESSAGE, {
          id: row.id,
          threadId: row.thread_id,
          userId: row.sender_id,
          body: row.body,
          replyToId: row.reply_to_id,
          createdAt: row.created_at,
        });
      })
      .subscribe();

    console.info('[realtime] canal chat_messages activo', Boolean(chat));
  } catch (err) {
    console.warn('[realtime] no se pudo iniciar bridge MatuDB:', err);
  }
}
