#!/usr/bin/env python3
"""Push packaging/appstore/metadata-ios.json to App Store Connect.

From yeixio/prox scripts/build/push-appstore-metadata.py (itself from
yeixio/toskar-apps), for the iPhone app only.

Uses the App Store Connect API key:
  ASC_API_KEY_ID, ASC_API_ISSUER_ID, ASC_API_KEY (path to the .p8)

APPSTORE_BUNDLE_ID defaults to com.yeix.northernlights. APPSTORE_VERSION
overrides the file's version; the release workflow sets it to the version it
built.

"reviewNotes" become the App Review notes on an editable version. The app
needs a site to sign in to, so App Review gets a demo account on a demo site
from APP_REVIEW_SITE, APP_REVIEW_EMAIL and APP_REVIEW_PASSWORD (repository
secrets, so the password stays out of this public repo); the notes' {site}
is replaced with the site's address. Without them the notes and demo account
in App Store Connect are left as they are. The review contact's name and
phone are set once in App Store Connect and left alone.

"localizations" adds listings in other languages, such as es-MX: each gives
its own name, subtitle, keywords, description, promotional text and what's
new; links and categories are the main listing's.

Pass --check to validate the file without calling Apple.
"""

from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
METADATA = ROOT / "packaging" / "appstore" / "metadata-ios.json"

_spec = importlib.util.spec_from_file_location("asc", HERE / "asc.py")
asc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(asc)
api, AppleError, jwt = asc.api, asc.AppleError, asc.jwt

# Versions not submitted to Apple, or sent back: their number and listing
# can change.
EDITABLE_STATES = {
    "PREPARE_FOR_SUBMISSION",
    "DEVELOPER_REJECTED",
    "REJECTED",
    "METADATA_REJECTED",
    "INVALID_BINARY",
}
# Versions with Apple: never renamed or reused for another version. While one
# is pending, Apple doesn't allow another, so its listing is left alone.
SUBMITTED_STATES = {
    "WAITING_FOR_REVIEW",
    "IN_REVIEW",
    "PENDING_DEVELOPER_RELEASE",
    "PENDING_APPLE_RELEASE",
    "PROCESSING_FOR_APP_STORE",
}
LIMITS = {
    "name": 30,
    "subtitle": 30,
    "promotionalText": 170,
    "keywords": 100,
    "description": 4000,
    "whatsNew": 4000,
    "reviewNotes": 4000,
}
# What each extra language must give itself, so none shows English.
TRANSLATED = ("name", "subtitle", "keywords", "description", "promotionalText", "whatsNew")
# App info records customers see now; Apple refuses edits to these.
LIVE_APP_INFO_STATES = {"READY_FOR_DISTRIBUTION", "READY_FOR_SALE", "REPLACED_WITH_NEW_INFO"}


def rejected_attributes(error: AppleError) -> list[str]:
    try:
        payload = json.loads(error.body)
    except json.JSONDecodeError:
        return []
    found = []
    for err in payload.get("errors", []):
        pointer = (err.get("source") or {}).get("pointer") or ""
        if pointer:
            found.append(pointer.rsplit("/", 1)[-1])
        match = re.search(r"Attribute '([^']+)'", err.get("detail") or "")
        if match:
            found.append(match.group(1))
    return found


def locales(meta: dict) -> list[dict]:
    """The main listing, then each extra language's, with the main
    listing's links and other untranslated fields."""
    base = {k: v for k, v in meta.items() if k != "localizations"}
    out = [meta]
    for locale, fields in (meta.get("localizations") or {}).items():
        out.append({**base, **fields, "locale": locale})
    return out


def validate(meta: dict) -> None:
    for lm in locales(meta):
        where = f"{lm['locale']}: " if lm is not meta else ""
        for key, limit in LIMITS.items():
            value = lm.get(key) or ""
            if len(value) > limit:
                raise SystemExit(f"{where}{key} is {len(value)} characters; Apple allows {limit}")
        if ", " in (lm.get("keywords") or ""):
            raise SystemExit(f"{where}keywords must be comma-separated without spaces after commas")
    for key in ("name", "description", "keywords", "supportUrl", "privacyPolicyUrl"):
        if not meta.get(key):
            raise SystemExit(f"{key} is empty")
    for locale, fields in (meta.get("localizations") or {}).items():
        missing = [k for k in TRANSLATED if not fields.get(k)]
        if missing:
            raise SystemExit(f"{locale} is missing {', '.join(missing)}")


def load_meta() -> dict:
    meta = json.loads(METADATA.read_text())
    validate(meta)
    return meta


