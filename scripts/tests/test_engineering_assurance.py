#!/usr/bin/env python3
"""Deterministic tests for the Phase 7 engineering-assurance gate."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
VALIDATOR = ROOT / "scripts" / "validate-engineering-assurance.py"
HEAD = "1" * 40
DIGEST = "2" * 64
SCOPE = "3" * 64


def passing_record() -> dict:
    tests = []
    for kind in ("static", "focused", "negative", "regression"):
        tests.append(
            {
                "id": f"test-{kind}",
                "kind": kind,
                "status": "PASS",
                "requirement": "v1",
            }
        )
    return {
        "schema_version": 1,
        "task_id": "PHASE7-TEST",
        "lifecycle_state": "MERGE_READY",
        "baseline": {"sha": "0" * 40, "verified": True, "worktree_clean": True},
        "source": {
            "sha": HEAD,
            "acceptance_revision": "phase7-v1",
            "relevant_source_digest": DIGEST,
            "scope_fingerprint": SCOPE,
        },
        "scope": {"allowed": ["scripts/**", "docs/**"], "changed": ["scripts/example.py", "docs/example.md"]},
        "ground_truth": [{"claim": "focused behavior observed", "evidence_id": "test-focused"}],
        "risk": {
            "level": 2,
            "rationale": "Cross-platform lifecycle contract change",
            "mutation_required": False,
            "differential_required": False,
            "performance_required": False,
        },
        "validation_budget": {"planned_seconds": 300, "actual_seconds": 120, "overrun_justification": ""},
        "tests": tests,
        "reused_evidence": [],
        "ci": {"status": "PASS", "evidence": "https://example.invalid/actions/1"},
        "documentation": {"status": "PASS", "evidence": "docs/example.md"},
        "merge_readiness": "READY",
    }


class EngineeringAssuranceTests(unittest.TestCase):
    def run_validator(self, record: dict | None = None, expected: int = 0) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory() as temporary:
            command = [sys.executable, str(VALIDATOR)]
            if record is not None:
                path = Path(temporary) / "record.json"
                path.write_text(json.dumps(record), encoding="utf-8")
                command += ["--record", str(path), "--expected-head", HEAD]
            result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return result

    def test_contract_and_merge_ready_record_pass(self) -> None:
        self.assertIn("PASS", self.run_validator().stdout)
        self.assertIn("PASS", self.run_validator(passing_record()).stdout)

    def test_expected_head_and_scope_tampering_fail(self) -> None:
        record = passing_record()
        record["source"]["sha"] = "4" * 40
        self.assertIn("does not match --expected-head", self.run_validator(record, 1).stderr)
        record = passing_record()
        record["scope"]["changed"].append("private/out-of-scope.txt")
        self.assertIn("scope violation", self.run_validator(record, 1).stderr)

    def test_stale_reused_evidence_fails(self) -> None:
        record = passing_record()
        record["reused_evidence"] = [
            {
                "id": "old-ci",
                "status": "PASS",
                "relevant_source_digest": "9" * 64,
                "acceptance_revision": "phase7-v1",
                "scope_fingerprint": SCOPE,
                "new_relevant_failure": False,
            }
        ]
        self.assertIn("stale or mismatched", self.run_validator(record, 1).stderr)

    def test_unknown_status_and_unjustified_skip_fail(self) -> None:
        record = passing_record()
        record["tests"][0]["status"] = "SKIPPED"
        self.assertIn("unknown status", self.run_validator(record, 1).stderr)
        record = passing_record()
        record["tests"][0].update({"status": "NOT_RUN", "requirement": "optional"})
        self.assertIn("NOT_RUN needs", self.run_validator(record, 1).stderr)

    def test_classified_unsupported_optional_case_is_preserved(self) -> None:
        record = passing_record()
        record["tests"].append(
            {
                "id": "test-unavailable-platform",
                "kind": "platform",
                "status": "NOT_RUN",
                "requirement": "optional",
                "disposition": "UNSUPPORTED",
                "reason": "No authorized host is available",
            }
        )
        self.run_validator(record)

    def test_v1_failure_blocks_even_with_performance_pass(self) -> None:
        record = passing_record()
        record["tests"][1].update(
            {
                "status": "FAIL",
                "reason": "incorrect result",
                "owner": "developer",
                "resolution": "correct implementation",
                "acceptance_evidence": "focused regression PASS",
                "blocks_readiness": True,
            }
        )
        record["tests"].append(
            {
                "id": "test-performance",
                "kind": "performance",
                "status": "PASS",
                "requirement": "optional",
                "measurement": {"value": 10, "threshold": 20, "comparator": "lte", "unit": "ms"},
            }
        )
        result = self.run_validator(record, 1)
        self.assertIn("blocking", result.stderr)
        self.assertIn("lacks PASS evidence for: focused", result.stderr)

    def test_performance_proof_is_measured_and_threshold_bound(self) -> None:
        record = passing_record()
        record["risk"]["performance_required"] = True
        record["tests"].append(
            {
                "id": "test-performance",
                "kind": "performance",
                "status": "PASS",
                "requirement": "v1",
                "measurement": {"value": 25, "threshold": 20, "comparator": "lte", "unit": "ms"},
            }
        )
        self.assertIn("does not meet", self.run_validator(record, 1).stderr)

    def test_mutation_and_differential_proofs_are_risk_gated(self) -> None:
        record = passing_record()
        record["risk"]["mutation_required"] = True
        record["risk"]["differential_required"] = True
        result = self.run_validator(record, 1)
        self.assertIn("risk requires PASS mutation proof", result.stderr)
        self.assertIn("risk requires PASS differential proof", result.stderr)
        for kind in ("mutation", "differential"):
            record["tests"].append(
                {"id": f"test-{kind}", "kind": kind, "status": "PASS", "requirement": "v1"}
            )
        self.run_validator(record)

    def test_budget_overrun_requires_reason(self) -> None:
        record = passing_record()
        record["validation_budget"]["actual_seconds"] = 301
        self.assertIn("overrun requires justification", self.run_validator(record, 1).stderr)
        record["validation_budget"]["overrun_justification"] = "New cross-platform defect required a focused rerun"
        self.run_validator(record)


if __name__ == "__main__":
    unittest.main(verbosity=2)
