# MatuCall API

Realtime voice meetings API: **MatuDB** + **Socket.IO WebRTC signaling**.

## Production

- URL: **https://call.api.matudb.com**
- VPS path: `/root/apps/call-api`
- PM2: `matucall-api` → `:4110`

```bash
curl https://call.api.matudb.com/health
```

## Local

```bash
cp .env.example .env
npm install
npm run dev
```

Health: http://localhost:4100/health

## MatuDB

1. Run `database/schema.sql` (or `npm run db:schema`).
2. Set in `.env`:

```env
MATUDB_DEMO=false
MATUDB_URL=https://db.matudb.com
MATUDB_PROJECT_ID=...
MATUDB_API_KEY=mb_...
```

## Deploy

```powershell
$env:DEPLOY_SSH_PASSWORD = "..."
python deploy/deploy-remote.py
```

See `deploy/DEPLOY.md`.

## Flutter

```bash
flutter run --dart-define=CALL_API_URL=https://call.api.matudb.com
```

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