def patch_attributes(token: str, path: str, resource_type: str, resource_id: str, attributes: dict) -> None:
    remaining = {key: value for key, value in attributes.items() if value}
    while remaining:
        try:
            api(token, "PATCH", path, {"data": {"type": resource_type, "id": resource_id, "attributes": remaining}})
            print(f"Updated {resource_type} {resource_id}: {', '.join(remaining)}")
            return
        except AppleError as error:
            rejected = set(rejected_attributes(error))
            dropped = [key for key in list(remaining) if key in rejected]
            if error.status not in (400, 409, 422) or not dropped:
                raise
            for key in dropped:
                print(f"Apple rejected {key}; leaving the current value")
                remaining.pop(key, None)


def first_data(payload: dict) -> dict | None:
    data = payload.get("data") or []
    return data[0] if data else None


def app_with_bundle_id(payload: dict, bundle_id: str) -> dict:
    """The app in an /v1/apps listing whose bundle ID is exactly bundle_id.
    filter[bundleId] can also return apps whose ID only starts the same."""
    apps = payload.get("data") or []
    for app in apps:
        if app.get("attributes", {}).get("bundleId") == bundle_id:
            return app
    found = ", ".join(sorted(a.get("attributes", {}).get("bundleId", "?") for a in apps)) or "none"
    raise SystemExit(f"No App Store Connect app has bundle id {bundle_id} (found: {found})")


def state_of(version: dict) -> str:
    attributes = version.get("attributes", {})
    return attributes.get("appStoreState") or attributes.get("state") or ""


def version_for(token: str, app_id: str, wanted: str) -> dict | None:
    """The App Store version to update for wanted, or None to leave the
    versions alone because another one is with Apple."""
    query = urllib.parse.urlencode({"filter[platform]": "IOS", "limit": "20"})
    versions = api(token, "GET", f"/v1/apps/{app_id}/appStoreVersions?{query}").get("data") or []
    for version in versions:
        if version.get("attributes", {}).get("versionString") == wanted:
            return version
    submitted = [v for v in versions if state_of(v) in SUBMITTED_STATES]
    if submitted:
        pending = submitted[0].get("attributes", {}).get("versionString")
        print(
            f"Store version {wanted} was not found, and {pending} is with Apple ({state_of(submitted[0])}). "
            "Leaving the versions and their listing alone until it's released or withdrawn."
        )
        return None
    editable = [v for v in versions if state_of(v) in EDITABLE_STATES]
    if editable:
        # A draft that was never submitted takes the version being released:
        # a build can only be submitted under its own number.
        chosen = editable[0]
        old = chosen.get("attributes", {}).get("versionString")
        print(f"Store version {wanted} was not found. Renaming the draft {old} to {wanted}.")
        patch_attributes(token, f"/v1/appStoreVersions/{chosen['id']}", "appStoreVersions", chosen["id"], {"versionString": wanted})
        return chosen
    created = api(token, "POST", "/v1/appStoreVersions", {
        "data": {
            "type": "appStoreVersions",
            "attributes": {"platform": "IOS", "versionString": wanted},
            "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
        }
    })
    print(f"Created App Store version {wanted}")
    return created["data"]


def localization_id(token: str, version_id: str, meta: dict) -> str:
    locale = meta["locale"]
    for item in api(token, "GET", f"/v1/appStoreVersions/{version_id}/appStoreVersionLocalizations").get("data") or []:
        if item.get("attributes", {}).get("locale") == locale:
            return item["id"]
    created = api(token, "POST", "/v1/appStoreVersionLocalizations", {
        "data": {
            "type": "appStoreVersionLocalizations",
            "attributes": {"locale": locale, "description": meta["description"], "keywords": meta["keywords"], "supportUrl": meta["supportUrl"]},
            "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": version_id}}},
        }
    })
    print(f"Created {locale} store listing")
    return created["data"]["id"]


def update_live_promotional_text(token: str, app_id: str, meta: dict, skip: str | None) -> None:
    """Puts the file's promotional text on the version people see now, which
    Apple allows at any time without review. skip is the version just
    updated, when that is the live one."""
    text = meta.get("promotionalText")
    if not text:
        return
    query = urllib.parse.urlencode({"filter[platform]": "IOS", "filter[appStoreState]": "READY_FOR_SALE", "limit": "1"})
    live = first_data(api(token, "GET", f"/v1/apps/{app_id}/appStoreVersions?{query}"))
    if live is None or live["id"] == skip:
        return
    for item in api(token, "GET", f"/v1/appStoreVersions/{live['id']}/appStoreVersionLocalizations").get("data") or []:
        if item.get("attributes", {}).get("locale") != meta["locale"]:
            continue
        if item["attributes"].get("promotionalText") != text:
            patch_attributes(token, f"/v1/appStoreVersionLocalizations/{item['id']}", "appStoreVersionLocalizations", item["id"], {"promotionalText": text})
            print(f"Promotional text updated on the live version {live['attributes'].get('versionString')}")
        return


