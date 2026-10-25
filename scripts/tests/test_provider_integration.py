#!/usr/bin/env python3
"""Isolated multi-provider lifecycle tests; no live host configuration is used."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / "scripts/afyx-provider-integration.mjs"


def fake_server(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        """const readline=require('node:readline');
const lines=readline.createInterface({input:process.stdin});
lines.on('line',(line)=>{const m=JSON.parse(line);if(m.id===1)console.log(JSON.stringify({jsonrpc:'2.0',id:1,result:{protocolVersion:'2025-11-25',capabilities:{},serverInfo:{name:'afyx_graph',version:'1.0.0'}}}));if(m.id===2)console.log(JSON.stringify({jsonrpc:'2.0',id:2,result:{tools:[{name:'afyx_graph_explore'}]}}));});
""",
        encoding="utf-8",
    )


class ProviderIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.base = Path(self.temporary.name)
        self.gemini = self.base / "gemini"
        self.workspace = self.base / "workspace"
        self.entry = self.base / "runtime/current/lib/dist/bin/afyx-graph.js"
        fake_server(self.entry)
        self.node = shutil.which("node") or "node"

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def run_helper(self, *extra: str, expected: int = 0) -> dict:
        command = [
            "node", str(HELPER), "--providers", "antigravity",
            "--node", self.node, "--entry", str(self.entry),
            "--gemini-home", str(self.gemini), "--workspace-root", str(self.workspace),
            *extra,
        ]
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return json.loads(result.stdout)

    def test_global_plan_is_side_effect_free_then_apply_is_idempotent(self) -> None:
        planned = self.run_helper("--scope", "global")
        self.assertEqual(planned["status"], "PARTIAL")
        self.assertEqual(planned["providers"][0]["action"], "CREATE")
        self.assertFalse(self.gemini.exists())

        first = self.run_helper("--scope", "global", "--apply")
        self.assertEqual(first["status"], "CONFIGURED_RESTART_REQUIRED")
        self.assertTrue(first["providers"][0]["changed"])
        config = self.gemini / "config/mcp_config.json"
        document = json.loads(config.read_text(encoding="utf-8"))
        self.assertEqual(os.path.normcase(document["mcpServers"]["afyx_graph"]["command"]), os.path.normcase(str(Path(self.node).resolve())))
        self.assertEqual(os.path.normcase(document["mcpServers"]["afyx_graph"]["args"][0]), os.path.normcase(str(self.entry.resolve())))
        self.assertEqual(document["mcpServers"]["afyx_graph"]["args"][1:], ["serve", "--mcp"])

        second = self.run_helper("--scope", "global", "--apply")
        self.assertFalse(second["providers"][0]["changed"])
        self.assertEqual(second["providers"][0]["status"], "CONFIGURED_RESTART_REQUIRED")

    def test_workspace_preserves_unrelated_config_and_uninstalls_only_owned_entry(self) -> None:
        config = self.workspace / ".agents/mcp_config.json"
        config.parent.mkdir(parents=True)
        original = {"theme": "preserve", "mcpServers": {"other": {"command": "other"}}}
        config.write_text(json.dumps(original), encoding="utf-8")

        applied = self.run_helper("--scope", "workspace", "--apply")
        self.assertEqual(applied["status"], "READY")
        after = json.loads(config.read_text(encoding="utf-8"))
        self.assertEqual(after["theme"], "preserve")
        self.assertEqual(after["mcpServers"]["other"], {"command": "other"})

        removed = self.run_helper("--scope", "workspace", "--apply", "--uninstall")
        self.assertTrue(removed["providers"][0]["changed"])
        self.assertEqual(json.loads(config.read_text(encoding="utf-8")), original)

    def test_foreign_and_matching_unowned_entries_are_never_replaced_or_removed(self) -> None:
        config = self.gemini / "config/mcp_config.json"
        config.parent.mkdir(parents=True)
        foreign = {"mcpServers": {"afyx_graph": {"command": "python", "args": ["foreign.py"]}}}
        config.write_text(json.dumps(foreign), encoding="utf-8")
        blocked = self.run_helper("--scope", "global", "--apply", expected=2)
        self.assertEqual(blocked["providers"][0]["reason"], "FOREIGN_ENTRY")
        self.assertEqual(json.loads(config.read_text(encoding="utf-8")), foreign)

        matching = {"mcpServers": {"afyx_graph": {"command": str(Path(self.node).resolve()), "args": [str(self.entry.resolve()), "serve", "--mcp"]}}}
        config.write_text(json.dumps(matching), encoding="utf-8")
        verified = self.run_helper("--scope", "global", "--apply")
        self.assertFalse(verified["providers"][0]["changed"])
        self.assertEqual(verified["providers"][0]["state"], "MCP_CONFIGURED_UNOWNED")
        refused = self.run_helper("--scope", "global", "--apply", "--uninstall", expected=2)
        self.assertEqual(refused["providers"][0]["reason"], "UNOWNED_ENTRY")
        self.assertEqual(json.loads(config.read_text(encoding="utf-8")), matching)

    def test_owned_stale_entry_updates_but_tampered_claim_fails_closed(self) -> None:
        self.run_helper("--scope", "workspace", "--apply")
        config = self.workspace / ".agents/mcp_config.json"
        document = json.loads(config.read_text(encoding="utf-8"))
        document["mcpServers"]["afyx_graph"]["args"][0] = str(self.base / "old/afyx-graph.js")
        config.write_text(json.dumps(document), encoding="utf-8")
        blocked = self.run_helper("--scope", "workspace", "--apply", expected=2)
        self.assertEqual(blocked["providers"][0]["reason"], "FOREIGN_ENTRY")

    def test_invalid_json_fails_closed_without_rewrite(self) -> None:
        config = self.gemini / "config/mcp_config.json"
        config.parent.mkdir(parents=True)
        config.write_text("not json\n", encoding="utf-8")
        before = config.read_bytes()
        blocked = self.run_helper("--scope", "global", "--apply", expected=2)
        self.assertEqual(blocked["providers"][0]["reason"], "INSPECTION_FAILED")
        self.assertEqual(config.read_bytes(), before)

    def test_legacy_duplicate_is_reported_and_preserved(self) -> None:
        legacy = self.gemini / "antigravity/mcp_config.json"
        legacy.parent.mkdir(parents=True)
        original = {"mcpServers": {"afyx_graph": {"command": "legacy", "args": []}}, "keep": True}
        legacy.write_text(json.dumps(original), encoding="utf-8")
        blocked = self.run_helper("--scope", "global", "--apply", expected=2)
        self.assertEqual(blocked["providers"][0]["reason"], "LEGACY_DUPLICATE")
        self.assertEqual(json.loads(legacy.read_text(encoding="utf-8")), original)
        self.assertFalse((self.gemini / "config/mcp_config.json").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
