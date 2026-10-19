#!/usr/bin/env python3
"""Phase 6 desired-state/control-plane tests using disposable roots only."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WINDOWS = os.name == "nt"


def shell_path() -> str | None:
    found = shutil.which("bash")
    if found:
        return found
    if WINDOWS:
        for candidate in (Path("C:/Program Files/Git/bin/bash.exe"), Path("C:/Program Files/Git/usr/bin/bash.exe")):
            if candidate.is_file():
                return str(candidate)
    return None


def pwsh_path() -> str | None:
    return shutil.which("pwsh") or shutil.which("powershell")


def tree_digest(root: Path) -> str:
    digest = hashlib.sha256()
    if not root.exists():
        return digest.hexdigest()
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


class ControlPlaneContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.base = Path(self.temporary.name)
        self.skills = self.base / "skills"
        self.graph = self.base / "graph"
        self.codex = self.base / "codex"
        self.fake_bin = self.base / "fake-bin"
        self.backups = self.base / "backups"
        self.fake_bin.mkdir()
        self.codex.mkdir()
        (self.codex / "config.toml").write_text('[unrelated]\nvalue = "preserve"\n', encoding="utf-8")
        self.config_before = (self.codex / "config.toml").read_bytes()
        self.env = os.environ.copy()
        self.env.update(
            {
                "HOME": str(self.base),
                "USERPROFILE": str(self.base),
                "CODEX_HOME": str(self.codex),
                "AFYX_GRAPH_RUNTIME_ROOT": str(self.graph),
                "AFYX_GRAPH_BIN_DIR": str(self.base / "public-bin"),
                "AFYX_BACKUP_ROOT": str(self.backups),
                "CI": "1",
            }
        )
        if WINDOWS:
            (self.fake_bin / "codex.cmd").write_text("@echo codex-test\r\n", encoding="utf-8")
        else:
            codex = self.fake_bin / "codex"
            codex.write_text("#!/bin/sh\necho codex-test\n", encoding="utf-8")
            codex.chmod(codex.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        self.env["PATH"] = str(self.fake_bin) + os.pathsep + self.env.get("PATH", "")

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def lifecycle(
        self, entrypoint: str, *arguments: str, expected: int | tuple[int, ...] = 0
    ) -> subprocess.CompletedProcess[str]:
        if WINDOWS:
            shell = pwsh_path()
            if not shell:
                self.skipTest("PowerShell is unavailable")
            command = [shell, "-NoProfile", "-NonInteractive", "-File", str(ROOT / f"{entrypoint}.ps1")]
            if entrypoint in {"install", "update", "verify"}:
                command += ["-SkillsRoot", str(self.skills)]
            command += list(arguments)
        else:
            shell = shell_path()
            if not shell:
                self.skipTest("Bash is unavailable")
            command = [shell, str(ROOT / f"{entrypoint}.sh")]
            if entrypoint in {"install", "update", "verify"}:
                command += ["--skills-root", str(self.skills)]
            command += list(arguments)
        result = subprocess.run(command, cwd=ROOT, env=self.env, capture_output=True, text=True)
        expected_codes = (expected,) if isinstance(expected, int) else expected
        self.assertIn(result.returncode, expected_codes, result.stdout + result.stderr)
        return result

    def install_preset(self, preset: str = "minimal", expected: int = 0) -> subprocess.CompletedProcess[str]:
        if WINDOWS:
            return self.lifecycle("install", "-Preset", preset, "-SkipGraphMcp", expected=expected)
        return self.lifecycle("install", "--preset", preset, "--skip-graph-mcp", expected=expected)

    def verify_preset(self, preset: str = "minimal", expected: int = 0) -> subprocess.CompletedProcess[str]:
        if WINDOWS:
            return self.lifecycle("verify", "-Preset", preset, expected=expected)
        return self.lifecycle("verify", "--preset", preset, expected=expected)

    def update_preset(self, preset: str = "minimal") -> subprocess.CompletedProcess[str]:
        if WINDOWS:
            return self.lifecycle("update", "-SkipSelfUpdate", "-Preset", preset, "-SkipGraphMcp")
        return self.lifecycle("update", "--skip-self-update", "--preset", preset, "--skip-graph-mcp")

    def test_registry_presets_and_ownership_boundaries(self) -> None:
        contract = json.loads((ROOT / "scripts/components.json").read_text(encoding="utf-8"))
        self.assertEqual(contract["default_provider"], "codex")
        self.assertEqual([item["provider"] for item in contract["providers"]], ["codex", "headroom"])
        self.assertEqual(contract["providers"][0]["configuration_policy"], "merge-afyx-owned-entries-only")
        self.assertEqual(contract["providers"][1]["configuration_policy"], "observe-only")
        by_id = {item["id"]: item for item in contract["components"]}
        self.assertEqual(by_id["prompt-master"]["ownership_class"], "EXTERNAL")
        self.assertEqual(by_id["headroom"]["ownership_class"], "EXTERNAL")
        self.assertEqual(
            {item["id"] for item in contract["components"] if "minimal" in item["presets"].split(";")},
            {"efficient-coding", "odoo-engineering"},
        )

    def test_legacy_verify_keeps_structural_compatibility(self) -> None:
        shutil.copytree(ROOT / "skills/efficient-coding", self.skills / "efficient-coding")
        shutil.copytree(ROOT / "skills/odoo-engineering", self.skills / "odoo-engineering")
        prompt = self.skills / "prompt-master"
        prompt.mkdir()
        (prompt / "SKILL.md").write_text("---\nname: prompt-master\ndescription: structural fixture\n---\n", encoding="utf-8")
        legacy = self.lifecycle("verify")
        self.assertIn("Efficient Coding", legacy.stdout)
        self.assertIn("Core readiness", legacy.stdout)
        self.assertFalse((self.skills / "efficient-coding" / ".afyx-install.json").exists())

    def test_minimal_install_verify_is_idempotent_and_preserves_config(self) -> None:
        first = self.install_preset()
        self.assertIn("v1|minimal|codex|efficient-coding,odoo-engineering", first.stdout)
        self.assertTrue((self.skills / "efficient-coding" / ".afyx-install.json").is_file())
        self.assertTrue((self.skills / "odoo-engineering" / ".afyx-install.json").is_file())
        self.assertFalse((self.skills / "prompt-master").exists())
        first_digest = tree_digest(self.skills)
        second = self.install_preset()
        self.assertIn("IN_SYNC", second.stdout)
        self.assertEqual(tree_digest(self.skills), first_digest)
        updated = self.update_preset()
        self.assertIn("v1|minimal|codex|efficient-coding,odoo-engineering", updated.stdout)
        self.assertEqual(tree_digest(self.skills), first_digest)
        verified = self.verify_preset()
        self.assertIn("Plan/efficient-coding", verified.stdout)
        self.assertIn("IN_SYNC", verified.stdout)
        self.assertEqual((self.codex / "config.toml").read_bytes(), self.config_before)

    def test_user_owned_install_is_blocked_without_mutation(self) -> None:
        foreign = self.skills / "efficient-coding"
        shutil.copytree(ROOT / "skills/efficient-coding", foreign)
        before = tree_digest(foreign)
        blocked = self.install_preset(expected=1)
        self.assertIn("blocked before mutation", blocked.stdout + blocked.stderr)
        self.assertEqual(tree_digest(foreign), before)
        if WINDOWS:
            explicit = self.lifecycle("install", "-ComponentAction", "efficient-coding=repair", "-SkipUsageTracker", "-SkipGraphMcp", expected=(1, 2))
        else:
            explicit = self.lifecycle("install", "--component", "efficient-coding=repair", "--skip-graph-mcp", expected=(1, 2))
        self.assertIn("does not permit", explicit.stdout + explicit.stderr)
        self.assertEqual(tree_digest(foreign), before)

    def test_external_dependency_drift_blocks_entire_plan_before_mutation(self) -> None:
        prompt = self.skills / "prompt-master"
        prompt.mkdir(parents=True)
        (prompt / "SKILL.md").write_text("---\nname: prompt-master\ndescription: local external copy\n---\nbody\n", encoding="utf-8")
        before = tree_digest(self.skills)
        blocked = self.install_preset("recommended", expected=1)
        self.assertIn("prompt-master:UNVERIFIED:USER", blocked.stdout + blocked.stderr)
        self.assertEqual(tree_digest(self.skills), before)
        self.assertFalse((self.skills / "efficient-coding").exists())
        self.assertEqual((self.codex / "config.toml").read_bytes(), self.config_before)

    def test_foreign_graph_runtime_blocks_full_plan_before_mutation(self) -> None:
        (self.graph / "current/bin").mkdir(parents=True)
        (self.graph / "metadata.json").write_text(
            '{"product_name":"Another Product","product_version":"1.0.0"}\n', encoding="utf-8"
        )
        executable = self.graph / ("current/bin/afyx-graph.cmd" if WINDOWS else "current/bin/afyx-graph")
        executable.write_text("foreign\n", encoding="utf-8")
        if not WINDOWS:
            executable.chmod(executable.stat().st_mode | stat.S_IXUSR)
        before = tree_digest(self.graph)
        blocked = self.install_preset("full", expected=1)
        self.assertIn("afyx-graph:UNVERIFIED:USER", blocked.stdout + blocked.stderr)
        self.assertEqual(tree_digest(self.graph), before)
        self.assertFalse(self.skills.exists())

    def test_afyx_owned_drift_is_detected_and_repaired_with_backup(self) -> None:
        self.install_preset()
        target = self.skills / "efficient-coding" / "SKILL.md"
        target.write_text(target.read_text(encoding="utf-8") + "\nuser drift\n", encoding="utf-8")
        drifted = self.verify_preset(expected=1)
        self.assertIn("MODIFIED", drifted.stdout + drifted.stderr)
        repaired = self.install_preset()
        self.assertIn("repair=REPAIR", repaired.stdout)
        self.assertEqual(target.read_bytes(), (ROOT / "skills/efficient-coding/SKILL.md").read_bytes())
        self.assertTrue(any((self.backups / "efficient-coding").iterdir()))
        self.verify_preset()
        self.assertEqual((self.codex / "config.toml").read_bytes(), self.config_before)

    def test_custom_empty_plan_preserves_existing_components(self) -> None:
        self.install_preset()
        before = tree_digest(self.skills)
        result = self.install_preset("custom")
        self.assertIn("v1|custom|codex|", result.stdout)
        self.assertIn("drift=EXTRA", result.stdout)
        self.assertEqual(tree_digest(self.skills), before)

    def test_preset_cannot_be_mutated_by_legacy_action_flags(self) -> None:
        if WINDOWS:
            blocked = self.lifecycle(
                "install", "-Preset", "minimal", "-ComponentAction", "afyx-graph=install", "-SkipGraphMcp", expected=(1, 2)
            )
        else:
            blocked = self.lifecycle(
                "install", "--preset", "minimal", "--component", "afyx-graph=install", "--skip-graph-mcp", expected=(1, 2)
            )
        self.assertIn("preset is immutable", (blocked.stdout + blocked.stderr).lower())
        self.assertFalse(self.skills.exists())
        self.assertFalse(self.graph.exists())

    def test_cross_shell_minimal_plan_identity(self) -> None:
        bash = shell_path()
        powershell = pwsh_path()
        if not bash or not powershell:
            self.skipTest("both Bash and PowerShell are required")
        bash_script = f'. "{(ROOT / "scripts/lib/afyx-components.sh").as_posix()}"; afyx_control_plan_identity minimal'
        bash_result = subprocess.run([bash, "-c", bash_script], cwd=ROOT, env=self.env, capture_output=True, text=True, check=True)
        ps_script = (
            f"Import-Module '{ROOT / 'scripts/lib/AfyxComponents.psm1'}' -Force; "
            f"$ctx=New-AfyxComponentContext -SkillsRoot '{self.skills}' -GraphRoot '{self.graph}' -CodexHome '{self.codex}'; "
            "(Get-AfyxControlPlan -Preset minimal -Context $ctx).Identity"
        )
        ps_result = subprocess.run([powershell, "-NoProfile", "-NonInteractive", "-Command", ps_script], cwd=ROOT, env=self.env, capture_output=True, text=True, check=True)
        self.assertEqual(bash_result.stdout.strip(), ps_result.stdout.strip())


if __name__ == "__main__":
    unittest.main(verbosity=2)
