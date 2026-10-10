#!/usr/bin/env python3
"""AFYX-256 registration tests use only isolated CODEX_HOME fixtures."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / "scripts/afyx-mcp-integration.mjs"


def codex_path() -> str | None:
    return shutil.which("codex.exe") if os.name == "nt" else shutil.which("codex")


def fake_server(path: Path, healthy: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if healthy:
        path.write_text(
            """const readline=require('node:readline');
const lines=readline.createInterface({input:process.stdin});
lines.on('line',(line)=>{const m=JSON.parse(line);if(m.id===1)console.log(JSON.stringify({jsonrpc:'2.0',id:1,result:{protocolVersion:'2025-11-25',capabilities:{},serverInfo:{name:'afyx_graph',version:'1.0.0'}}}));if(m.id===2)console.log(JSON.stringify({jsonrpc:'2.0',id:2,result:{tools:[{name:'afyx_graph_explore'}]}}));});
""",
            encoding="utf-8",
        )
    else:
        path.write_text("setTimeout(()=>{},30000);\n", encoding="utf-8")


class McpIntegrationTests(unittest.TestCase):
    def test_classifier_distinguishes_current_stale_and_conflict(self) -> None:
        expected = {"node": "C:/node/node.exe", "entry": "C:/runtime/current/lib/dist/bin/afyx-graph.js"}
        script = f"""import {{classifyEntry}} from {json.dumps(HELPER.as_uri())};
