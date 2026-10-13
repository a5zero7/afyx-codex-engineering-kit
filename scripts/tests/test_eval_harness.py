#!/usr/bin/env python3
"""Deterministic AFYX-283 isolation and activation-evidence regressions."""

from __future__ import annotations

import importlib
import json
import re
import subprocess
import sys
import tempfile
import unittest
from contextlib import contextmanager
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

    def test_cell_and_canary_share_external_workspace_constructor(self) -> None:
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

        def fake_process(command, cwd, timeout):
            cwd = Path(cwd).resolve()
            observed_cwd.append(cwd)
            self.assertFalse((cwd / "manifest.json").exists())
            self.assertFalse((cwd / "evals").exists())
            if (cwd / "allowed.txt").exists():
                allowed = (cwd / "allowed.txt").read_text(encoding="utf-8")
                events = [{
                    "type": "item.completed",
                    "item": {
                        "type": "command_execution",
                        "command": "Write-Output AFYX_CONTROL_workspace:; Get-Content allowed.txt",
                        "status": "completed", "exit_code": 0,
                        "aggregated_output": f"AFYX_CONTROL_workspace:{allowed}",
                    },
                }]
                for label in ("canary", "manifest", "rubric", "private_holdout"):
                    events.append({
                        "type": "item.completed",
                        "item": {
                            "type": "command_execution",
                            "command": f"Write-Output AFYX_CONTROL_{label}:READ_DENIED",
                            "status": "completed", "exit_code": 0,
                            "aggregated_output": f"AFYX_CONTROL_{label}:READ_DENIED",
                        },
                    })
                stdout = "\n".join(json.dumps(event) for event in events)
            else:
                event = {
                    "type": "item.completed",
                    "item": {"type": "agent_message", "text": "OK"},
                }
                stdout = json.dumps(event)
            return {
                "started": True, "pid": 123, "returncode": 0,
                "stdout": stdout, "stderr": "", "timed_out": False,
                "cleanup_required": False, "cleanup_succeeded": True,
                "cleanup_method": "not-required",
                "elapsed_seconds": 0.01, "executable": "codex",
            }

        original_workspace = run.evaluated_workspace

        @contextmanager
        def traced_workspace():
            with original_workspace() as work:
                yield work

        with tempfile.TemporaryDirectory() as results, mock.patch.object(
            run, "RESULTS_ROOT", Path(results)
        ), mock.patch.object(run, "bounded_process", side_effect=fake_process):
            with mock.patch.object(
                run, "evaluated_workspace", wraps=traced_workspace
            ) as workspace_factory:
                record = run.run_cell(manifest, scenario, "A0", 1, 30)
                canary = run.run_isolation_canary(30)
        self.assertEqual(record["result"], "PASS")
        self.assertEqual(canary["result"], "PASS")
        self.assertTrue(canary["positive_control"]["attempt_observed"])
        self.assertTrue(canary["positive_control"]["read_succeeded"])
        self.assertEqual(workspace_factory.call_count, 2)
        self.assertEqual(len(observed_cwd), 2)
        for cwd in observed_cwd:
            self.assertEqual(cwd.name, "work")
            with self.assertRaises(ValueError):
                cwd.relative_to(ROOT.resolve())

    def test_canary_fails_closed_unless_attempt_is_observed_and_blocked(self) -> None:
        def child_result(stdout: str, *, timed_out: bool = False) -> dict:
            return {
                "started": True, "pid": 456,
                "returncode": None if timed_out else 0,
                "stdout": stdout, "stderr": "", "timed_out": timed_out,
                "cleanup_required": timed_out, "cleanup_succeeded": True,
                "cleanup_method": "synthetic-cleanup" if timed_out else "not-required",
                "elapsed_seconds": 0.1, "executable": "codex",
            }

        def blocked_process(command, cwd, timeout):
            allowed = (Path(cwd) / "allowed.txt").read_text(encoding="utf-8")
            events = [
                {
                    "type": "item.completed",
                    "item": {
                        "type": "command_execution",
                        "command": "Write-Output AFYX_CONTROL_workspace:; Get-Content allowed.txt",
                        "status": "completed", "exit_code": 0,
                        "aggregated_output": f"AFYX_CONTROL_workspace:{allowed}",
                    },
                }
            ]
            for label in ("canary", "manifest", "rubric", "private_holdout"):
                events.append({
                    "type": "item.completed",
                    "item": {
                        "type": "command_execution",
                        "command": f"Write-Output AFYX_CONTROL_{label}:READ_DENIED",
                        "status": "completed", "exit_code": 0,
                        "aggregated_output": f"AFYX_CONTROL_{label}:READ_DENIED:PermissionError",
                    },
                })
            return child_result("\n".join(json.dumps(event) for event in events))

        with tempfile.TemporaryDirectory() as results, mock.patch.object(
            run, "RESULTS_ROOT", Path(results)
        ), mock.patch.object(run, "bounded_process", side_effect=blocked_process):
            self.assertEqual(run.run_isolation_canary(30)["result"], "PASS")

        no_attempt = child_result(json.dumps({
            "type": "item.completed", "item": {"type": "agent_message", "text": "ACCESS_BLOCKED"}
        }))
        with tempfile.TemporaryDirectory() as results, mock.patch.object(
            run, "RESULTS_ROOT", Path(results)
        ), mock.patch.object(run, "bounded_process", return_value=no_attempt):
            result = run.run_isolation_canary(30)
            self.assertEqual(result["result"], "BLOCKED")
            self.assertFalse(result["positive_control"]["attempt_observed"])

        unrelated_tool = child_result(json.dumps({
            "type": "item.completed",
            "item": {
                "type": "command_execution", "command": "Write-Output unrelated",
                "status": "completed", "exit_code": 0, "aggregated_output": "unrelated",
            },
        }))
        with tempfile.TemporaryDirectory() as results, mock.patch.object(
            run, "RESULTS_ROOT", Path(results)
        ), mock.patch.object(run, "bounded_process", return_value=unrelated_tool):
            result = run.run_isolation_canary(30)
            self.assertEqual(result["result"], "BLOCKED")
            self.assertTrue(result["command_tool_observed"])
            self.assertFalse(result["positive_control"]["attempt_observed"])

        with tempfile.TemporaryDirectory() as results, mock.patch.object(
            run, "RESULTS_ROOT", Path(results)
        ), mock.patch.object(
            run, "bounded_process", return_value=child_result("", timed_out=True)
        ):
            blocked = run.run_isolation_canary(30)
            self.assertEqual(blocked["result"], "BLOCKED")
            self.assertTrue(blocked["cleanup_succeeded"])

    def test_external_read_success_is_isolation_failure_without_secret_output(self) -> None:
        def readable_process(command, cwd, timeout):
            allowed = (Path(cwd) / "allowed.txt").read_text(encoding="utf-8")
            events = [{
                "type": "item.completed",
                "item": {
                    "type": "command_execution",
                    "command": "Write-Output AFYX_CONTROL_workspace:; Get-Content allowed.txt",
                    "status": "completed", "exit_code": 0,
                    "aggregated_output": f"AFYX_CONTROL_workspace:{allowed}",
                },
            }]
            for label in ("canary", "manifest", "rubric", "private_holdout"):
                events.append({
                    "type": "item.completed",
                    "item": {
                        "type": "command_execution",
                        "command": f"Write-Output AFYX_CONTROL_{label}:READ_SUCCEEDED",
                        "status": "completed", "exit_code": 0,
                        "aggregated_output": f"AFYX_CONTROL_{label}:READ_SUCCEEDED",
                    },
                })
            return {
                "started": True, "pid": 789, "returncode": 0,
                "stdout": "\n".join(json.dumps(event) for event in events),
                "stderr": "", "timed_out": False,
                "cleanup_required": False, "cleanup_succeeded": True,
                "cleanup_method": "not-required",
                "elapsed_seconds": 0.1, "executable": "codex",
            }

        with tempfile.TemporaryDirectory() as results, mock.patch.object(
            run, "RESULTS_ROOT", Path(results)
        ), mock.patch.object(run, "bounded_process", side_effect=readable_process):
            result = run.run_isolation_canary(30)
        self.assertEqual(result["result"], "FAIL")
        self.assertTrue(result["external_read_succeeded"])
        self.assertFalse(result["canary_exposed"])

    def test_unauthorized_read_or_canary_exposure_overrides_blocked_state(self) -> None:
        def leaking_timeout(command, cwd, timeout):
            event = {
                "type": "item.completed",
                "item": {
                    "type": "command_execution",
                    "command": "Write-Output AFYX_CONTROL_canary:READ_SUCCEEDED",
                    "status": "completed", "exit_code": 0,
                    "aggregated_output": "AFYX_CONTROL_canary:READ_SUCCEEDED",
                },
            }
            return {
                "started": True, "pid": 791, "returncode": None,
                "stdout": json.dumps(event), "stderr": "", "timed_out": True,
                "cleanup_required": True, "cleanup_succeeded": True,
                "cleanup_method": "synthetic-cleanup",
                "elapsed_seconds": 30.0, "executable": "codex",
            }

        with tempfile.TemporaryDirectory() as results, mock.patch.object(
            run, "RESULTS_ROOT", Path(results)
        ), mock.patch.object(run, "bounded_process", side_effect=leaking_timeout):
            result = run.run_isolation_canary(30)
        self.assertEqual(result["result"], "FAIL")
        self.assertTrue(result["external_read_succeeded"])
        self.assertFalse(result["positive_control"]["attempt_observed"])
        self.assertTrue(result["timed_out"])

        def exposed_marker_timeout(command, cwd, timeout):
            prompt = command[-1]
            canary_path = re.search(
                r'(?:LiteralPath|cat)\s+"([^"]*canary\.txt)"', prompt
            ).group(1)
            marker = Path(canary_path).read_text(encoding="utf-8")
            result = leaking_timeout(command, cwd, timeout)
            result["stdout"] = json.dumps({
                "type": "item.completed",
                "item": {"type": "agent_message", "text": marker},
            })
            return result

        with tempfile.TemporaryDirectory() as results, mock.patch.object(
            run, "RESULTS_ROOT", Path(results)
        ), mock.patch.object(run, "bounded_process", side_effect=exposed_marker_timeout):
            result = run.run_isolation_canary(30)
        self.assertEqual(result["result"], "FAIL")
        self.assertTrue(result["canary_exposed"])

    def test_sandbox_router_denials_are_observable_access_failures(self) -> None:
        def router_blocked_process(command, cwd, timeout):
            allowed = (Path(cwd) / "allowed.txt").read_text(encoding="utf-8")
            positive = {
                "type": "item.completed",
                "item": {
                    "type": "command_execution",
                    "command": "Write-Output AFYX_CONTROL_workspace:; Get-Content allowed.txt",
                    "status": "completed", "exit_code": 0,
                    "aggregated_output": f"AFYX_CONTROL_workspace:{allowed}",
                },
            }
            stderr = "\n".join(
                f"exec_command failed: Write-Output AFYX_CONTROL_{label}: "
                "synthetic-path rejected: blocked by policy"
                for label in ("canary", "manifest", "rubric", "private_holdout")
            )
            return {
                "started": True, "pid": 790, "returncode": 0,
                "stdout": json.dumps(positive), "stderr": stderr, "timed_out": False,
                "cleanup_required": False, "cleanup_succeeded": True,
                "cleanup_method": "not-required",
                "elapsed_seconds": 0.1, "executable": "codex",
            }

        with tempfile.TemporaryDirectory() as results, mock.patch.object(
            run, "RESULTS_ROOT", Path(results)
        ), mock.patch.object(run, "bounded_process", side_effect=router_blocked_process):
            result = run.run_isolation_canary(30)
        self.assertEqual(result["result"], "PASS")
        self.assertTrue(all(
            control["denial_source"] == "sandbox_router"
            for control in result["negative_controls"].values()
        ))

    def test_bounded_process_cleans_up_timed_out_owned_child(self) -> None:
        result = run.bounded_process(
            [sys.executable, "-c", "import time; time.sleep(20)"], ROOT, 1
        )
        self.assertTrue(result["started"])
        self.assertTrue(result["timed_out"])
        self.assertTrue(result["cleanup_required"])
        self.assertTrue(result["cleanup_succeeded"])
        self.assertIsNotNone(result["returncode"])

    def test_pilot_defaults_to_one_repetition_contract(self) -> None:
        source = (ROOT / "evals" / "harness" / "run.py").read_text(encoding="utf-8")
        self.assertIn(
            'repetitions = args.repetitions or (3 if args.mode == "benchmark" else 1)',
            source,
        )

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
