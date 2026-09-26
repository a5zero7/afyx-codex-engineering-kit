#!/usr/bin/env python3
"""Independence gate: the working tree must carry no legacy product identity.

The forbidden tokens are assembled from neutral fragments, so this file never
contains them and is scanned like every other file. There is no allowlist:
file contents, tracked and untracked file names, and directory names must all be
free of the legacy identity. Matches are redacted in the output. Zero-token and
deterministic; reads the repository only.

usage: audit-legacy-identity.py [--root DIR]
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

FORBIDDEN_TOKENS = ("code" + "graph", "colby" + "mchenry")
PATTERN = re.compile("|".join(re.escape(token) for token in FORBIDDEN_TOKENS), re.IGNORECASE)
REDACTION = "<legacy-identity>"
SKIPPED_DIRECTORIES = {".git", "node_modules"}


def repository_files(root: Path) -> list[str]:
    out = subprocess.run(
        ["git", "-C", str(root), "ls-files", "--cached", "--others", "--exclude-standard"],
        capture_output=True, text=True, check=True,
    ).stdout
    return [line for line in out.splitlines() if line and (root / line).is_file()]


def directory_names(root: Path) -> list[str]:
    found: list[str] = []
    for current, dirs, _files in os.walk(root):
        dirs[:] = [name for name in dirs if name not in SKIPPED_DIRECTORIES]
        for name in dirs:
            if PATTERN.search(name):
                found.append(Path(current, name).relative_to(root).as_posix())
    return found


def redact(text: str) -> str:
    return PATTERN.sub(REDACTION, text)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    root = Path(parser.parse_args().root).resolve()

    findings: list[str] = []
    for rel in repository_files(root):
        if PATTERN.search(rel):
            findings.append(f"{redact(rel)}: file name carries the legacy identity")
        try:
            text = (root / rel).read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        hits = [(number, line.strip()) for number, line in enumerate(text.splitlines(), start=1) if PATTERN.search(line)]
        for number, line in hits[:3]:
            findings.append(f"{redact(rel)}:{number}: {redact(line)[:120]}")
        if len(hits) > 3:
            findings.append(f"{redact(rel)}: ... {len(hits) - 3} more")
    for directory in directory_names(root):
        findings.append(f"{redact(directory)}/: directory name carries the legacy identity")

    if findings:
        print("Legacy identity found in the working tree:")
        for finding in findings:
            print(f"  {finding}")
        print(f"Legacy identity audit: FAIL ({len(findings)} finding line(s))")
        return 1
    print("Legacy identity audit: PASS (contents, file names and directory names are clean)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
