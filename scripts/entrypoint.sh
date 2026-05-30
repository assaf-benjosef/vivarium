#!/bin/sh
# Drop to the viv user if running as root (SmolVM ignores Dockerfile USER)
if [ "$(id -u)" = "0" ]; then
  chown -R viv:viv /home/viv /workspace 2>/dev/null || true
  # SmolVM packs remap file ownership — restore sudo so the agent can use it
  chown root:root /usr/bin/sudo /etc/sudoers /etc/sudo.conf /etc/sudoers.d 2>/dev/null || true
  chmod 4755 /usr/bin/sudo 2>/dev/null || true
  exec su viv -c "HOME=/home/viv node /app/dist/index.js"
fi
exec node /app/dist/index.js
