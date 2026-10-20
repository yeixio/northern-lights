#!/bin/sh
# Runs after the package is installed or upgraded (deb and rpm).
set -e

if ! getent group northern-lights >/dev/null; then
  groupadd --system northern-lights
fi
if ! getent passwd northern-lights >/dev/null; then
  useradd --system --gid northern-lights --home-dir /var/lib/northern-lights \
    --no-create-home --shell /usr/sbin/nologin \
    --comment "Northern Lights" northern-lights
fi
mkdir -p /var/lib/northern-lights
chown northern-lights:northern-lights /var/lib/northern-lights
chmod 0750 /var/lib/northern-lights
# The config file can hold database and SMTP passwords.
chown root:northern-lights /etc/northern-lights/northern-lights.env
chmod 0640 /etc/northern-lights/northern-lights.env

if [ -d /run/systemd/system ]; then
  systemctl daemon-reload >/dev/null 2>&1 || true
  # deb passes "configure <old-version>" on upgrade; rpm passes 2 or more.
  if [ -n "$2" ] || [ "${1:-0}" -ge 2 ] 2>/dev/null; then
    systemctl try-restart northern-lights.service >/dev/null 2>&1 || true
  else
    echo
    echo "Northern Lights is installed. Start it with:"
    echo "  sudo systemctl enable --now northern-lights"
    echo "then open http://localhost:3000 to create the admin account."
    echo "Settings: /etc/northern-lights/northern-lights.env"
    echo
  fi
fi
