import os
import paramiko
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    "13.140.160.248",
    username="root",
    password=os.environ["DEPLOY_SSH_PASSWORD"],
    timeout=30,
)
cmd = r"""
set -e
cd /root/apps/call-api
if [ ! -f .env ] && [ -f /root/call-api.env.bak ]; then cp /root/call-api.env.bak .env; fi
npm run db:schema || true
curl -sS https://call.api.matubyte.com/health; echo
curl -sS https://call.api.matubyte.com/api/banners || true; echo
"""
stdin, stdout, stderr = client.exec_command(cmd, timeout=180)
out = (stdout.read() + stderr.read()).decode("utf-8", "replace")
print(out[-6000:])
print("exit", stdout.channel.recv_exit_status())
client.close()
