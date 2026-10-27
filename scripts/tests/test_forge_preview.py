#!/usr/bin/env python3
"""Focused regressions for the Afyx Forge A5 opt-in development preview runner."""

from __future__ import annotations

import copy
import io
import json
import os
import subprocess
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

from evals.forge import controller, preview, validate as forge_validate


ROOT = Path(__file__).resolve().parents[2]


class ForgePreviewTests(unittest.TestCase):
    def setUp(self) -> None:
        self.manifest = forge_validate.load_json(forge_validate.MANIFEST_PATH)

    def test_opt_in_is_disabled_by_default(self) -> None:
        # Check function
        old_env = os.environ.get(preview.PREVIEW_OPT_IN_ENV)
        try:
            os.environ.pop(preview.PREVIEW_OPT_IN_ENV, None)
            self.assertFalse(preview.check_opt_in(False))
            self.assertTrue(preview.check_opt_in(True))

            os.environ[preview.PREVIEW_OPT_IN_ENV] = "1"
            self.assertTrue(preview.check_opt_in(False))
        finally:
            if old_env is not None:
                os.environ[preview.PREVIEW_OPT_IN_ENV] = old_env
            else:
                os.environ.pop(preview.PREVIEW_OPT_IN_ENV, None)

    def test_cli_requires_opt_in_flag_or_env(self) -> None:
        completed = subprocess.run(
            [sys.executable, "-m", "evals.forge.preview"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(completed.returncode, 1)
        self.assertIn("DISABLED by default", completed.stdout)

    def test_guidance_extraction_is_bounded_and_non_modifying(self) -> None:
        scenarios = {s["scenario_id"]: s for s in self.manifest["scenarios"]}
        scenario = scenarios["forge-cross-module-001"]
        guidance = preview.extract_task_guidance("B2", scenario, self.manifest, ROOT)

        self.assertEqual(guidance["candidate_id"], "B2")
        self.assertEqual(guidance["scenario_id"], "forge-cross-module-001")
        self.assertEqual(guidance["allowed_file_scope"], ["tax.py", "checkout.py"])
        self.assertIn("percentage-point", guidance["user_prompt"])
        self.assertIn("Baseline", guidance["directive_summary"])

    def test_tampered_manifests_fail_before_preview_actions(self) -> None:
        mutations = {
            "prompt": lambda manifest: manifest["scenarios"][0].update(
                user_prompt="substituted prompt"
            ),
            "command": lambda manifest: manifest["scenarios"][0].update(
                validation_command=["python", "-c", "raise SystemExit(0)"]
            ),
            "candidate": lambda manifest: manifest["candidates"]["B2"].update(
                content_identity="0" * 64
            ),
            "fixture": lambda manifest: manifest["scenarios"][0].update(
                fixture="evals/forge/candidates/B2"
            ),
        }
        for label, mutate in mutations.items():
            with self.subTest(label=label):
                tampered = copy.deepcopy(self.manifest)
                mutate(tampered)
                with (
                    mock.patch.object(preview, "extract_task_guidance") as guidance,
                    mock.patch.object(controller, "_copy_tree_contents") as materialize,
                    mock.patch.object(preview, "execute_validation_command") as execute,
                ):
                    with self.assertRaises(preview.PreviewManifestInvalid):
                        preview.run_preview_scenario(
                            tampered, "B2", "forge-cross-module-001"
                        )
                guidance.assert_not_called()
                materialize.assert_not_called()
                execute.assert_not_called()

    def test_inspect_guidance_rejects_tampered_manifest_before_read(self) -> None:
        tampered = copy.deepcopy(self.manifest)
        tampered["scenarios"][0]["user_prompt"] = "substituted prompt"
        stderr = io.StringIO()
        with (
            mock.patch.object(forge_validate, "load_json", return_value=tampered),
            mock.patch.object(preview, "extract_task_guidance") as guidance,
            redirect_stderr(stderr),
        ):
            exit_code = preview.main(["--opt-in", "--inspect-guidance-only"])
        self.assertEqual(exit_code, 2)
        self.assertIn("frozen public Forge manifest validation failed", stderr.getvalue())
        guidance.assert_not_called()

    def test_preview_end_to_end_baseline_and_target_validation(self) -> None:
        # Test candidate B2 on forge-cross-module-001 with synthetic fix
        result = preview.run_preview_scenario(
            self.manifest,
            "B2",
            "forge-cross-module-001",
            repository_root=ROOT,
            apply_synthetic_fix=True,
        )
        self.assertEqual(result["verdict"], "PASS")
        self.assertEqual(result["candidate_id"], "B2")
        self.assertEqual(result["baseline_validation"]["exit_code"], 1)
        self.assertEqual(result["target_validation"]["exit_code"], 0)
        self.assertTrue(result["scope_adherence"])
        self.assertEqual(set(result["files_modified"]), {"checkout.py", "tax.py"})
        self.assertTrue(result["disposable_workspace_cleaned"])

    def test_preview_candidate_b4_direct_scenario(self) -> None:
        # Test candidate B4 on forge-known-file-001 with synthetic fix
        result = preview.run_preview_scenario(
            self.manifest,
            "B4",
            "forge-known-file-001",
            repository_root=ROOT,
            apply_synthetic_fix=True,
        )
        self.assertEqual(result["verdict"], "PASS")
        self.assertEqual(result["candidate_id"], "B4")
        self.assertEqual(result["baseline_validation"]["exit_code"], 1)
        self.assertEqual(result["target_validation"]["exit_code"], 0)
        self.assertTrue(result["scope_adherence"])
        self.assertEqual(result["files_modified"], ["known_math.py"])
        self.assertTrue(result["disposable_workspace_cleaned"])

    def test_preview_catches_scope_violation(self) -> None:
        original_fix = preview.apply_scenario_synthetic_fix

        def out_of_scope_fix(scenario_id: str, work: Path) -> list[str]:
            applied = original_fix(scenario_id, work)
            (work / "unexpected.py").write_text("UNEXPECTED = True\n", encoding="utf-8")
            return [*applied, "unexpected.py"]

        with mock.patch.object(
            preview, "apply_scenario_synthetic_fix", side_effect=out_of_scope_fix
        ):
            result = preview.run_preview_scenario(
                self.manifest,
                "B2",
                "forge-cross-module-001",
                repository_root=ROOT,
                apply_synthetic_fix=True,
            )
        self.assertFalse(result["scope_adherence"])
        self.assertEqual(result["verdict"], "FAIL")
        self.assertTrue(result["disposable_workspace_cleaned"])

    def test_cleanup_false_fails_result_and_cli_exit(self) -> None:
        original_manager = controller.DisposableWorkspaceManager

        class FalseCleanupManager(original_manager):
            def cleanup(self, lease: controller.WorkspaceLease) -> bool:
                super().cleanup(lease)
                return False

        stdout = io.StringIO()
        with (
            mock.patch.object(controller, "DisposableWorkspaceManager", FalseCleanupManager),
            redirect_stdout(stdout),
        ):
            exit_code = preview.main(
                ["--opt-in", "--apply-synthetic-fix", "--json"]
            )
        result = json.loads(stdout.getvalue())
        self.assertEqual(exit_code, 2)
        self.assertEqual(result["verdict"], "FAIL")
        self.assertFalse(result["disposable_workspace_cleaned"])
        self.assertEqual(result["failure_codes"], ["workspace_cleanup_failed"])

    def test_cleanup_exception_is_sanitized_and_fails(self) -> None:
        original_manager = controller.DisposableWorkspaceManager

        class RaisingCleanupManager(original_manager):
            def cleanup(self, lease: controller.WorkspaceLease) -> bool:
                super().cleanup(lease)
                raise RuntimeError("private path must not be reported")

        with mock.patch.object(
            controller, "DisposableWorkspaceManager", RaisingCleanupManager
        ):
            result = preview.run_preview_scenario(
                self.manifest,
                "B2",
                "forge-cross-module-001",
                repository_root=ROOT,
                apply_synthetic_fix=True,
            )
        serialized = json.dumps(result)
        self.assertEqual(result["verdict"], "FAIL")
        self.assertFalse(result["disposable_workspace_cleaned"])
        self.assertEqual(result["failure_codes"], ["workspace_cleanup_failed"])
        self.assertNotIn("private path", serialized)

    def test_inventory_deadline_is_duration_bounded_to_30_seconds(self) -> None:
        real_limits = controller.InventoryLimits
        observed: list[float] = []

        def capture_limits(**kwargs: object) -> controller.InventoryLimits:
            observed.append(float(kwargs["deadline_seconds"]))
            return real_limits(**kwargs)  # type: ignore[arg-type]

        with mock.patch.object(controller, "InventoryLimits", side_effect=capture_limits):
            result = preview.run_preview_scenario(
                self.manifest,
                "B4",
                "forge-known-file-001",
                repository_root=ROOT,
                apply_synthetic_fix=True,
            )
        self.assertEqual(result["verdict"], "PASS")
        self.assertEqual(observed, [30.0])

    def test_unknown_candidate_or_scenario_raises_value_error(self) -> None:
        with self.assertRaises(ValueError):
            preview.run_preview_scenario(self.manifest, "NONEXISTENT", "forge-cross-module-001")
        with self.assertRaises(ValueError):
            preview.run_preview_scenario(self.manifest, "B2", "NONEXISTENT")


if __name__ == "__main__":
    unittest.main(verbosity=2)

