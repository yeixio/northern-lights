#!/usr/bin/env python3
"""Check that every native library in an Android build supports 16 KB pages.

Android 15+ devices with 16 KB memory pages, and Google Play for apps that
target Android 15+, need each 64-bit .so built with LOAD segments aligned
to at least 16 KB (-Wl,-z,max-page-size=16384), and, in an APK, each
uncompressed one stored at a 16 KB offset (zipalign -P 16). 32-bit libraries
(armeabi-v7a, x86) never run with 16 KB pages, so they're skipped.
From yeixio/toskar-apps (#209 there).

  check-16k-alignment.py app-release.apk [app-release.aab ...] [lib.so ...]

An App Bundle's libraries are checked as ELF files only: bundletool aligns
them when it makes the APKs phones install. Exits 1 when any library fails,
naming each one.
"""
import struct
import sys
import zipfile

PAGE = 16384
PT_LOAD = 1
SKIP = "32-bit"


def elf_problem(data):
    """Why an ELF file doesn't support 16 KB pages, or None when it does."""
    if data[:4] != b"\x7fELF":
        return "not an ELF file"
    is64 = data[4] == 2
    if not is64:
        return SKIP
    endian = "<" if data[5] == 1 else ">"
    phoff, = struct.unpack_from(endian + "Q", data, 0x20)
    phentsize, phnum = struct.unpack_from(endian + "HH", data, 0x36)
    loads = 0
    for i in range(phnum):
        off = phoff + i * phentsize
        p_type, = struct.unpack_from(endian + "I", data, off)
        if p_type != PT_LOAD:
            continue
        loads += 1
        p_align, = struct.unpack_from(endian + "Q", data, off + 0x30)
        if p_align < PAGE or p_align % PAGE:
            return f"LOAD segment aligned to {p_align} bytes, not {PAGE}"
    if loads == 0:
        return "no LOAD segments"
    return None


def data_offset(archive, info):
    """Where an entry's bytes start in the zip, after its local header."""
    archive.fp.seek(info.header_offset)
    header = archive.fp.read(30)
    name_len, extra_len = struct.unpack_from("<HH", header, 26)
    return info.header_offset + 30 + name_len + extra_len


def check_zip(path):
    problems, count = [], 0
    is_apk = path.endswith(".apk")
    with zipfile.ZipFile(path) as archive:
        for info in archive.infolist():
            name = info.filename
            if not name.endswith(".so"):
                continue
            problem = elf_problem(archive.read(info))
            if problem == SKIP:
                continue
            count += 1
            if problem is None and is_apk and info.compress_type == zipfile.ZIP_STORED:
                offset = data_offset(archive, info)
                if offset % PAGE:
                    problem = f"stored uncompressed at offset {offset}, not on a 16 KB boundary"
            if problem:
                problems.append(f"{path}!{name}: {problem}")
    return problems, count


def main(paths):
    if not paths:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    problems, count = [], 0
    for path in paths:
        if path.endswith((".apk", ".aab", ".aar", ".zip")):
            found, n = check_zip(path)
            problems += found
            count += n
        else:
            with open(path, "rb") as f:
                problem = elf_problem(f.read())
            if problem == SKIP:
                continue
            count += 1
            if problem:
                problems.append(f"{path}: {problem}")
    for problem in problems:
        print(f"::error::Not 16 KB aligned: {problem}")
    if count == 0:
        print("::error::No 64-bit native libraries found to check.")
        return 1
    if problems:
        print(f"{len(problems)} of {count} 64-bit native libraries don't support 16 KB pages.")
        return 1
    print(f"All {count} 64-bit native libraries support 16 KB pages.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
