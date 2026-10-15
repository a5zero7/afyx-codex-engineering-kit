#!/usr/bin/env python3
"""Deterministic T09.P0 Forge readiness regressions; no model or network."""

from __future__ import annotations

import copy
import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
VALIDATOR_PATH = ROOT / "evals" / "forge" / "validate.py"
SPEC = importlib.util.spec_from_file_location("forge_readiness", VALIDATOR_PATH)
forge = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(forge)


class ForgeReadinessTests(unittest.TestCase):
    def setUp(self) -> None:
        self.manifest = forge.load_json(forge.MANIFEST_PATH)

    def test_frozen_manifest_is_consistent(self) -> None:
        self.assertEqual(forge.validate_manifest(copy.deepcopy(self.manifest)), [])

    def test_discovery_matrix_is_unique_and_deterministic(self) -> None:
        first = forge.discovery_cells(self.manifest)
        second = forge.discovery_cells(self.manifest)
        self.assertEqual(first, second)
        self.assertEqual(len(first), 36)
        self.assertEqual(len(set(first)), 36)
        self.assertEqual(
            forge.discovery_order_sha256(self.manifest),
            self.manifest["discovery"]["cell_order_sha256"],
        )

    def test_pristine_public_fixtures_have_expected_failing_baselines(self) -> None:
        self.assertEqual(forge.validate_pristine_fixtures(self.manifest), [])

    def test_candidate_identity_tamper_is_rejected(self) -> None:
        tampered = copy.deepcopy(self.manifest)
        tampered["candidates"]["B5"]["content_identity"] = "0" * 64
        self.assertIn(
            "candidate B5 content identity mismatch",
            forge.validate_manifest(tampered),
        )

    def test_guessed_b2_and_fixture_traversal_are_rejected(self) -> None:
        tampered = copy.deepcopy(self.manifest)
        tampered["candidates"]["B2"]["source"] = "guessed.txt"
        tampered["candidates"]["B2"]["content_identity"] = "1" * 64
        tampered["scenarios"][0]["allowed_file_scope"] = ["../outside.py"]
        violations = forge.validate_manifest(tampered)
        self.assertIn("B2 must remain blocked without guessed content", violations)
        self.assertTrue(any("escapes fixture" in item for item in violations))


if __name__ == "__main__":
    unittest.main(verbosity=2)
