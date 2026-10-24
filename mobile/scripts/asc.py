"""App Store Connect API helpers: a signed token and a JSON request.

From yeixio/prox scripts/build/push-appstore-metadata.py (itself from
yeixio/toskar-apps). Needs ASC_API_KEY_ID, ASC_API_ISSUER_ID and ASC_API_KEY
(the path to the .p8) and nothing but openssl.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import time
import urllib.error
import urllib.request

API = "https://api.appstoreconnect.apple.com"


class AppleError(Exception):
    def __init__(self, method: str, path: str, status: int, body: str):
        super().__init__(f"{method} {path} failed ({status}): {body}")
        self.status = status
        self.body = body


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def der_ecdsa_to_raw(der: bytes) -> bytes:
    if der[0] != 0x30:
        raise ValueError("ECDSA signature is not a DER sequence")
    index = 2
    if der[1] & 0x80:
        index = 2 + (der[1] & 0x7F)

    def read_int() -> bytes:
        nonlocal index
        if der[index] != 0x02:
            raise ValueError("ECDSA signature is missing an integer")
        index += 1
        length = der[index]
        index += 1
        value = der[index : index + length]
        index += length
        return value[-32:].rjust(32, b"\x00")

    return read_int() + read_int()


def jwt() -> str:
    key_id = os.environ["ASC_API_KEY_ID"]
    issuer = os.environ["ASC_API_ISSUER_ID"]
    key_path = os.environ["ASC_API_KEY"]
    now = int(time.time())
    header = b64url(json.dumps({"alg": "ES256", "kid": key_id, "typ": "JWT"}, separators=(",", ":")).encode())
    payload = b64url(
        json.dumps(
            {"iss": issuer, "iat": now, "exp": now + 15 * 60, "aud": "appstoreconnect-v1"},
            separators=(",", ":"),
        ).encode()
    )
    signing_input = f"{header}.{payload}".encode()
    signature = subprocess.check_output(
        ["openssl", "dgst", "-sha256", "-sign", key_path],
        input=signing_input,
    )
    return f"{header}.{payload}.{b64url(der_ecdsa_to_raw(signature))}"


def api(token: str, method: str, path: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(API + path, data=data, method=method)
    request.add_header("Authorization", "Bearer " + token)
    request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        raise AppleError(method, path, error.code, error.read().decode()) from error

