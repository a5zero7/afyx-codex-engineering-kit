#!/usr/bin/env python3
"""Static Afyx Graph identity, metadata and attribution validation.

Zero-token and deterministic: reads repository files only. No network, no model
calls, no build. The canonical product identity is declared once in
afyx-graph/engine/src/product.ts; this script proves the operational metadata,
package manifest and CLI entry all agree with it.
"""

from __future__ import annotations

import json
import re
import tarfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH = ROOT / "afyx-graph"
ENGINE = GRAPH / "engine"
metadata_path = GRAPH / "afyx-graph.json"
package_path = ENGINE / "package.json"
ui_package_path = ENGINE / "ui" / "package.json"
product_path = ENGINE / "src" / "product.ts"
license_path = GRAPH / "LICENSES" / "THIRD_PARTY_ENGINE_MIT.txt"
engine_license_path = ENGINE / "LICENSE"
notices_path = GRAPH / "THIRD_PARTY_NOTICES.md"
bundle_script_path = ENGINE / "scripts" / "build-bundle.sh"
release_dir = ENGINE / "release"
installer_paths = (ROOT / "scripts" / "install-afyx-graph.ps1", ROOT / "scripts" / "install-afyx-graph.sh")

# Legal attribution that must stay intact, and the neutral files that carry it.
COPYRIGHT_LINE = "Copyright (c) 2026 Colby Mchenry"
LICENSE_MARKERS = (
    "MIT License",
    "Permission is hereby granted, free of charge",
    "The above copyright notice and this permission notice shall be included in all",
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND',
)
LEGAL_FILES = ("THIRD_PARTY_NOTICES.md", "THIRD_PARTY_ENGINE_MIT.txt")

REQUIRED_METADATA = {
    "product_name",
    "product_version",
    "package",
    "repository",
    "cli",
    "runtime_path",
    "state_directory",
    "database_filename",
    "mcp_server",
    "supported_platforms",
    "license",
}


def fail(message: str) -> None:
    raise SystemExit(f"Afyx Graph validation failed: {message}")


def product_constant(source: str, name: str) -> str:
    match = re.search(rf"export const {name}\s*=\s*'([^']*)';", source)
    if not match:
        fail(f"src/product.ts does not declare {name} as a string constant")
    return match.group(1)


metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
package = json.loads(package_path.read_text(encoding="utf-8"))
ui_package = json.loads(ui_package_path.read_text(encoding="utf-8"))
product = product_path.read_text(encoding="utf-8")

missing = sorted(REQUIRED_METADATA - metadata.keys())
if missing:
    fail(f"metadata missing: {', '.join(missing)}")
extra = sorted(metadata.keys() - REQUIRED_METADATA)
if extra:
    fail(f"operational metadata must hold exactly the Afyx Graph fields; unexpected: {', '.join(extra)}")

if metadata["product_name"] != "Afyx Graph" or package["name"] != "@a5zero7/afyx-graph":
    fail("product/package identity mismatch")
if metadata["package"] != package["name"]:
    fail("metadata package differs from package.json name")
if metadata["product_version"] != package["version"]:
    fail("metadata and package versions differ")
if ui_package["name"] != "@a5zero7/afyx-graph-ui" or ui_package["version"] != package["version"]:
    fail("UI package identity/version mismatch")

# CLI: exactly one binary, generated at dist/bin/afyx-graph.js.
if package.get("bin") != {"afyx-graph": "./dist/bin/afyx-graph.js"}:
    fail(f"package bin must expose only afyx-graph -> ./dist/bin/afyx-graph.js, got {package.get('bin')!r}")
if not (ENGINE / "src" / "bin" / "afyx-graph.ts").is_file():
    fail("src/bin/afyx-graph.ts (CLI source) is missing")

# Canonical identity constants: product.ts is the single source of truth.
expected = {
    "PRODUCT_NAME": metadata["product_name"],
    "CLI_NAME": metadata["cli"],
    "MCP_SERVER_NAME": metadata["mcp_server"],
    "STATE_DIR_NAME": metadata["state_directory"],
    "DATABASE_FILE_NAME": metadata["database_filename"],
}
for name, value in expected.items():
    actual = product_constant(product, name)
    if actual != value:
        fail(f"product.ts {name}={actual!r} but metadata declares {value!r}")
if product_constant(product, "ENV_PREFIX") != "AFYX_GRAPH_":
    fail("environment prefix must be AFYX_GRAPH_")
if product_constant(product, "MCP_TOOL_PREFIX") != metadata["mcp_server"] + "_":
    fail("MCP tool prefix must be the MCP server name plus an underscore")
if metadata["state_directory"] != ".afyx-graph" or metadata["database_filename"] != "afyx-graph.db":
    fail("state directory and database filename must be .afyx-graph / afyx-graph.db")

# Legal attribution stays intact, in neutrally named files.
license_text = license_path.read_text(encoding="utf-8")
if COPYRIGHT_LINE not in license_text:
    fail(f"original copyright line {COPYRIGHT_LINE!r} is missing from LICENSES/THIRD_PARTY_ENGINE_MIT.txt")
for marker in LICENSE_MARKERS:
    if marker not in license_text:
        fail(f"MIT license text is incomplete: missing {marker!r}")
if license_text.splitlines() != engine_license_path.read_text(encoding="utf-8").splitlines():
    fail("engine/LICENSE and LICENSES/THIRD_PARTY_ENGINE_MIT.txt must be identical")
notices_text = notices_path.read_text(encoding="utf-8")
if "Colby Mchenry" not in notices_text or "LICENSES/THIRD_PARTY_ENGINE_MIT.txt" not in notices_text:
    fail("THIRD_PARTY_NOTICES.md must credit the original author and point to LICENSES/THIRD_PARTY_ENGINE_MIT.txt")
if re.search(r"https?://", notices_text):
    fail("THIRD_PARTY_NOTICES.md must not carry operational URLs")

# Every bundle must ship both legal files: the build script copies them and both installers require them.
bundle_script = bundle_script_path.read_text(encoding="utf-8")
for legal_file in LEGAL_FILES:
    if f"licenses/{legal_file}" not in bundle_script:
        fail(f"build-bundle.sh does not ship licenses/{legal_file}")
    for installer in installer_paths:
        installer_text = installer.read_text(encoding="utf-8")
        if legal_file not in installer_text:
            fail(f"{installer.name} does not require licenses/{legal_file} in a staged bundle")

# Any locally built bundle must contain both legal files.
if release_dir.is_dir():
    for archive in sorted(release_dir.glob("afyx-graph-*")):
        if archive.suffix == ".zip":
            with zipfile.ZipFile(archive) as bundle:
                names = bundle.namelist()
        elif archive.name.endswith(".tar.gz"):
            with tarfile.open(archive) as bundle:
                names = bundle.getnames()
        else:
            continue
        for legal_file in LEGAL_FILES:
            if not any(name.endswith(f"/licenses/{legal_file}") for name in names):
                fail(f"{archive.name} does not contain licenses/{legal_file}")

print("Afyx Graph identity, metadata and attribution: PASS")
