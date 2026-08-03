#!/usr/bin/env python3
import os
import paramiko

HOST = os.environ.get("DEPLOY_SSH_HOST", "13.140.160.248")
PASSWORD = os.environ.get("DEPLOY_SSH_PASSWORD", "")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username="root", password=PASSWORD, timeout=30)

cmds = [
    "ss -lptn | grep 4100 || true",
    "pm2 logs matucall-api --lines 50 --nostream",
    "grep -n health /root/apps/matucall-api/dist/app.js || true",
    "curl -sS -i http://127.0.0.1:4100/health | head -n 30",
    "node -e \"console.log(require('/root/apps/matucall-api/package.json').name)\"",
    "ls -la /root/apps/matucall-api/dist",
]

for cmd in cmds:
    print(">>>", cmd, flush=True)
    _, stdout, stderr = client.exec_command(cmd, timeout=90)
    print(stdout.read().decode("utf-8", errors="replace"), end="")
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        print("STDERR:", err)
    print(flush=True)

client.close()
