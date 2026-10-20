#!/bin/sh
# Installs the package from the given directory on a Debian/Ubuntu or
# Fedora/RHEL-family system, starts the server as its service user, and checks
# it answers. Used by CI inside distro containers (no systemd there).
#
#   packaging/linux/test-install.sh dist-packages
set -eu
dir="$1"

if command -v apt-get >/dev/null; then
  apt-get update -qq
  apt-get install -y -qq "$dir"/*.deb
else
  dnf install -y -q "$dir"/*.rpm
  command -v su >/dev/null || dnf install -y -q util-linux
fi

id northern-lights
test -f /etc/northern-lights/northern-lights.env
test -f /usr/lib/systemd/system/northern-lights.service

cd /
su -s /bin/sh northern-lights -c 'DATA_DIR=/var/lib/northern-lights PORT=3000 northern-lights' > /tmp/server.log 2>&1 &
node=/usr/lib/northern-lights/node/bin/node
for _ in $(seq 1 30); do
  if $node -e "fetch('http://127.0.0.1:3000/api/auth/session').then(async r => { console.log(await r.text()); process.exit(r.ok ? 0 : 1) }, () => process.exit(1))" &&
     $node -e "fetch('http://127.0.0.1:3000/').then(async r => process.exit((await r.text()).includes('<div id=\"root\">') ? 0 : 1), () => process.exit(1))"; then
    cat /tmp/server.log
    test -f /var/lib/northern-lights/northern-lights.db
    echo "OK"
    exit 0
  fi
  sleep 1
done
cat /tmp/server.log
exit 1
