#!/bin/sh
# Runs after the package is removed (deb and rpm). Data in /var/lib/northern-lights
# is kept; delete it yourself if you no longer need it.
if [ -d /run/systemd/system ]; then
  systemctl daemon-reload >/dev/null 2>&1 || true
fi
exit 0
