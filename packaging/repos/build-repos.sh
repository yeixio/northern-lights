#!/usr/bin/env bash
# Builds signed apt and yum/dnf repositories from .deb and .rpm files.
#
#   packaging/repos/build-repos.sh <packages-dir> <output-dir> <base-url>
#
# The GPG key must already be imported. Set GPG_KEY_ID to pick it and
# GPG_PASSPHRASE if it has one. Needs apt-ftparchive (apt-utils), createrepo_c
# and gpg.
#
# Layout of <output-dir>:
#   apt/                      deb [signed-by=...] <base-url>/apt stable main
#   rpm/<arch>/               baseurl=<base-url>/rpm/$basearch
#   northern-lights.repo      ready-made file for /etc/yum.repos.d
#   northern-lights.asc/.gpg  the public key, armored and binary
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PKGS="$(cd "$1" && pwd)"
OUT="$2"
BASE_URL="${3%/}"
: "${GPG_KEY_ID:?set GPG_KEY_ID}"

sign() { # sign <gpg args...>
  gpg --batch --yes --pinentry-mode loopback --passphrase "${GPG_PASSPHRASE:-}" \
    --local-user "$GPG_KEY_ID" "$@"
}

rm -rf "$OUT"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

# apt
mkdir -p "$OUT/apt/pool/main"
cp "$PKGS"/*.deb "$OUT/apt/pool/main/"
cd "$OUT/apt"
for arch in amd64 arm64; do
  dir="dists/stable/main/binary-$arch"
  mkdir -p "$dir"
  apt-ftparchive --arch "$arch" packages pool > "$dir/Packages"
  gzip -9kf "$dir/Packages"
done
apt-ftparchive \
  -o APT::FTPArchive::Release::Origin="Northern Lights" \
  -o APT::FTPArchive::Release::Label="Northern Lights" \
  -o APT::FTPArchive::Release::Suite=stable \
  -o APT::FTPArchive::Release::Codename=stable \
  -o APT::FTPArchive::Release::Architectures="amd64 arm64" \
  -o APT::FTPArchive::Release::Components=main \
  release dists/stable > dists/stable/Release.tmp
mv dists/stable/Release.tmp dists/stable/Release
sign --clearsign -o dists/stable/InRelease dists/stable/Release
sign --armor --detach-sign -o dists/stable/Release.gpg dists/stable/Release

# yum / dnf
for arch in x86_64 aarch64; do
  mkdir -p "$OUT/rpm/$arch"
  cp "$PKGS"/*."$arch".rpm "$OUT/rpm/$arch/" 2>/dev/null || true
  createrepo_c --quiet "$OUT/rpm/$arch"
  sign --armor --detach-sign -o "$OUT/rpm/$arch/repodata/repomd.xml.asc" "$OUT/rpm/$arch/repodata/repomd.xml"
done
cat > "$OUT/northern-lights.repo" <<REPO
[northern-lights]
name=Northern Lights
baseurl=$BASE_URL/rpm/\$basearch
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=$BASE_URL/northern-lights.asc
REPO

# Public key
gpg --batch --yes --armor --export "$GPG_KEY_ID" > "$OUT/northern-lights.asc"
gpg --batch --yes --export "$GPG_KEY_ID" > "$OUT/northern-lights.gpg"

# Instructions page
sed "s|__BASE_URL__|$BASE_URL|g" "$HERE/index.html" > "$OUT/index.html"
touch "$OUT/.nojekyll"
