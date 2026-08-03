# MatuCall Web Client (local)

Open this file against production without deploying it.

## Run

```bash
cd web-client
npx --yes serve -l 5179
```

Then open http://localhost:5179

Or simply open `index.html` in the browser (prefer `serve` if CORS/`file://` acts up).

## Flow

1. Sign in / sign up with a **real** MatuCall account (same MatuDB users as the phone app).
2. On the phone, create/join a meeting and copy the **room code**.
3. Paste the room code here → Join.
4. You should appear as a live participant; mute/devices/chat work against `https://call.api.matubyte.com`.