def app_info_state(info: dict) -> str:
    attributes = info.get("attributes") or {}
    return attributes.get("state") or attributes.get("appStoreState") or ""


def update_app_info(token: str, app_id: str, meta: dict) -> None:
    infos = api(token, "GET", f"/v1/apps/{app_id}/appInfos").get("data") or []
    if not infos:
        print("No app info record yet. Name, subtitle, and category stay as they are.")
        return
    # The live record is locked; the other one takes the next version's changes.
    info = next((item for item in infos if app_info_state(item) not in LIVE_APP_INFO_STATES), infos[0])
    print(f"App info {info['id']} ({app_info_state(info) or 'no state'})")
    existing = api(token, "GET", f"/v1/appInfos/{info['id']}/appInfoLocalizations").get("data") or []
    for lm in locales(meta):
        locale = next((item for item in existing if item.get("attributes", {}).get("locale") == lm["locale"]), None)
        attributes = {"name": lm.get("name"), "subtitle": lm.get("subtitle"), "privacyPolicyUrl": lm.get("privacyPolicyUrl")}
        if locale is None and lm is meta and existing:
            locale = existing[0]
        if locale is None:
            try:
                api(token, "POST", "/v1/appInfoLocalizations", {
                    "data": {
                        "type": "appInfoLocalizations",
                        "attributes": {"locale": lm["locale"], **{k: v for k, v in attributes.items() if v}},
                        "relationships": {"appInfo": {"data": {"type": "appInfos", "id": info["id"]}}},
                    }
                })
                print(f"Created the {lm['locale']} name and subtitle")
            except AppleError as error:
                print(f"{lm['locale']} name and subtitle skipped: {error}")
            continue
        patch_attributes(token, f"/v1/appInfoLocalizations/{locale['id']}", "appInfoLocalizations", locale["id"], attributes)
    relationships = {}
    for key in ("primaryCategory", "secondaryCategory"):
        if meta.get(key):
            relationships[key] = {"data": {"type": "appCategories", "id": meta[key]}}
    if not relationships:
        return
    try:
        api(token, "PATCH", f"/v1/appInfos/{info['id']}", {"data": {"type": "appInfos", "id": info["id"], "relationships": relationships}})
        print(f"Updated categories: {meta.get('primaryCategory')}, {meta.get('secondaryCategory')}")
    except AppleError as error:
        print(f"Category update skipped: {error}")


def update_testflight(token: str, app_id: str, meta: dict) -> None:
    listed = api(token, "GET", f"/v1/apps/{app_id}/betaAppLocalizations").get("data") or []
    current = next((item for item in listed if item.get("attributes", {}).get("locale") == meta["locale"]), None)
    attributes = {"description": meta["description"], "marketingUrl": meta.get("marketingUrl"), "privacyPolicyUrl": meta.get("privacyPolicyUrl")}
    try:
        if current is None:
            api(token, "POST", "/v1/betaAppLocalizations", {
                "data": {
                    "type": "betaAppLocalizations",
                    "attributes": {"locale": meta["locale"], **{k: v for k, v in attributes.items() if v}},
                    "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
                }
            })
            print("Created TestFlight app information")
        else:
            patch_attributes(token, f"/v1/betaAppLocalizations/{current['id']}", "betaAppLocalizations", current["id"], attributes)
    except AppleError as error:
        print(f"TestFlight app information skipped: {error}")


def update_review_details(token: str, version_id: str, notes: str | None) -> None:
    """The App Review notes and demo account for the version."""
    site = os.environ.get("APP_REVIEW_SITE")
    email = os.environ.get("APP_REVIEW_EMAIL")
    password = os.environ.get("APP_REVIEW_PASSWORD")
    if not notes or not (site and email and password):
        print("App Review notes skipped: set APP_REVIEW_SITE, APP_REVIEW_EMAIL and APP_REVIEW_PASSWORD (docs/mobile.md)")
        return
    attributes = {
        "notes": notes.replace("{site}", site),
        "demoAccountRequired": True,
        "demoAccountName": email,
        "demoAccountPassword": password,
    }
    try:
        current = (api(token, "GET", f"/v1/appStoreVersions/{version_id}/appStoreReviewDetail") or {}).get("data")
        if current:
            api(token, "PATCH", f"/v1/appStoreReviewDetails/{current['id']}",
                {"data": {"type": "appStoreReviewDetails", "id": current["id"], "attributes": attributes}})
        else:
            api(token, "POST", "/v1/appStoreReviewDetails", {
                "data": {
                    "type": "appStoreReviewDetails",
                    "attributes": attributes,
                    "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": version_id}}},
                }
            })
        print(f"Updated the App Review notes and demo account ({site})")
    except AppleError as error:
        # The error can echo what was sent; never print the password.
        print(f"App Review notes skipped: Apple answered {error.status}")


