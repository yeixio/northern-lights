#!/usr/bin/env python3
"""Sign the app target's Release build with an App Store profile.

A PROVISIONING_PROFILE_SPECIFIER on the xcodebuild command line would land on
the Swift package targets too, which can't take one, so it goes into the
project file for the target with our bundle id only (the idea of yeixio/prox
apps/mobile/scripts/set-signing-profiles.mjs, without its dependencies).

  set-signing.py mobile/ios/App/App.xcodeproj com.yeix.northernlights "<profile name>" <team id>
"""
import re
import sys
from pathlib import Path

project, bundle_id, profile, team = sys.argv[1:5]
path = Path(project) / "project.pbxproj"
text = path.read_text()
# Each build configuration is "<id> /* Name */ = { isa = XCBuildConfiguration; buildSettings = { … }; name = …; };"
block = re.compile(r"isa = XCBuildConfiguration;\s*buildSettings = \{(?P<settings>.*?)\n\t\t\t\};\s*name = (?P<name>\w+);", re.S)
signed = 0


def sign(match: re.Match) -> str:
    global signed
    settings = match["settings"]
    if match["name"] != "Release" or f"PRODUCT_BUNDLE_IDENTIFIER = {bundle_id};" not in settings:
        return match[0]
    settings = re.sub(r"\n\t\t\t\t(CODE_SIGN_STYLE|PROVISIONING_PROFILE_SPECIFIER|DEVELOPMENT_TEAM|CODE_SIGN_IDENTITY) = [^;]*;", "", settings)
    settings += (
        f'\n\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";'
        f"\n\t\t\t\tCODE_SIGN_STYLE = Manual;"
        f"\n\t\t\t\tDEVELOPMENT_TEAM = {team};"
        f'\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "{profile}";'
    )
    signed += 1
    return match[0].replace(match["settings"], settings)


text = block.sub(sign, text)
if signed != 1:
    sys.exit(f"Expected one Release configuration for {bundle_id} in {project}, found {signed}")
path.write_text(text)
print(f"Signing {bundle_id} with {profile} (team {team})")
