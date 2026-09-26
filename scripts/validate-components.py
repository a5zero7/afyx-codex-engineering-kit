#!/usr/bin/env python3
"""Static validation of the Afyx component contract (scripts/components.json).

Zero-token and deterministic. Proves the single component truth is well formed,
readable by both the PowerShell module and the Bash library (one "key": "value"
per line), and consistent with the files the kit actually ships.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "scripts" / "components.json"

TYPES = {"skill", "runtime", "toolset", "detected-cli"}
TIERS = {"core", "optional", "external"}
OWNERSHIP = {"afyx", "upstream", "external"}
PLATFORMS = {"all", "windows"}
INSTALL_ROOTS = {"skills_root", "afyx_graph_root", "codex_tools", ""}
REQUIRED_KEYS = {"id", "name", "type", "tier", "ownership", "platforms", "install_root", "install_path"}
EXPECTED_IDS = ["efficient-coding", "odoo-engineering", "prompt-master", "afyx-graph", "codex-usage-tracking", "headroom"]
LINE_RE = re.compile(r'^\s*"[a-z_]+":\s*"[^"\\]*",?\s*$')


def fail(message: str) -> None:
    raise SystemExit(f"Component contract validation failed: {message}")


text = CONTRACT.read_text(encoding="utf-8")
document = json.loads(text)
if document.get("schema_version") != 1:
    fail("schema_version must be 1")
components = document["components"]

# The Bash reader parses one scalar "key": "value" per line inside each object.
inside = False
for number, line in enumerate(text.splitlines(), start=1):
    stripped = line.strip()
    if stripped == "{" and number > 1 and inside is False and line.startswith("    "):
        inside = True
        continue
    if inside and stripped in ("}", "},"):
        inside = False
        continue
    if inside and not LINE_RE.match(line):
        fail(f"line {number} is not a single scalar \"key\": \"value\" pair: {line.strip()!r}")

ids = [component["id"] for component in components]
if ids != EXPECTED_IDS:
    fail(f"component ids must be exactly {EXPECTED_IDS}, got {ids}")
if len(set(ids)) != len(ids):
    fail("duplicate component id")

for component in components:
    cid = component["id"]
    missing = REQUIRED_KEYS - component.keys()
    if missing:
        fail(f"{cid}: missing keys {sorted(missing)}")
    for key, value in component.items():
        if not isinstance(value, str):
            fail(f"{cid}.{key} must be a string")
    if component["type"] not in TYPES:
        fail(f"{cid}: unknown type {component['type']}")
    if component["tier"] not in TIERS:
        fail(f"{cid}: unknown tier {component['tier']}")
    if component["ownership"] not in OWNERSHIP:
        fail(f"{cid}: unknown ownership {component['ownership']}")
    if component["platforms"] not in PLATFORMS:
        fail(f"{cid}: unknown platforms {component['platforms']}")
    if component["install_root"] not in INSTALL_ROOTS:
        fail(f"{cid}: unknown install_root {component['install_root']}")
    if component["tier"] == "core" and component["ownership"] == "external":
        fail(f"{cid}: a core component cannot be externally owned")

by_id = {component["id"]: component for component in components}

# Bundled skills must ship exactly what the contract requires.
for cid in ("efficient-coding", "odoo-engineering"):
    component = by_id[cid]
    skill_dir = ROOT / "skills" / component["install_path"]
    for relative in component["required_files"].split(";"):
        if not (skill_dir / relative).is_file():
            fail(f"{cid}: required file {relative} is missing from the bundled skill")
    manifest = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
    if not re.search(r"(?m)^name:\s*" + re.escape(cid) + r"\s*$", manifest):
        fail(f"{cid}: SKILL.md name does not match the component id")
    if component["version_required"] == "true" and not re.search(r'(?ms)^metadata:\s*\n\s+version:\s*["\'][^"\']+["\']', manifest):
        fail(f"{cid}: SKILL.md metadata.version is required by the contract")
if by_id["prompt-master"]["ownership"] != "upstream" or not by_id["prompt-master"].get("source", "").endswith(".git"):
    fail("prompt-master must be upstream-owned with a git source")

# The graph component must agree with the operational metadata.
graph = by_id["afyx-graph"]
metadata = json.loads((ROOT / "afyx-graph" / "afyx-graph.json").read_text(encoding="utf-8"))
if graph["marker_value"] != metadata["product_name"]:
    fail("afyx-graph marker_value differs from metadata product_name")
if graph["marker_field"] not in metadata:
    fail("afyx-graph marker_field is not a metadata field")
version_field = graph["version_source"].split("#", 1)[1]
if version_field not in metadata:
    fail("afyx-graph version_source is not a metadata field")
if metadata["cli"] not in graph["required_files_unix"] or f"{metadata['cli']}.cmd" not in graph["required_files_windows"]:
    fail("afyx-graph launcher files must match the metadata CLI name")

# The usage tracker contract must list files the kit actually ships.
usage = by_id["codex-usage-tracking"]
for relative in usage["required_files"].split(";"):
    if not (ROOT / "tools" / "codex-usage" / relative).is_file():
        fail(f"codex-usage-tracking: {relative} is not shipped in tools/codex-usage")

print(f"Afyx component contract: PASS ({len(components)} components)")
