#!/usr/bin/env python3
"""Deterministic cross-shell tests for the Afyx component contract.

Builds synthetic install roots (no network, no model, no real install touched)
and asserts that the Bash library and the PowerShell module classify every
component identically and as expected. Shells that are not installed are
skipped, but at least one must run.
"""

from __future__ import annotations

import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASH_LIB = ROOT / "scripts" / "lib" / "afyx-components.sh"
PS_MODULE = ROOT / "scripts" / "lib" / "AfyxComponents.psm1"
WINDOWS = sys.platform == "win32"
GRAPH_FILES = ("current/bin/afyx-graph.cmd", "current/node.exe") if WINDOWS else ("current/bin/afyx-graph", "current/node")


def posix(path: Path) -> str:
    return path.as_posix()


def run_bash(skills: Path, graph: Path, codex: Path) -> dict[str, tuple[str, str]]:
    bash = shutil.which("bash")
    if not bash:
        return {}
    script = (
        f'skills_root="{posix(skills)}"; graph_root="{posix(graph)}"; codex_home="{posix(codex)}"; '
        f'. "{posix(BASH_LIB)}"; '
        'for id in $(afyx_component_ids); do afyx_component_evaluate "$id"; '
        'printf "%s|%s|%s\\n" "$id" "$AFYX_STATE" "$AFYX_VERSION"; done'
    )
    out = subprocess.run([bash, "-c", script], capture_output=True, text=True, check=True).stdout
    return parse(out)


def run_pwsh(skills: Path, graph: Path, codex: Path) -> dict[str, tuple[str, str]]:
    pwsh = shutil.which("pwsh") or shutil.which("powershell")
    if not pwsh:
        return {}
    script = (
        f"Import-Module '{PS_MODULE}' -Force; "
        f"$ctx = New-AfyxComponentContext -SkillsRoot '{skills}' -GraphRoot '{graph}' -CodexHome '{codex}'; "
        "Get-AfyxComponentStates -Context $ctx | ForEach-Object { \"$($_.Id)|$($_.State)|$($_.Version)\" }"
    )
    out = subprocess.run([pwsh, "-NoProfile", "-NonInteractive", "-Command", script], capture_output=True, text=True, check=True).stdout
    return parse(out)


def parse(output: str) -> dict[str, tuple[str, str]]:
    states = {}
    for line in output.splitlines():
        if line.count("|") == 2:
            cid, state, version = line.split("|")
            states[cid] = (state, version)
    return states


def write(path: Path, text: str, executable: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    if executable and not WINDOWS:
        path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def build_graph(root: Path, product_name: str = "Afyx Graph", files: tuple[str, ...] = GRAPH_FILES) -> None:
    write(root / "metadata.json", '{\n  "product_name": "%s",\n  "product_version": "1.0.0"\n}\n' % product_name)
    for relative in files:
        write(root / relative, "stub", executable=True)


class ComponentContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        base = Path(self._tmp.name)
        self.skills, self.graph, self.codex = base / "skills", base / "graph", base / "codex"
        for directory in (self.skills, self.codex):
            directory.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def shells(self):
        results = {"bash": run_bash(self.skills, self.graph, self.codex), "pwsh": run_pwsh(self.skills, self.graph, self.codex)}
        active = {name: states for name, states in results.items() if states}
        self.assertTrue(active, "neither bash nor PowerShell is available to run the contract tests")
        return active

    def assert_state(self, component: str, expected: str) -> None:
        for shell, states in self.shells().items():
            self.assertEqual(states[component][0], expected, f"{shell}: {component}")

    def install_skill(self, name: str) -> Path:
        target = self.skills / name
        shutil.copytree(ROOT / "skills" / name, target)
        return target

    def test_skill_not_installed(self) -> None:
        self.assert_state("efficient-coding", "NOT INSTALLED")

    def test_skill_healthy_and_versioned(self) -> None:
        self.install_skill("efficient-coding")
        for shell, states in self.shells().items():
            self.assertEqual(states["efficient-coding"], ("HEALTHY", "1.1.0"), shell)

    def test_skill_incomplete_when_a_reference_is_missing(self) -> None:
        (self.install_skill("efficient-coding") / "references" / "tool-routing.md").unlink()
        self.assert_state("efficient-coding", "INCOMPLETE")

    def test_skill_invalid_without_frontmatter(self) -> None:
        write(self.skills / "odoo-engineering" / "SKILL.md", "no frontmatter here\n")
        self.assert_state("odoo-engineering", "INVALID")

    def test_upstream_skill_needs_only_a_valid_manifest(self) -> None:
        write(self.skills / "prompt-master" / "SKILL.md", "---\nname: prompt-master\ndescription: Writes prompts\n---\nBody\n")
        self.assert_state("prompt-master", "HEALTHY")

    def test_graph_states(self) -> None:
        self.assert_state("afyx-graph", "NOT INSTALLED")
        write(self.graph / "metadata.json", '{"product_name": "Afyx Graph", "product_version": "1.0.0"}')
        self.assert_state("afyx-graph", "INCOMPLETE")
        shutil.rmtree(self.graph)
        build_graph(self.graph, product_name="Some Other Product")
        self.assert_state("afyx-graph", "INVALID")
        shutil.rmtree(self.graph)
        build_graph(self.graph)
        for shell, states in self.shells().items():
            self.assertEqual(states["afyx-graph"], ("HEALTHY", "1.0.0"), shell)

    def test_usage_tracking_is_windows_only(self) -> None:
        tools = self.codex / "tools"
        if not WINDOWS:
            self.assert_state("codex-usage-tracking", "NOT INSTALLED")
            return
        self.assert_state("codex-usage-tracking", "NOT INSTALLED")
        write(tools / "CodexUsage.psm1", "x")
        self.assert_state("codex-usage-tracking", "INCOMPLETE")
        for name in ("codex-usage-stop.ps1", "codex-usage-watch.ps1", "codex-usage-doctor.ps1", "codex-usage-pricing.json"):
            write(tools / name, "x")
        self.assert_state("codex-usage-tracking", "HEALTHY")

    def test_shells_agree_on_every_component(self) -> None:
        self.install_skill("efficient-coding")
        build_graph(self.graph)
        active = self.shells()
        if len(active) < 2:
            self.skipTest("only one shell available; cross-shell agreement not testable")
        first, second = active.values()
        for component in first:
            if component == "headroom":
                continue  # depends on the machine, not on the fixture
            self.assertEqual(first[component], second[component], component)


if __name__ == "__main__":
    unittest.main(verbosity=2)
