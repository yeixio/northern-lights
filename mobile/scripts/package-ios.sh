#!/usr/bin/env bash
# Archive the iPhone app (mobile/ios) and, when UPLOAD_APPSTORE=1, send the ipa
# to App Store Connect, where it lands in TestFlight.
# Adapted from yeixio/prox scripts/build/package-ios-appstore.sh for Capacitor.
#
# Required to sign:
#   APPSTORE_DISTRIBUTION_IDENTITY  the certificate's SHA-1 or name
#   IOS_PROVISION_PROFILE           path to the App Store .mobileprovision for com.yeix.northernlights
#
# Required to upload:
#   ASC_API_KEY_ID ASC_API_ISSUER_ID ASC_API_KEY
#   UPLOAD_APPSTORE=1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "package-ios.sh must run on macOS" >&2
  exit 1
fi

: "${APPSTORE_DISTRIBUTION_IDENTITY:?Set APPSTORE_DISTRIBUTION_IDENTITY}"
: "${IOS_PROVISION_PROFILE:?Set IOS_PROVISION_PROFILE to the iOS .mobileprovision path}"

BUNDLE_ID="com.yeix.northernlights"
RAW_VERSION="${VERSION:-1.0.0}"
SHORT_VERSION="${RAW_VERSION%%-*}"
if [[ ! "$SHORT_VERSION" =~ ^[0-9]+(\.[0-9]+)*$ ]]; then
  SHORT_VERSION="1.0.0"
fi
BUILD_VERSION="${IOS_BUILD_NUMBER:-${GITHUB_RUN_NUMBER:-1}}"

plist="$(mktemp)"
security cms -D -i "$IOS_PROVISION_PROFILE" > "$plist" || true
if ! grep -q "<plist" "$plist"; then
  echo "Could not read the provisioning profile $IOS_PROVISION_PROFILE." >&2
  rm -f "$plist"
  exit 1
fi
PROFILE_NAME="$(/usr/libexec/PlistBuddy -c 'Print :Name' "$plist")"
TEAM_ID="$(/usr/libexec/PlistBuddy -c 'Print :TeamIdentifier:0' "$plist")"
uuid="$(/usr/libexec/PlistBuddy -c 'Print :UUID' "$plist")"
app_id="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:application-identifier' "$plist" 2>/dev/null || true)"
rm -f "$plist"
if [[ "${app_id#*.}" != "$BUNDLE_ID" ]]; then
  echo "Provisioning profile is for ${app_id#*.}, but it should be for ${BUNDLE_ID}." >&2
  exit 1
fi
install_dir="$HOME/Library/MobileDevice/Provisioning Profiles"
mkdir -p "$install_dir"
cp "$IOS_PROVISION_PROFILE" "$install_dir/${uuid}.mobileprovision"

npm ci
npm run build:hub
npx cap sync ios
python3 mobile/scripts/set-signing.py mobile/ios/App/App.xcodeproj "$BUNDLE_ID" "$PROFILE_NAME" "$TEAM_ID"

ARCHIVE="$ROOT/dist/NorthernLights.xcarchive"
rm -rf "$ARCHIVE"
xcodebuild \
  -project mobile/ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -archivePath "$ARCHIVE" \
  -destination "generic/platform=iOS" \
  -skipPackagePluginValidation \
  CODE_SIGN_IDENTITY="$APPSTORE_DISTRIBUTION_IDENTITY" \
  MARKETING_VERSION="$SHORT_VERSION" \
  CURRENT_PROJECT_VERSION="$BUILD_VERSION" \
  archive

EXPORT_PLIST="$(mktemp)"
cat > "$EXPORT_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>signingCertificate</key>
  <string>${APPSTORE_DISTRIBUTION_IDENTITY}</string>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${BUNDLE_ID}</key>
    <string>${PROFILE_NAME}</string>
  </dict>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
PLIST

EXPORT_DIR="$ROOT/dist/ios-export"
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$EXPORT_PLIST"
rm -f "$EXPORT_PLIST"

IPA="$(find "$EXPORT_DIR" -name '*.ipa' -print | head -n 1)"
if [[ -z "$IPA" ]]; then
  echo "xcodebuild did not produce an ipa." >&2
  exit 1
fi
echo "iOS package: $IPA ($SHORT_VERSION, build $BUILD_VERSION)"

if [[ "${UPLOAD_APPSTORE:-}" != "1" ]]; then
  exit 0
fi

: "${ASC_API_KEY_ID:?Set ASC_API_KEY_ID to upload}"
: "${ASC_API_ISSUER_ID:?Set ASC_API_ISSUER_ID to upload}"
: "${ASC_API_KEY:?Set ASC_API_KEY to the .p8 path to upload}"

KEY_DIR="$HOME/private_keys"
mkdir -p "$KEY_DIR"
cp "$ASC_API_KEY" "$KEY_DIR/AuthKey_${ASC_API_KEY_ID}.p8"

echo "Uploading the iOS app to App Store Connect…"
if ! xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$ASC_API_KEY_ID" \
  --apiIssuer "$ASC_API_ISSUER_ID"; then
  echo "altool upload failed; trying iTMSTransporter" >&2
  xcrun iTMSTransporter -m upload \
    -assetFile "$IPA" \
    -apiKey "$ASC_API_KEY_ID" \
    -apiIssuer "$ASC_API_ISSUER_ID" \
    -v informational
fi
