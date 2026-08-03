#!/usr/bin/env python3
"""Fix port conflict and reload matucall-api on 4110."""
from __future__ import annotations

import os
import time
import paramiko

HOST = os.environ.get("DEPLOY_SSH_HOST", "13.140.160.248")
PASSWORD = os.environ.get("DEPLOY_SSH_PASSWORD", "")
REMOTE = "/root/apps/matucall-api"


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 180) -> str:
    print(">>>", cmd, flush=True)
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip().encode("ascii", "replace").decode("ascii"))
    if err.strip():
        print("STDERR:", err.rstrip().encode("ascii", "replace").decode("ascii"))
    print(f"[exit {code}]", flush=True)
    return out


def main() -> int:
    if not PASSWORD:
        raise SystemExit("DEPLOY_SSH_PASSWORD required")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=30)

    # Update remote .env PORT
    run(
        client,
        f"sed -i 's/^PORT=.*/PORT=4110/' {REMOTE}/.env && "
        f"grep -E '^(PORT|NODE_ENV|MATUDB_DEMO)=' {REMOTE}/.env",
    )

    # Update ecosystem
    run(
        client,
        f"sed -i \"s/PORT: 4100/PORT: 4110/\" {REMOTE}/ecosystem.config.cjs",
    )

    # Nginx upstream 4110
    run(
        client,
        "sed -i 's/127.0.0.1:4100/127.0.0.1:4110/g' "
        "/etc/nginx/sites-available/call.api.matudb.com && "
        "nginx -t && systemctl reload nginx",
    )

    run(client, f"cd {REMOTE} && pm2 delete matucall-api || true")
    run(client, f"cd {REMOTE} && pm2 start ecosystem.config.cjs && pm2 save")
    time.sleep(2)
    run(client, "curl -sS http://127.0.0.1:4110/health")
    run(client, "ss -lptn | grep 4110 || true")
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