const expected={json.dumps(expected)};
const current={{transport:{{type:'stdio',command:'C:/node/node.exe',args:[expected.entry,'serve','--mcp']}}}};
const stale={{transport:{{type:'stdio',command:'node',args:['C:/old/lib/dist/bin/afyx-graph.js','serve','--mcp']}}}};
const conflict={{transport:{{type:'stdio',command:'python',args:['other.py']}}}};
console.log(JSON.stringify([classifyEntry(null,expected),classifyEntry(current,expected),classifyEntry(stale,expected),classifyEntry(conflict,expected)]));"""
        result = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(result.stdout), ["MCP_NOT_CONFIGURED", "MCP_CONFIGURED", "MCP_STALE_OWNED", "MCP_BLOCKED"])

    @unittest.skipUnless(codex_path(), "Codex CLI unavailable on this runner")
    def test_native_registration_is_idempotent_and_preserves_unrelated_config(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            base = Path(raw)
            codex_home = base / "codex"
            codex_home.mkdir()
            config = codex_home / "config.toml"
            unrelated_server = "code" + "graph"
            original = f'model = "fixture-model"\n\n[mcp_servers.{unrelated_server}]\ncommand = "node"\nargs = ["{unrelated_server}.js"]\nenabled = false\n\n[mcp_servers.headroom]\nurl = "http://127.0.0.1:9999/mcp"\n'
            config.write_text(original, encoding="utf-8")
            entry = base / "runtime/current/lib/dist/bin/afyx-graph.js"
            fake_server(entry)
            command = [
                "node", str(HELPER), "--node", shutil.which("node") or "node", "--entry", str(entry),
                "--codex", codex_path() or "codex", "--codex-home", str(codex_home), "--apply",
            ]
            offered = subprocess.run(command[:-1], cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(offered.returncode, 0, offered.stdout + offered.stderr)
            self.assertEqual(json.loads(offered.stdout)["mcp"], "MCP_NOT_CONFIGURED")
            self.assertEqual(config.read_text(encoding="utf-8"), original)

            first = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            self.assertEqual(json.loads(first.stdout)["mcp"], "MCP_REACHABLE")
            self.assertTrue(json.loads(first.stdout)["changed"])
            after = config.read_text(encoding="utf-8")
            self.assertIn('model = "fixture-model"', after)
            self.assertIn(f"[mcp_servers.{unrelated_server}]", after)
            self.assertIn("enabled = false", after)
            self.assertIn("[mcp_servers.headroom]", after)
            self.assertEqual(after.count("[mcp_servers.afyx_graph]"), 1)

            second = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
            self.assertFalse(json.loads(second.stdout)["changed"])
            self.assertEqual(config.read_text(encoding="utf-8").count("[mcp_servers.afyx_graph]"), 1)

            stale_entry = base / "old/current/lib/dist/bin/afyx-graph.js"
            fake_server(stale_entry)
            subprocess.run(
                [codex_path() or "codex", "mcp", "remove", "afyx_graph"],
                env={**os.environ, "CODEX_HOME": str(codex_home)}, check=True, capture_output=True, text=True,
            )
            subprocess.run(
                [codex_path() or "codex", "mcp", "add", "afyx_graph", "--", shutil.which("node") or "node", str(stale_entry), "serve", "--mcp"],
                env={**os.environ, "CODEX_HOME": str(codex_home)}, check=True, capture_output=True, text=True,
            )
            stale = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(stale.returncode, 0, stale.stdout + stale.stderr)
            self.assertTrue(json.loads(stale.stdout)["changed"])
            self.assertEqual(json.loads(stale.stdout)["mcp"], "MCP_REACHABLE")
            self.assertIn("enabled = false", config.read_text(encoding="utf-8"))

            subprocess.run(
                [codex_path() or "codex", "mcp", "remove", "afyx_graph"],
                env={**os.environ, "CODEX_HOME": str(codex_home)}, check=True, capture_output=True, text=True,
            )
            subprocess.run(
                [codex_path() or "codex", "mcp", "add", "afyx_graph", "--", "python", "other.py"],
                env={**os.environ, "CODEX_HOME": str(codex_home)}, check=True, capture_output=True, text=True,
            )
            conflict_before = config.read_text(encoding="utf-8")
            conflict = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(conflict.returncode, 2)
            self.assertEqual(json.loads(conflict.stdout)["mcp"], "MCP_BLOCKED")
            self.assertEqual(config.read_text(encoding="utf-8"), conflict_before)

    @unittest.skipUnless(codex_path(), "Codex CLI unavailable on this runner")
    def test_configured_server_reports_failed_handshake_without_rewriting_config(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            base = Path(raw)
            codex_home = base / "codex"
            codex_home.mkdir()
            entry = base / "runtime/current/lib/dist/bin/afyx-graph.js"
            fake_server(entry, healthy=False)
            codex = codex_path() or "codex"
            subprocess.run(
                [codex, "mcp", "add", "afyx_graph", "--", shutil.which("node") or "node", str(entry), "serve", "--mcp"],
                env={**os.environ, "CODEX_HOME": str(codex_home)}, check=True, capture_output=True, text=True,
            )
            config = codex_home / "config.toml"
            before = config.read_text(encoding="utf-8")
            result = subprocess.run([
                "node", str(HELPER), "--node", shutil.which("node") or "node", "--entry", str(entry),
                "--codex", codex, "--codex-home", str(codex_home),
            ], cwd=ROOT, env={**os.environ, "AFYX_MCP_HANDSHAKE_TIMEOUT_MS": "250"}, capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(json.loads(result.stdout)["mcp"], "MCP_HANDSHAKE_FAILED")
            self.assertEqual(config.read_text(encoding="utf-8"), before)

    def test_missing_codex_is_optional_and_non_destructive(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            base = Path(raw)
            entry = base / "runtime/current/lib/dist/bin/afyx-graph.js"
            fake_server(entry)
            result = subprocess.run([
                "node", str(HELPER), "--node", shutil.which("node") or "node", "--entry", str(entry),
                "--codex", str(base / "missing-codex"), "--codex-home", str(base / "codex"), "--apply",
            ], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["graph"], "GRAPH_INSTALLED")
            self.assertEqual(payload["cli"], "CLI_REACHABLE")
            self.assertEqual(payload["mcp"], "MCP_BLOCKED")
            self.assertFalse((base / "codex/config.toml").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
