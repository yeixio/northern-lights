#!/usr/bin/env python3
"""Push the Google Play store listing in packaging/googleplay/ to Play.

From yeixio/prox scripts/build/push-play-listing.py (itself from
yeixio/toskar-apps).

The contact details, each language's title and descriptions, and the
default language's graphics (icon, feature graphic, and any screenshots)
go up in one Play edit. Uses the same service account as push-play.py:
  PLAY_SERVICE_ACCOUNT_JSON   path to the service account's JSON key

  push-play-listing.py           push it
  push-play-listing.py --check   validate it without calling Google

Play Console keeps the rest by hand: the privacy policy link, app content
declarations, content rating, data safety, pricing, and countries. See
docs/mobile.md.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / "packaging" / "googleplay"
LISTING = FOLDER / "listing.json"
LIMITS = {"title": 30, "shortDescription": 80, "fullDescription": 4000}
# Play's listing languages the app may use.
LANGUAGES = {"en-US", "de-DE", "es-ES", "es-419", "fr-FR", "it-IT", "ja-JP", "ko-KR", "pt-BR", "zh-CN", "zh-TW"}
# Each graphic's exact size, or (min, max) for each side of a screenshot.
IMAGES = {
    "icon": (512, 512),
    "featureGraphic": (1024, 500),
}
SCREENSHOTS = {"phoneScreenshots": (320, 3840), "sevenInchScreenshots": (320, 3840), "tenInchScreenshots": (320, 3840)}

spec = importlib.util.spec_from_file_location("push_play", Path(__file__).with_name("push-play.py"))
push_play = importlib.util.module_from_spec(spec)
spec.loader.exec_module(push_play)


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        header = handle.read(24)
    if header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} isn't a PNG")
    return struct.unpack(">II", header[16:24])


def check(listing: dict) -> list[str]:
    problems: list[str] = []
    default = listing.get("defaultLanguage")
    if default not in listing.get("listings", {}):
        problems.append(f"defaultLanguage {default!r} has no listing")
    for language, texts in listing.get("listings", {}).items():
        if language not in LANGUAGES:
            problems.append(f"{language}: not one of Play's listing languages here ({', '.join(sorted(LANGUAGES))})")
        for field, limit in LIMITS.items():
            value = texts.get(field, "")
            if not value:
                problems.append(f"{language}: {field} is empty")
            elif len(value) > limit:
                problems.append(f"{language}: {field} is {len(value)} characters; Play allows {limit}")
    for kind, relative in listing.get("images", {}).items():
        paths = sorted((FOLDER / relative).glob("*.png")) if kind in SCREENSHOTS else [FOLDER / relative]
        if kind not in IMAGES and kind not in SCREENSHOTS:
            problems.append(f"images.{kind}: not a Play graphic type")
            continue
        if not paths or not all(path.exists() for path in paths):
            problems.append(f"images.{kind}: {relative} not found")
            continue
        for path in paths:
            width, height = png_size(path)
            if kind in IMAGES and (width, height) != IMAGES[kind]:
                problems.append(f"{path.relative_to(ROOT)}: {width}x{height}; Play wants {IMAGES[kind][0]}x{IMAGES[kind][1]}")
            if kind in SCREENSHOTS:
                low, high = SCREENSHOTS[kind]
                if not (low <= width <= high and low <= height <= high) or max(width, height) > 2 * min(width, height):
                    problems.append(f"{path.relative_to(ROOT)}: {width}x{height}; Play wants sides of {low}–{high} px, at most 2:1")
        if kind in SCREENSHOTS and not 2 <= len(paths) <= 8:
            problems.append(f"images.{kind}: {len(paths)} screenshots; Play wants 2 to 8")
    return problems


def push(listing: dict) -> None:
    key_path = os.environ.get("PLAY_SERVICE_ACCOUNT_JSON")
    if not key_path:
        raise SystemExit("Set PLAY_SERVICE_ACCOUNT_JSON to the service account's JSON key path")
    with open(key_path) as handle:
        token = push_play.access_token(json.load(handle))
    package = listing["packageName"]
    base = f"{push_play.API}/{package}/edits"
    upload = f"{push_play.UPLOAD}/{package}/edits"
    edit = push_play.call(token, "POST", base, {})["id"]
    print(f"Play edit {edit} for {package}")

    details = {"defaultLanguage": listing["defaultLanguage"]}
    for field in ("contactEmail", "contactWebsite", "contactPhone"):
        if listing.get(field):
            details[field] = listing[field]
    push_play.call(token, "PATCH", f"{base}/{edit}/details", details)
    print(f"Details: {', '.join(f'{k} {v}' for k, v in details.items())}")

    for language, texts in listing["listings"].items():
        body = {"language": language, **{field: texts[field] for field in LIMITS}}
        push_play.call(token, "PUT", f"{base}/{edit}/listings/{language}", body)
        print(f"Listing {language}: {texts['title']}")

    # Graphics on the default language; Play shows them for the other languages too.
    language = listing["defaultLanguage"]
    for kind, relative in listing.get("images", {}).items():
        paths = sorted((FOLDER / relative).glob("*.png")) if kind in SCREENSHOTS else [FOLDER / relative]
        push_play.call(token, "DELETE", f"{base}/{edit}/listings/{language}/{kind}")
        for path in paths:
            push_play.call(
                token,
                "POST",
                f"{upload}/{edit}/listings/{language}/{kind}?uploadType=media",
                data=path.read_bytes(),
                content_type="image/png",
            )
        print(f"Graphics {kind}: {len(paths)} uploaded")

    push_play.call(token, "POST", f"{base}/{edit}:commit")
    print("Committed the store listing")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true", help="validate the listing without calling Google")
    args = parser.parse_args()
    listing = json.loads(LISTING.read_text())
    problems = check(listing)
    if problems:
        print("The Play listing has problems:", file=sys.stderr)
        for problem in problems:
            print(f"  {problem}", file=sys.stderr)
        return 1
    print(f"{LISTING.relative_to(ROOT)} is valid: {len(listing['listings'])} languages, graphics {', '.join(listing.get('images', {}))}")
    if args.check:
        return 0
    try:
        push(listing)
    except push_play.PlayError as error:
        raise SystemExit(str(error))
    return 0


if __name__ == "__main__":
    sys.exit(main())
