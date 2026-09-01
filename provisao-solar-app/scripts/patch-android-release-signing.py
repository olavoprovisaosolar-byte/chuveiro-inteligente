#!/usr/bin/env python3
"""Ensure the Android release buildType uses the debug keystore for internal APKs."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "android/app/build.gradle")
    if not path.exists():
        print(f"ERROR: missing {path}", file=sys.stderr)
        return 1

    text = path.read_text()

    # Expo/RN templates usually already point release -> debug signing for convenience.
    release_match = re.search(r"release\s*\{.*?^\s*\}", text, flags=re.M | re.S)
    if release_match and "signingConfig signingConfigs.debug" in release_match.group(0):
        print("Release already uses signingConfigs.debug")
        return 0

    patched, count = re.subn(
        r"(release\s*\{)",
        r"\1\n            signingConfig signingConfigs.debug",
        text,
        count=1,
    )
    if count == 0:
        print("ERROR: could not find release buildType block", file=sys.stderr)
        return 1

    path.write_text(patched)
    print(f"Patched {path}: release now uses signingConfigs.debug")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
