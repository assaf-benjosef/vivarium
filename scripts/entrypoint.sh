#!/bin/sh
# Drop to the viv user if running as root (SmolVM ignores Dockerfile USER)
if [ "$(id -u)" = "0" ]; then
  chown -R viv:viv /workspace 2>/dev/null || true
  exec setpriv --reuid=viv --regid=viv --init-groups env HOME=/home/viv node /app/dist/index.js
fi
exec node /app/dist/index.js
