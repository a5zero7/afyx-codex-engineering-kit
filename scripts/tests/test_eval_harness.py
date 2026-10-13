#!/usr/bin/env python3
"""Deterministic AFYX-283 isolation and activation-evidence regressions."""

from __future__ import annotations

import importlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
HARNESS = ROOT / "evals" / "harness"
sys.path.insert(0, str(HARNESS))
run = importlib.import_module("run")
freeze = importlib.import_module("freeze")


class EvaluationHarnessTests(unittest.TestCase):
    def test_formal_aliases_and_expert_configurations_preserve_existing_configs(self) -> None:
        manifest = run.load_json(ROOT / "evals" / "manifest.json")
        self.assertEqual(
            manifest["evaluation_aliases"],
            {"A0": "N", "A1": "CORE", "B0": "X", "B1": "CORE_X"},
        )
        self.assertEqual(manifest["configurations"]["X"], ["afyx-engineering-expert"])
        self.assertEqual(
            manifest["configurations"]["CORE_X"],
            ["efficient-coding", "odoo-engineering", "prompt-master", "afyx-engineering-expert"],
        )
        self.assertEqual(manifest["configurations"]["N"], [])
        self.assertEqual(
            manifest["configurations"]["CORE"],
            ["efficient-coding", "odoo-engineering", "prompt-master"],
        )

    def test_all_four_installed_skills_are_disabled_before_selected_injection(self) -> None:
        override = run.skills_override()
        for name in run.AFYX_SKILLS:
            self.assertIn(f"{name}/SKILL.md", override)
            self.assertIn("enabled=false", override)
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            run.prepare_skills(work, ["afyx-engineering-expert"])
            injected = work / ".agents" / "skills"
            self.assertTrue((injected / "afyx-engineering-expert" / "SKILL.md").is_file())
            for name in set(run.AFYX_SKILLS) - {"afyx-engineering-expert"}:
                self.assertFalse((injected / name).exists())

    def test_activation_requires_successful_content_evidence(self) -> None:
        events = [
            {
                "type": "item.completed",
                "item": {
                    "type": "command_execution",
                    "command": "Get-Content .agents/skills/afyx-engineering-expert/SKILL.md",
                    "status": "completed",
                    "exit_code": 0,
                    "aggregated_output": "name: afyx-engineering-expert\nmetadata:\n",
                },
            },
            {
                "type": "item.completed",
                "item": {
                    "type": "command_execution",
                    "command": "Get-Content .agents/skills/odoo-engineering/SKILL.md",
                    "status": "failed",
                    "exit_code": 1,
                    "aggregated_output": "Access denied",
                },
            },
            {
                "type": "item.completed",
                "item": {
                    "type": "command_execution",
                    "command": "echo efficient-coding/SKILL.md",
                    "status": "completed",
                    "exit_code": 0,
                    "aggregated_output": "efficient-coding/SKILL.md",
                },
            },
        ]
        parsed = run.parse_events("\n".join(json.dumps(event) for event in events))
        evidence = run.activation_evidence(
            parsed, ["afyx-engineering-expert", "odoo-engineering", "efficient-coding"]
        )
        self.assertEqual(
            evidence["afyx-engineering-expert"]["state"], "SKILL_MD_READ_OBSERVED"
        )
        self.assertEqual(evidence["odoo-engineering"]["state"], "SKILL_MD_READ_FAILED")
        self.assertEqual(
            evidence["efficient-coding"]["state"], "ACTIVATION_NOT_OBSERVABLE"
        )

    def test_evaluated_workspace_is_external_and_contains_no_ground_truth(self) -> None:
        scenario = {
            "scenario_id": "isolation-unit",
            "fixture": "fixtures/expert-pilot",
            "user_prompt": "Return OK.",
            "required_skill_reads": [],
            "forbidden_skill_reads": ["afyx-engineering-expert"],
            "expected_assertions": [{"type": "output_contains", "value": "OK"}],
            "forbidden_patterns": [],
            "validation_command": None,
            "allowed_file_scope": [],
            "expected_file_scope": [],
            "output_kind": "advisory",
        }
        manifest = run.load_json(ROOT / "evals" / "manifest.json")
        observed_cwd: list[Path] = []

        def fake_process(command, **kwargs):
            cwd = Path(kwargs["cwd"]).resolve()
            observed_cwd.append(cwd)
            self.assertFalse((cwd / "manifest.json").exists())
            self.assertFalse((cwd / "evals").exists())
            event = {"type": "item.completed", "item": {"type": "agent_message", "text": "OK"}}
            return subprocess.CompletedProcess(command, 0, json.dumps(event), "")

        with tempfile.TemporaryDirectory() as results, mock.patch.object(
            run, "RESULTS_ROOT", Path(results)
        ), mock.patch.object(run.subprocess, "run", side_effect=fake_process):
            record = run.run_cell(manifest, scenario, "A0", 1, 30)
        self.assertEqual(record["result"], "PASS")
        self.assertTrue(observed_cwd)
        for cwd in observed_cwd:
            with self.assertRaises(ValueError):
                cwd.relative_to(ROOT.resolve())

    def test_canary_fails_closed_unless_attempt_is_observed_and_blocked(self) -> None:
        def blocked_process(command, **kwargs):
            prompt = command[-1]
            canary = prompt.split("exact file ", 1)[1].split(". If", 1)[0]
            event = {
                "type": "item.completed",
                "item": {
                    "type": "command_execution",
                    "command": f"Get-Content '{canary}'",
                    "status": "failed",
                    "exit_code": 1,
                    "aggregated_output": "Access denied",
                },
            }
            message = {
                "type": "item.completed",
                "item": {"type": "agent_message", "text": "ACCESS_BLOCKED"},
            }
            return subprocess.CompletedProcess(
                command, 0, json.dumps(event) + "\n" + json.dumps(message), ""
            )

        with tempfile.TemporaryDirectory() as results, mock.patch.object(
            run, "RESULTS_ROOT", Path(results)
        ), mock.patch.object(run.subprocess, "run", side_effect=blocked_process):
            self.assertEqual(run.run_isolation_canary(30)["result"], "PASS")

        no_attempt = subprocess.CompletedProcess([], 0, json.dumps({
            "type": "item.completed", "item": {"type": "agent_message", "text": "ACCESS_BLOCKED"}
        }), "")
        with tempfile.TemporaryDirectory() as results, mock.patch.object(
            run, "RESULTS_ROOT", Path(results)
        ), mock.patch.object(run.subprocess, "run", return_value=no_attempt):
            self.assertEqual(run.run_isolation_canary(30)["result"], "FAIL")

        with tempfile.TemporaryDirectory() as results, mock.patch.object(
            run, "RESULTS_ROOT", Path(results)
        ), mock.patch.object(
            run.subprocess, "run", side_effect=subprocess.TimeoutExpired(["codex"], 30)
        ):
            blocked = run.run_isolation_canary(30)
            self.assertEqual(blocked["result"], "BLOCKED")
            self.assertIn("timed out", blocked["error_summary"])

    def test_current_fingerprint_matches_repository_sources(self) -> None:
        environment = run.load_json(ROOT / "evals" / "environment-expert-v0.1.0.json")
        for name in freeze.REPOSITORY_SKILLS:
            self.assertEqual(
                environment["skills"][name]["content_sha256"],
                freeze.directory_content_sha256(ROOT / "skills" / name),
            )
        self.assertEqual(environment["skills"]["efficient-coding"]["version"], "1.2.0")
        self.assertEqual(environment["runtime"]["codex_cli"], "0.156.1")


if __name__ == "__main__":
    unittest.main(verbosity=2)
