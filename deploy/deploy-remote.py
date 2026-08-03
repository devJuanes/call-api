#!/usr/bin/env python3
"""Despliega MatuCall API en el VPS (call.api.matudb.com) → /root/apps/call-api."""
from __future__ import annotations

import io
import os
import sys
import tarfile
import tempfile
import time
from pathlib import Path

import paramiko

HOST = os.environ.get("DEPLOY_SSH_HOST", "13.140.160.248")
USER = os.environ.get("DEPLOY_SSH_USER", "root")
PASSWORD = os.environ.get("DEPLOY_SSH_PASSWORD", "")
SITE = "https://call.api.matudb.com"
DOMAIN = "call.api.matudb.com"
REMOTE_DIR = "/root/apps/call-api"
LOCAL_ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", "node_modules", "dist", ".cursor", ".dart_tool"}
SKIP_FILES: set[str] = set()


def log(msg: str) -> None:
    print(msg.encode("ascii", "replace").decode("ascii"), flush=True)


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 900) -> tuple[int, str, str]:
    log(f"\n>>> {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip().encode("ascii", "replace").decode("ascii"))
    if err.strip():
        print("STDERR:", err.rstrip().encode("ascii", "replace").decode("ascii"))
    log(f"[exit {code}]")
    return code, out, err


def production_env(local: dict[str, str]) -> str:
    return "\n".join(
        [
            "# MatuCall API — producción (call.api.matudb.com)",
            "MATUDB_DEMO=false",
            "PORT=4110",
            "NODE_ENV=production",
            "CORS_ORIGIN=*",
            f"MATUDB_URL={local.get('MATUDB_URL', 'https://db.matudb.com')}",
            f"MATUDB_PROJECT_ID={local.get('MATUDB_PROJECT_ID', '')}",
            f"MATUDB_API_KEY={local.get('MATUDB_API_KEY', '')}",
            f"MATUDB_USE_SUPABASE={local.get('MATUDB_USE_SUPABASE', 'false')}",
            f"API_PUBLIC_URL={SITE}",
            "",
        ]
    )


def load_local_env() -> dict[str, str]:
    env: dict[str, str] = {}
    env_path = LOCAL_ROOT / ".env"
    if not env_path.exists():
        return env
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def make_tarball() -> Path:
    tmp = Path(tempfile.gettempdir()) / "call-api-deploy.tar.gz"
    with tarfile.open(tmp, "w:gz") as tar:
        for path in LOCAL_ROOT.rglob("*"):
            rel = path.relative_to(LOCAL_ROOT)
            parts = rel.parts
            if parts and parts[0] in SKIP_DIRS:
                continue
            if any(p in SKIP_DIRS for p in parts):
                continue
            if path.is_file() and path.name in SKIP_FILES:
                continue
            if path.is_file():
                tar.add(path, arcname=str(rel).replace("\\", "/"))
    log(f"Tarball: {tmp} ({tmp.stat().st_size // 1024} KB)")
    return tmp


def sftp_put(client: paramiko.SSHClient, local: Path, remote: str) -> None:
    sftp = client.open_sftp()
    sftp.put(str(local), remote)
    sftp.close()


def sftp_write(client: paramiko.SSHClient, remote: str, content: str) -> None:
    sftp = client.open_sftp()
    with sftp.file(remote, "w") as f:
        f.write(content)
    sftp.close()


def main() -> int:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    if not PASSWORD:
        log("Set DEPLOY_SSH_PASSWORD env var before running.")
        return 1

    local_env = load_local_env()
    if not local_env.get("MATUDB_PROJECT_ID") or not local_env.get("MATUDB_API_KEY"):
        log("Missing MATUDB_PROJECT_ID / MATUDB_API_KEY in local .env")
        return 1

    tar = make_tarball()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    log(f"Connecting {USER}@{HOST} ...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    run(client, f"mkdir -p {REMOTE_DIR}")
    remote_tar = "/tmp/call-api-deploy.tar.gz"
    log("Uploading tarball...")
    sftp_put(client, tar, remote_tar)
    run(
        client,
        f"mkdir -p {REMOTE_DIR} && tar -xzf {remote_tar} -C {REMOTE_DIR} && rm -f {remote_tar}",
    )
    sftp_write(client, f"{REMOTE_DIR}/.env", production_env(local_env))

    code, _, _ = run(
        client,
        f"cd {REMOTE_DIR} && npm ci && npm run build",
        timeout=1200,
    )
    if code != 0:
        log("Build failed")
        client.close()
        return code

    run(
        client,
        "grep -q 'connection_upgrade' /etc/nginx/conf.d/map-connection-upgrade.conf 2>/dev/null || "
        "printf '%s\\n' "
        "'map $http_upgrade $connection_upgrade {' "
        "'    default upgrade;' "
        "\"    ''      close;\" "
        "'}' "
        "> /etc/nginx/conf.d/map-connection-upgrade.conf",
    )

    # HTTP bootstrap (until certbot)
    run(
        client,
        f"cat > /etc/nginx/sites-available/{DOMAIN} <<'EOF'\n"
        "upstream matucall_api { server 127.0.0.1:4110; keepalive 32; }\n"
        "server {\n"
        "  listen 80;\n"
        "  listen [::]:80;\n"
        f"  server_name {DOMAIN};\n"
        "  client_max_body_size 10M;\n"
        "  location / {\n"
        "    proxy_pass http://matucall_api;\n"
        "    proxy_http_version 1.1;\n"
        "    proxy_set_header Host $host;\n"
        "    proxy_set_header X-Real-IP $remote_addr;\n"
        "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
        "    proxy_set_header X-Forwarded-Proto $scheme;\n"
        "    proxy_set_header Upgrade $http_upgrade;\n"
        "    proxy_set_header Connection $connection_upgrade;\n"
        "    proxy_read_timeout 86400s;\n"
        "    proxy_buffering off;\n"
        "  }\n"
        "  location /socket.io/ {\n"
        "    proxy_pass http://matucall_api;\n"
        "    proxy_http_version 1.1;\n"
        "    proxy_set_header Upgrade $http_upgrade;\n"
        "    proxy_set_header Connection \"upgrade\";\n"
        "    proxy_set_header Host $host;\n"
        "    proxy_read_timeout 86400s;\n"
        "    proxy_buffering off;\n"
        "  }\n"
        "}\n"
        "EOF\n"
        f"ln -sfn /etc/nginx/sites-available/{DOMAIN} /etc/nginx/sites-enabled/{DOMAIN}\n"
        # remove old alternate site if present
        "rm -f /etc/nginx/sites-enabled/call-api.matudb.com /etc/nginx/sites-available/call-api.matudb.com || true\n",
    )
    run(client, "nginx -t && systemctl reload nginx")

    # Stop old path process and start from new path
    run(client, "pm2 delete matucall-api || true")
    run(
        client,
        f"cd {REMOTE_DIR} && pm2 start ecosystem.config.cjs && pm2 save",
    )

    run(
        client,
        f"if [ ! -f /etc/letsencrypt/live/{DOMAIN}/fullchain.pem ]; then "
        f"certbot --nginx -d {DOMAIN} --non-interactive --agree-tos "
        f"--register-unsafely-without-email --redirect || true; fi",
        timeout=180,
    )
    run(client, "nginx -t && systemctl reload nginx || true")

    time.sleep(2)
    run(client, "curl -sS http://127.0.0.1:4110/health || true")
    run(client, f"curl -sS http://{DOMAIN}/health || true")
    run(client, f"curl -sS https://{DOMAIN}/health || true")

    client.close()
    log(f"\nDone. Public URL: {SITE}/health")
    log(f"Remote path: {REMOTE_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
