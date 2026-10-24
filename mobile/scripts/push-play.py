#!/usr/bin/env python3
"""Upload an Android App Bundle to a Google Play track.

From yeixio/prox scripts/build/push-play.py (itself from yeixio/toskar-apps).

Uses a Google Cloud service account that has release access to the app in
Play Console (Users and permissions):
  PLAY_SERVICE_ACCOUNT_JSON   path to the service account's JSON key

  push-play.py --package com.yeix.northernlights --bundle dist/NorthernLights.aab \\
               --track internal --status completed --name "1.6.0 (29700000)"

One Play "edit": insert, upload the bundle, set the track's release, commit.
Play's API can't create an app, so the app's first bundle is uploaded by hand
in Play Console. Signing the token needs only openssl, like the App Store
scripts, so there's nothing to install.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications"
SCOPE = "https://www.googleapis.com/auth/androidpublisher"


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def access_token(key: dict) -> str:
    """A token for the service account: an RS256-signed JWT, exchanged at Google's token URI."""
    now = int(time.time())
    header = b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = b64(
        json.dumps(
            {"iss": key["client_email"], "scope": SCOPE, "aud": key["token_uri"], "iat": now, "exp": now + 3600}
        ).encode()
    )
    signing_input = f"{header}.{claims}".encode()
    with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False) as pem:
        pem.write(key["private_key"])
        pem_path = pem.name
    try:
        os.chmod(pem_path, 0o600)
        signature = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", pem_path], input=signing_input, capture_output=True, check=True
        ).stdout
    finally:
        os.unlink(pem_path)
    assertion = f"{header}.{claims}.{b64(signature)}"
    body = urllib.parse.urlencode(
        {"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion}
    ).encode()
    with urllib.request.urlopen(urllib.request.Request(key["token_uri"], data=body)) as response:
        return json.load(response)["access_token"]


class PlayError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(f"{status} {detail}")
        self.status = status
        self.detail = detail


def call(token: str, method: str, url: str, body: dict | None = None, data: bytes | None = None, content_type: str = "application/json") -> dict:
    payload = data if data is not None else (json.dumps(body).encode() if body is not None else None)
    request = urllib.request.Request(url, data=payload, method=method)
    request.add_header("Authorization", f"Bearer {token}")
    if payload is not None:
        request.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise PlayError(error.code, f"Play API {method} {url.split('/applications/')[-1]} failed: {error.code} {detail}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--package", required=True)
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--track", default="internal")
    parser.add_argument("--status", default="completed", choices=["completed", "draft"])
    parser.add_argument("--name", default="")
    args = parser.parse_args()

    key_path = os.environ.get("PLAY_SERVICE_ACCOUNT_JSON")
    if not key_path:
        raise SystemExit("Set PLAY_SERVICE_ACCOUNT_JSON to the service account's JSON key path")
    with open(key_path) as handle:
        key = json.load(handle)
    token = access_token(key)

    base = f"{API}/{args.package}/edits"
    edit = call(token, "POST", base, {})["id"]
    print(f"Play edit {edit} for {args.package}")

    with open(args.bundle, "rb") as handle:
        bundle = handle.read()
    uploaded = call(
        token,
        "POST",
        f"{UPLOAD}/{args.package}/edits/{edit}/bundles?uploadType=media",
        data=bundle,
        content_type="application/octet-stream",
    )
    version_code = str(uploaded["versionCode"])
    print(f"Uploaded {os.path.basename(args.bundle)}: version code {version_code}")

    status = args.status
    release = {"versionCodes": [version_code], "status": status}
    if args.name:
        release["name"] = args.name
    try:
        call(token, "PUT", f"{base}/{edit}/tracks/{args.track}", {"track": args.track, "releases": [release]})
    except PlayError as error:
        # Until an app is published, Play takes only draft releases
        # ("Only releases with status draft may be created on draft app").
        if status != "draft" and "draft app" in error.detail:
            status = release["status"] = "draft"
            print("Play takes only drafts until the app is published; saving this release as a draft to roll out in Play Console")
            call(token, "PUT", f"{base}/{edit}/tracks/{args.track}", {"track": args.track, "releases": [release]})
        else:
            raise
    call(token, "POST", f"{base}/{edit}:commit")
    print(f"Released version code {version_code} to the {args.track} track ({status})")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except PlayError as error:
        raise SystemExit(str(error))
