#!/bin/sh
# Drop to the viv user if running as root (SmolVM ignores Dockerfile USER)
if [ "$(id -u)" = "0" ]; then
  # SmolVM packs remap all file ownership — fix critical paths
  chmod 1777 /tmp
  chown -R viv:viv /home/viv /workspace 2>/dev/null || true
  chown root:root /usr/bin/sudo /etc/sudoers /etc/sudo.conf /etc/sudoers.d 2>/dev/null || true
  chown root:root /etc/sudoers.d/* 2>/dev/null || true
  chmod 4755 /usr/bin/sudo 2>/dev/null || true
  touch /tmp/vivarium.log && chown viv:viv /tmp/vivarium.log
  exec su -p viv -c "HOME=/home/viv exec node /app/dist/index.js >> /tmp/vivarium.log 2>&1"
fi
exec node /app/dist/index.js
