#!/usr/bin/env python3
"""Fetch, or create, the App Store provisioning profile for an app through
the App Store Connect API, so CI needs no per-app profile secret.
From yeixio/prox scripts/build/fetch-ios-profile.py.

It finds the profile for APPSTORE_BUNDLE_ID (default com.yeix.northernlights) that
includes the distribution certificate in DISTRIBUTION_P12 and writes it to
the path given as the only argument. With none, it registers the bundle ID
if needed and creates one. The API key (ASC_API_KEY_ID, ASC_API_ISSUER_ID,
ASC_API_KEY) needs the Admin or App Manager role.

  DISTRIBUTION_P12=cert.p12 DISTRIBUTION_P12_PASSWORD=… \\
    python3 mobile/scripts/fetch-ios-profile.py out.mobileprovision
"""
from __future__ import annotations

import base64
import importlib.util
import os
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("asc", HERE / "asc.py")
asc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(asc)


def certificate_serial(p12: str, password: str) -> str:
    """The serial number of the certificate in a .p12, as Apple prints it."""
    pem = None
    for extra in ([], ["-legacy"]):
        result = subprocess.run(
            ["openssl", "pkcs12", "-in", p12, "-nokeys", "-passin", "env:P12_PASSWORD", *extra],
            capture_output=True,
            env={**os.environ, "P12_PASSWORD": password},
        )
        if result.returncode == 0:
            pem = result.stdout
            break
    if pem is None:
        raise SystemExit("Could not read the distribution certificate; check DISTRIBUTION_P12_PASSWORD.")
    serial = subprocess.check_output(["openssl", "x509", "-noout", "-serial"], input=pem).decode()
    return serial.strip().split("=", 1)[1].upper().lstrip("0")


def bundle_id_resource(token: str, identifier: str) -> str:
    query = urllib.parse.urlencode({"filter[identifier]": identifier, "limit": 200})
    for item in asc.api(token, "GET", "/v1/bundleIds?" + query).get("data", []):
        # The filter matches prefixes too; only the exact identifier counts.
        if item["attributes"]["identifier"] == identifier:
            return item["id"]
    print(f"Registering bundle ID {identifier}")
    created = asc.api(token, "POST", "/v1/bundleIds", {
        "data": {
            "type": "bundleIds",
            "attributes": {"identifier": identifier, "name": identifier.replace(".", " "), "platform": "IOS"},
        }
    })
    return created["data"]["id"]


def certificate_resource(token: str, serial: str) -> str:
    query = urllib.parse.urlencode({"filter[certificateType]": "DISTRIBUTION,IOS_DISTRIBUTION", "limit": 200})
    for item in asc.api(token, "GET", "/v1/certificates?" + query).get("data", []):
        if (item["attributes"].get("serialNumber") or "").upper().lstrip("0") == serial:
            return item["id"]
    raise SystemExit(f"No distribution certificate with serial {serial} in this team; is DISTRIBUTION_P12 from it?")


def existing_profile(token: str, bundle: str, certificate: str) -> str | None:
    query = urllib.parse.urlencode({
        "filter[profileType]": "IOS_APP_STORE",
        "filter[profileState]": "ACTIVE",
        "include": "bundleId,certificates",
        "limit": 200,
    })
    for item in asc.api(token, "GET", "/v1/profiles?" + query).get("data", []):
        rel = item.get("relationships", {})
        if (rel.get("bundleId", {}).get("data") or {}).get("id") != bundle:
            continue
        if certificate in {c["id"] for c in rel.get("certificates", {}).get("data") or []}:
            return item["attributes"]["profileContent"]
    return None


def remove_invalid_profiles(token: str, bundle: str) -> None:
    """Deletes this app's App Store profiles that Apple has invalidated, as
    happens when a capability is added to the App ID."""
    query = urllib.parse.urlencode({
        "filter[profileType]": "IOS_APP_STORE",
        "filter[profileState]": "INVALID",
        "include": "bundleId",
        "limit": 200,
    })
    for item in asc.api(token, "GET", "/v1/profiles?" + query).get("data", []):
        if (item.get("relationships", {}).get("bundleId", {}).get("data") or {}).get("id") != bundle:
            continue
        print(f"Removing invalid profile {item['attributes'].get('name')}")
        try:
            asc.api(token, "DELETE", f"/v1/profiles/{item['id']}")
        except asc.AppleError as error:
            print(f"Couldn't remove it ({error}); continuing")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: fetch-ios-profile.py OUTPUT.mobileprovision")
    for name in ("ASC_API_KEY_ID", "ASC_API_ISSUER_ID", "ASC_API_KEY", "DISTRIBUTION_P12", "DISTRIBUTION_P12_PASSWORD"):
        if not os.environ.get(name):
            raise SystemExit(f"Set {name}")
    identifier = os.environ.get("APPSTORE_BUNDLE_ID") or "com.yeix.northernlights"
    token = asc.jwt()
    bundle = bundle_id_resource(token, identifier)
    certificate = certificate_resource(token, certificate_serial(os.environ["DISTRIBUTION_P12"], os.environ["DISTRIBUTION_P12_PASSWORD"]))
    content = existing_profile(token, bundle, certificate)
    if content is None:
        remove_invalid_profiles(token, bundle)
        print(f"Creating an App Store profile for {identifier}")
        # Names must be unique, and a capability change leaves the old profile behind as invalid.
        name = f"{identifier} App Store (CI) {time.strftime('%Y-%m-%d %H%M', time.gmtime())}"
        created = asc.api(token, "POST", "/v1/profiles", {
            "data": {
                "type": "profiles",
                "attributes": {"name": name, "profileType": "IOS_APP_STORE"},
                "relationships": {
                    "bundleId": {"data": {"type": "bundleIds", "id": bundle}},
                    "certificates": {"data": [{"type": "certificates", "id": certificate}]},
                },
            }
        })
        content = created["data"]["attributes"]["profileContent"]
    else:
        print(f"Using the active App Store profile for {identifier}")
    Path(sys.argv[1]).write_bytes(base64.b64decode(content))


if __name__ == "__main__":
    main()