def attach_build(token: str, app_id: str, version_id: str, version_string: str) -> None:
    """Selects the newest processed build of version_string for the version,
    so a release's upload is ready to submit. A build still processing is
    picked up by the next push."""
    query = urllib.parse.urlencode({
        "filter[app]": app_id,
        "filter[preReleaseVersion.version]": version_string,
        "filter[preReleaseVersion.platform]": "IOS",
        "filter[processingState]": "VALID",
        "filter[expired]": "false",
        "sort": "-uploadedDate",
        "limit": "1",
    })
    newest = first_data(api(token, "GET", f"/v1/builds?{query}"))
    if newest is None:
        print(f"No processed {version_string} build yet; select it in App Store Connect, or push again once it's processed.")
        return
    number = (newest.get("attributes") or {}).get("version")
    current = (api(token, "GET", f"/v1/appStoreVersions/{version_id}/build") or {}).get("data")
    if current and current.get("id") == newest["id"]:
        print(f"Build {version_string} ({number}) is already selected")
        return
    try:
        api(token, "PATCH", f"/v1/appStoreVersions/{version_id}/relationships/build", {"data": {"type": "builds", "id": newest["id"]}})
        print(f"Selected build {version_string} ({number})")
    except AppleError as error:
        print(f"Build {version_string} ({number}) couldn't be selected: {error}")


def main() -> None:
    meta = load_meta()
    if "--check" in sys.argv:
        print(f"{METADATA.relative_to(ROOT)} is within App Store field limits")
        return
    for name in ("ASC_API_KEY_ID", "ASC_API_ISSUER_ID", "ASC_API_KEY"):
        if not os.environ.get(name):
            raise SystemExit(f"Set {name} to push App Store metadata")
    bundle_id = os.environ.get("APPSTORE_BUNDLE_ID") or "com.yeix.northernlights"
    token = jwt()
    app_id = app_with_bundle_id(api(token, "GET", "/v1/apps?" + urllib.parse.urlencode({"filter[bundleId]": bundle_id})), bundle_id)["id"]
    print(f"App Store Connect app {app_id} ({bundle_id})")
    for lm in locales(meta):
        update_testflight(token, app_id, lm)
    wanted = os.environ.get("APPSTORE_VERSION") or meta.get("version") or "1.0.0"
    version = version_for(token, app_id, wanted)
    # The name, subtitle and categories live on an app info record that Apple
    # locks once the app is live; a new version gives it an editable copy, so
    # this runs after version_for.
    update_app_info(token, app_id, meta)
    for lm in locales(meta):
        update_live_promotional_text(token, app_id, lm, version["id"] if version else None)
    if version is None:
        print("App name, subtitle, and TestFlight text updated; the version listing was left as it is.")
        return
    version_id = version["id"]
    patch_attributes(token, f"/v1/appStoreVersions/{version_id}", "appStoreVersions", version_id, {"copyright": meta.get("copyright")})
    for lm in locales(meta):
        locale_id = localization_id(token, version_id, lm)
        patch_attributes(token, f"/v1/appStoreVersionLocalizations/{locale_id}", "appStoreVersionLocalizations", locale_id, {
            "description": lm["description"],
            "keywords": lm["keywords"],
            "promotionalText": lm.get("promotionalText"),
            "supportUrl": lm.get("supportUrl"),
            "marketingUrl": lm.get("marketingUrl"),
            # Apple refuses What's New on an app's first version.
            "whatsNew": lm.get("whatsNew"),
        })
        print(f"{lm['locale']} App Store listing updated from {METADATA.relative_to(ROOT)}")
    # A version with Apple, or live, keeps its build and review details.
    if state_of(version) in EDITABLE_STATES or not state_of(version):
        update_review_details(token, version_id, meta.get("reviewNotes"))
        attach_build(token, app_id, version_id, wanted)


if __name__ == "__main__":
    try:
        main()
    except AppleError as error:
        raise SystemExit(str(error))
