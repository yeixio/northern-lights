#!/usr/bin/env bash
# Build the Android app (mobile/android) as a signed App Bundle for Google
# Play and, when UPLOAD_PLAY=1, send it to a Play testing track.
# Adapted from yeixio/prox scripts/build/package-android-play.sh for Capacitor.
#
# Required to sign (the upload key; Google signs what phones install):
#   ANDROID_UPLOAD_KEYSTORE         path to the upload keystore (.jks)
#   ANDROID_UPLOAD_STORE_PASSWORD
#   ANDROID_UPLOAD_KEY_ALIAS
#   ANDROID_UPLOAD_KEY_PASSWORD
#
# Required to upload:
#   PLAY_SERVICE_ACCOUNT_JSON       path to the service account's JSON key
#   UPLOAD_PLAY=1
#   PLAY_TRACK                      internal (default), alpha, beta, or production
#   PLAY_RELEASE_STATUS             completed (default), or draft while the
#                                   app has never been published
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

: "${ANDROID_UPLOAD_KEYSTORE:?Set ANDROID_UPLOAD_KEYSTORE to the upload keystore path}"
: "${ANDROID_UPLOAD_STORE_PASSWORD:?Set ANDROID_UPLOAD_STORE_PASSWORD}"
: "${ANDROID_UPLOAD_KEY_ALIAS:?Set ANDROID_UPLOAD_KEY_ALIAS}"
: "${ANDROID_UPLOAD_KEY_PASSWORD:?Set ANDROID_UPLOAD_KEY_PASSWORD}"
if [[ ! -f "$ANDROID_UPLOAD_KEYSTORE" ]]; then
  echo "Upload keystore not found: $ANDROID_UPLOAD_KEYSTORE" >&2
  exit 1
fi

PACKAGE="com.yeix.northernlights"
RAW_VERSION="${VERSION:-1.0.0}"
VERSION_NAME="${RAW_VERSION%%-*}"
if [[ ! "$VERSION_NAME" =~ ^[0-9]+(\.[0-9]+)*$ ]]; then
  VERSION_NAME="1.0.0"
fi
# Minutes since 1970: higher on every build, as Play requires, without a
# counter to keep, and under Play's limit of 2,100,000,000 for millennia.
VERSION_CODE="${ANDROID_VERSION_CODE:-$(( $(date -u +%s) / 60 ))}"

npm ci
npm run build:hub
npx cap sync android

# Through the environment, so the passwords stay out of the process list
# (mobile/android/app/build.gradle reads them).
export ORG_GRADLE_PROJECT_nlUploadStoreFile="$ANDROID_UPLOAD_KEYSTORE"
export ORG_GRADLE_PROJECT_nlUploadStorePassword="$ANDROID_UPLOAD_STORE_PASSWORD"
export ORG_GRADLE_PROJECT_nlUploadKeyAlias="$ANDROID_UPLOAD_KEY_ALIAS"
export ORG_GRADLE_PROJECT_nlUploadKeyPassword="$ANDROID_UPLOAD_KEY_PASSWORD"
export ORG_GRADLE_PROJECT_nlVersionCode="$VERSION_CODE"
export ORG_GRADLE_PROJECT_nlVersionName="$VERSION_NAME"
(cd mobile/android && ./gradlew bundleRelease --no-daemon)

BUNDLE="$ROOT/dist/NorthernLights.aab"
mkdir -p "$ROOT/dist"
cp mobile/android/app/build/outputs/bundle/release/app-release.aab "$BUNDLE"

# Play warns about, and Android 15+ devices with 16 KB pages can't load,
# native libraries built for 4 KB pages.
python3 mobile/scripts/check-16k-alignment.py "$BUNDLE"

# Signed with the upload key, not the debug key Play rejects.
signer="$(keytool -printcert -jarfile "$BUNDLE" | sed -n 's/^Owner: //p' | head -n 1)"
if [[ -z "$signer" || "$signer" == *"Android Debug"* ]]; then
  echo "The bundle isn't signed with the upload key (signer: ${signer:-none})." >&2
  exit 1
fi
echo "Android bundle: $BUNDLE ($VERSION_NAME, code $VERSION_CODE, signed by $signer)"

if [[ "${UPLOAD_PLAY:-}" != "1" ]]; then
  exit 0
fi

: "${PLAY_SERVICE_ACCOUNT_JSON:?Set PLAY_SERVICE_ACCOUNT_JSON to the service account JSON path to upload}"
python3 mobile/scripts/push-play.py \
  --package "$PACKAGE" \
  --bundle "$BUNDLE" \
  --track "${PLAY_TRACK:-internal}" \
  --status "${PLAY_RELEASE_STATUS:-completed}" \
  --name "$VERSION_NAME ($VERSION_CODE)"
