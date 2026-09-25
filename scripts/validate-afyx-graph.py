#!/usr/bin/env python3
"""Static Afyx Graph metadata/attribution validation; no network or model calls."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
metadata_path = ROOT / "afyx-codegraph" / "afyx-graph.json"
package_path = ROOT / "afyx-codegraph" / "codegraph-main" / "package.json"
ui_package_path = ROOT / "afyx-codegraph" / "codegraph-main" / "ui" / "package.json"
license_path = ROOT / "afyx-codegraph" / "LICENSES" / "CodeGraph-MIT.txt"
notices_path = ROOT / "afyx-codegraph" / "THIRD_PARTY_NOTICES.md"

metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
package = json.loads(package_path.read_text(encoding="utf-8"))
ui_package = json.loads(ui_package_path.read_text(encoding="utf-8"))
required = {
    "product_name",
    "afyx_graph_version",
    "engine_name",
    "codegraph_upstream_version",
    "codegraph_upstream_repository",
    "codegraph_upstream_commit",
    "license",
    "supported_platforms",
    "build_runtime_version",
}
missing = sorted(required - metadata.keys())
if missing:
    raise SystemExit(f"Afyx Graph metadata missing: {', '.join(missing)}")
if metadata["product_name"] != "Afyx Graph" or package["name"] != "@a5zero7/afyx-graph":
    raise SystemExit("Afyx Graph product/package identity mismatch")
if metadata["afyx_graph_version"] != package["version"]:
    raise SystemExit("Afyx Graph metadata and package versions differ")
if ui_package["name"] != "@a5zero7/afyx-graph-ui" or ui_package["version"] != package["version"]:
    raise SystemExit("Afyx Graph UI package identity/version mismatch")
if package.get("bin", {}).get("afyx-graph") != "./dist/bin/codegraph.js":
    raise SystemExit("Canonical afyx-graph CLI is missing")
if "Copyright (c) 2026 Colby Mchenry" not in license_path.read_text(encoding="utf-8"):
    raise SystemExit("Original CodeGraph copyright is missing")
if metadata["codegraph_upstream_repository"] not in notices_path.read_text(encoding="utf-8"):
    raise SystemExit("Upstream repository attribution is missing")
print("Afyx Graph metadata and attribution: PASS")
