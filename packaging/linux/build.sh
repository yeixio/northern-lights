#!/usr/bin/env bash
# Builds northern-lights_<version>_<arch>.deb and northern-lights-<version>-1.<arch>.rpm
# for the machine's architecture into ./dist-packages.
#
#   packaging/linux/build.sh 0.1.0
#
# Needs Node.js, npm, curl and nfpm (https://nfpm.goreleaser.com). Set
# SIGNING_KEY_FILE (an armored GPG private key) and NFPM_PASSPHRASE to sign them.
set -euo pipefail
cd "$(dirname "$0")/../.."

VERSION="${1:?usage: build.sh <version>}"
VERSION="${VERSION#v}"
NODE_VERSION="${NODE_VERSION:-22.22.0}"
case "$(uname -m)" in
  x86_64) ARCH=amd64; NODE_ARCH=x64 ;;
  aarch64 | arm64) ARCH=arm64; NODE_ARCH=arm64 ;;
  *) echo "unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STAGE="$WORK/northern-lights"
mkdir -p "$STAGE" dist-packages

# Build the app and keep only production dependencies.
npm ci
npm run build
cp -r package.json package-lock.json dist "$STAGE/"
(cd "$STAGE" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund)
# better-sqlite3 ships prebuilt binaries for every platform; keep this one.
find "$STAGE/node_modules/better-sqlite3/prebuilds" -type f ! -name "linux-$NODE_ARCH.node" -delete

# Bundle the official Node.js runtime (just the binary).
NODE_DIST="node-v$NODE_VERSION-linux-$NODE_ARCH"
curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/$NODE_DIST.tar.xz" | tar -xJ -C "$WORK"
mkdir -p "$STAGE/node/bin"
cp "$WORK/$NODE_DIST/bin/node" "$STAGE/node/bin/node"
cp "$WORK/$NODE_DIST/LICENSE" "$STAGE/node/LICENSE"

# Fill in nfpm.yaml. Without a signing key, drop the RPM signature section.
SIGNING_KEY_FILE="${SIGNING_KEY_FILE:-}"
CONFIG="$WORK/nfpm.yaml"
sed -e "s|\${VERSION}|$VERSION|g" -e "s|\${ARCH}|$ARCH|g" -e "s|\${STAGE}|$STAGE|g" \
  -e "s|\${SIGNING_KEY_FILE}|$SIGNING_KEY_FILE|g" packaging/linux/nfpm.yaml > "$CONFIG"
if [ -z "$SIGNING_KEY_FILE" ]; then
  sed -i '/^  signature:/,/key_file:/d' "$CONFIG"
fi
for packager in deb rpm; do
  nfpm package --config "$CONFIG" --packager "$packager" --target dist-packages/
done
ls -l dist-packages
