# Despliegue MatuCall API — call.api.matubyte.com

| Componente | URL / puerto |
|------------|--------------|
| API + Socket.IO | `https://call.api.matubyte.com` |
| PM2 puerto interno | `127.0.0.1:4110` |
| Path en VPS | `/root/apps/call-api` |
| MatuDB | `https://db.matudb.com` |

## DNS

Dominio base: **matubyte.com**

| Tipo | Nombre | Apunta a |
|------|--------|----------|
| A | `call.api` | `13.140.160.248` |

```bash
certbot --nginx -d call.api.matubyte.com
curl https://call.api.matubyte.com/health
```

## Redeploy

```powershell
cd C:\MatuStudio\call-api
$env:DEPLOY_SSH_PASSWORD = "..."
python deploy/deploy-remote.py
```

## Flutter

```bash
flutter run --dart-define=CALL_API_URL=https://call.api.matubyte.com
```
