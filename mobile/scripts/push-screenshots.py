#!/usr/bin/env python3
"""Replace the iPhone and iPad app's App Store screenshots with the ones in git.

Reads the screenshots `npm run store:screenshots` made, in
packaging/appstore/screenshots/<device>/<width>x<height>/, and puts them on the App
Store version being prepared, in file name order. Each capture goes to the
version's screenshot set of the same pixel size, found from the screenshots
already in it, so a size uploaded by hand keeps working. A size with no set
yet gets one when it's in DISPLAY_TYPES. A version with Apple or live can't
change, and is left alone.

From yeixio/prox scripts/build/push-screenshots.py (itself from
yeixio/toskar-apps).

Uses the App Store Connect API key, as push-appstore-metadata.py does:
  ASC_API_KEY_ID, ASC_API_ISSUER_ID, ASC_API_KEY (path to the .p8)
APPSTORE_BUNDLE_ID defaults to com.yeix.northernlights, APPSTORE_VERSION to
packaging/appstore/metadata-ios.json's version.

  push-screenshots.py --check    lists what would go up, without Apple
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "packaging" / "appstore" / "screenshots"
METADATA = ROOT / "packaging" / "appstore" / "metadata-ios.json"
# Apple's slot for each captured size that has no set on the version yet.
DISPLAY_TYPES = {
    "1320x2868": "APP_IPHONE_67",
    "2064x2752": "APP_IPAD_PRO_3GEN_129",
}


def load(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


listing = load("listing", "push-appstore-metadata.py")
api, AppleError = listing.api, listing.AppleError
EDITABLE = listing.EDITABLE_STATES


def captured() -> dict[str, list[Path]]:
    """The capture's screenshots by pixel size, such as 1320x2868, in file name order."""
    found: dict[str, list[Path]] = {}
    for size_dir in sorted(SHOTS.glob("*/*x*")):
        files = sorted(size_dir.glob("*.png"))
        if files:
            found.setdefault(size_dir.name, []).extend(files)
    return found


def size_of(token: str, set_id: str) -> str | None:
    """The pixel size of a set's screenshots, from its first one."""
    shots = api(token, "GET", f"/v1/appScreenshotSets/{set_id}/appScreenshots?limit=1").get("data", [])
    asset = (shots[0]["attributes"].get("imageAsset") or {}) if shots else {}
    if asset.get("width") and asset.get("height"):
        return f"{asset['width']}x{asset['height']}"
    return None


def upload(token: str, set_id: str, path: Path) -> None:
    """Reserve a screenshot in the set, send its bytes where Apple says, and commit it."""
    data = path.read_bytes()
    made = api(
        token,
        "POST",
        "/v1/appScreenshots",
        {
            "data": {
                "type": "appScreenshots",
                "attributes": {"fileName": path.name, "fileSize": len(data)},
                "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": set_id}}},
            }
        },
    )["data"]
    for op in made["attributes"]["uploadOperations"]:
        part = data[op["offset"] : op["offset"] + op["length"]]
        request = urllib.request.Request(op["url"], data=part, method=op["method"])
        for header in op.get("requestHeaders", []):
            request.add_header(header["name"], header["value"])
        with urllib.request.urlopen(request):
            pass
    api(
        token,
        "PATCH",
        f"/v1/appScreenshots/{made['id']}",
        {
            "data": {
                "type": "appScreenshots",
                "id": made["id"],
                "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(data).hexdigest()},
            }
        },
    )


def main() -> None:
    shots = captured()
    if not shots:
        raise SystemExit(f"No screenshots in {SHOTS.relative_to(ROOT)}; run npm run store:screenshots first")
    for size, files in shots.items():
        print(f"{size}: {len(files)} screenshots")
        if len(files) > 10:
            raise SystemExit(f"{size} has {len(files)} screenshots; App Store Connect takes 10")
    if "--check" in sys.argv:
        return
    for name in ("ASC_API_KEY_ID", "ASC_API_ISSUER_ID", "ASC_API_KEY"):
        if not os.environ.get(name):
            raise SystemExit(f"Set {name} to push screenshots")
    meta = json.loads(METADATA.read_text())
    bundle_id = os.environ.get("APPSTORE_BUNDLE_ID") or "com.yeix.northernlights"
    wanted = os.environ.get("APPSTORE_VERSION") or meta["version"]
    token = listing.jwt()
    apps = api(token, "GET", "/v1/apps?" + urllib.parse.urlencode({"filter[bundleId]": bundle_id}))
    app_id = listing.app_with_bundle_id(apps, bundle_id)["id"]
    query = urllib.parse.urlencode({"filter[platform]": "IOS", "filter[versionString]": wanted})
    version = listing.first_data(api(token, "GET", f"/v1/apps/{app_id}/appStoreVersions?{query}"))
    if version is None:
        raise SystemExit(f"There's no iOS version {wanted} yet; push the listing first to make it")
    state = listing.state_of(version)
    if state not in EDITABLE:
        print(f"Version {wanted} is {state}: its screenshots can't change. Left as they are.")
        return
    locs = api(token, "GET", f"/v1/appStoreVersions/{version['id']}/appStoreVersionLocalizations").get("data", [])
    loc = next((l for l in locs if l["attributes"].get("locale") == meta["locale"]), None)
    if loc is None:
        raise SystemExit(f"Version {wanted} has no {meta['locale']} listing yet; push the listing first")
    sets = api(token, "GET", f"/v1/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets").get("data", [])
    by_size: dict[str, str] = {}
    for item in sets:
        size = size_of(token, item["id"])
        if size:
            by_size.setdefault(size, item["id"])
    for size, files in shots.items():
        set_id = by_size.get(size)
        if set_id is None:
            display = DISPLAY_TYPES.get(size)
            if display is None:
                print(f"{size}: no screenshot set of this size on {wanted}. Upload one by hand once, and later pushes replace it.")
                continue
            set_id = api(
                token,
                "POST",
                "/v1/appScreenshotSets",
                {
                    "data": {
                        "type": "appScreenshotSets",
                        "attributes": {"screenshotDisplayType": display},
                        "relationships": {
                            "appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": loc["id"]}}
                        },
                    }
                },
            )["data"]["id"]
        for old in api(token, "GET", f"/v1/appScreenshotSets/{set_id}/appScreenshots?limit=50").get("data", []):
            api(token, "DELETE", f"/v1/appScreenshots/{old['id']}")
        for path in files:
            upload(token, set_id, path)
        print(f"{size}: replaced with {len(files)} screenshots")
    print(f"Screenshots for {wanted} are up; App Store Connect processes them in a few minutes.")


if __name__ == "__main__":
    try:
        main()
    except AppleError as error:
        raise SystemExit(str(error))
