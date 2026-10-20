#!/bin/sh
# Runs before the package is removed or upgraded (deb and rpm).
# Stop the service only on removal: deb passes "remove", rpm passes 0.
if [ "$1" = "remove" ] || [ "$1" = "0" ]; then
  if [ -d /run/systemd/system ]; then
    systemctl disable --now northern-lights.service >/dev/null 2>&1 || true
  fi
fi
exit 0
