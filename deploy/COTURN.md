# Coturn (TURN) en el VPS — opcional

Para mejorar audio detrás de NAT:

```bash
apt-get install -y coturn
# Editar /etc/turnserver.conf con realm, user, listening-port 3478
systemctl enable --now coturn
```

En `/root/apps/call-api/.env`:

```
TURN_URLS=turn:IP_PUBLICA:3478
TURN_USERNAME=matucall
TURN_CREDENTIAL=secreto_seguro
```

Reiniciar `pm2 restart matucall-api --update-env`.

Los clientes obtienen ICE con `GET /api/ice`.
