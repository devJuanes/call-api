# MatuCall API

Realtime voice meetings API: **MatuDB** (auth + persistence) + **Socket.IO WebRTC signaling**.

## Quick start (demo mode)

```bash
cd C:\MatuStudio\call-api
cp .env.example .env   # already set MATUDB_DEMO=true
npm install
npm run dev
```

- Health: http://localhost:4100/health
- Demo login: `emma@matucall.app` / `matucall123`

## Real MatuDB

1. Create a MatuDB project and run `database/schema.sql` in the SQL console.
2. Set in `.env`:

```env
MATUDB_DEMO=false
MATUDB_URL=https://db.matudb.com
MATUDB_PROJECT_ID=...
MATUDB_API_KEY=anon_...
```

3. Restart `npm run dev`.

## Flutter

```bash
cd C:\dev\matucall
flutter run --dart-define=CALL_API_URL=http://YOUR_LAN_IP:4100
```

Android physical device must use your PC LAN IP (not localhost). Emulator can use `http://10.0.2.2:4100`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/signup` | Create account + profile |
| POST | `/auth/signin` | Sign in |
| GET | `/api/me` | Current profile |
| GET | `/api/meetings` | List meetings |
| POST | `/api/meetings` | Create meeting |
| POST | `/api/meetings/:id/join` | Mark live + join |
| POST | `/api/meetings/:id/end` | End meeting |
| GET/POST | `/api/chats...` | Threads & messages |
| GET/POST | `/api/notifications...` | Notifications |

## Socket.IO (voice)

Events: `join-room`, `leave-room`, `audio-offer`, `audio-answer`, `new-ice-candidate`, `mute-changed`.
