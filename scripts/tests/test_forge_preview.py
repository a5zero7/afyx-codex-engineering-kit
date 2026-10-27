#!/usr/bin/env python3
"""Focused regressions for the Afyx Forge A5 opt-in development preview runner."""

from __future__ import annotations

import copy
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

from evals.forge import preview, validate as forge_validate


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
        # Mutate the scenario to an artificially restricted scope that forbids tax.py
        tampered_manifest = copy.deepcopy(self.manifest)
        scenarios = {s["scenario_id"]: s for s in tampered_manifest["scenarios"]}
        scenarios["forge-cross-module-001"]["allowed_file_scope"] = ["checkout.py"]

        result = preview.run_preview_scenario(
            tampered_manifest,
            "B2",
            "forge-cross-module-001",
            repository_root=ROOT,
            apply_synthetic_fix=True,
        )
        # Because tax.py was changed and not in allowed_file_scope, scope_adherence is False
        self.assertFalse(result["scope_adherence"])
        self.assertEqual(result["verdict"], "FAIL")
        self.assertTrue(result["disposable_workspace_cleaned"])

    def test_unknown_candidate_or_scenario_raises_value_error(self) -> None:
        with self.assertRaises(ValueError):
            preview.run_preview_scenario(self.manifest, "NONEXISTENT", "forge-cross-module-001")
        with self.assertRaises(ValueError):
            preview.run_preview_scenario(self.manifest, "B2", "NONEXISTENT")


if __name__ == "__main__":
    unittest.main(verbosity=2)

