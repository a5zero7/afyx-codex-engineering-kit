#!/usr/bin/env python3
"""Synthetic-only regressions for the AFYX-286 public controller boundary."""

from __future__ import annotations

import copy
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from evals.forge import controller


ROOT = Path(__file__).resolve().parents[2]
ENVIRONMENT_FINGERPRINT = "a" * 64
RESTRICTED_IDENTITY = r"SYNTHETIC\restricted_agent"
CORRECT_CONTENT = (
    "def clamp(value: int, lower: int, upper: int) -> int:\n"
    "    \"\"\"Return value constrained to the inclusive lower/upper bounds.\"\"\"\n"
    "    return max(lower, min(upper, value))\n"
)
CORRECT_DIGEST = hashlib.sha256(CORRECT_CONTENT.encode("utf-8")).hexdigest()


def complete_outcome(**kwargs) -> controller.ProcessOutcome:
    return controller.ProcessOutcome(
        stdout_upstream_truncated=False,
        stderr_upstream_truncated=False,
        **kwargs,
    )


class FakeLauncher:
    def __init__(
        self,
        *,
        outcome: controller.ProcessOutcome | None = None,
        content: str | None = CORRECT_CONTENT,
        extra_file: bool = False,
        error: Exception | None = None,
    ) -> None:
        self.outcome = outcome or complete_outcome(
            identity=RESTRICTED_IDENTITY,
            exit_code=0,
            stdout="synthetic completion",
            provider_tokens={"input": 10, "output": 5},
            tool_calls=1,
        )
        self.content = content
        self.extra_file = extra_file
        self.error = error
        self.requests: list[controller.LaunchRequest] = []

    def launch(self, request: controller.LaunchRequest) -> controller.ProcessOutcome:
        self.requests.append(request)
        if self.error:
            raise self.error
        if self.content is not None:
            (request.workspace / "known_math.py").write_text(self.content, encoding="utf-8")
        if self.extra_file:
            (request.workspace / "unexpected.py").write_text("x = 1\n", encoding="utf-8")
        return self.outcome


class FailedCleanupManager(controller.DisposableWorkspaceManager):
    def cleanup(self, lease: controller.WorkspaceLease) -> bool:
        return False


class PrivateCapableArtifactValidator:
    def validate(self, request, outcome, files_modified):
        return controller.ArtifactValidation(
            command_exit_code=0,
            content_checks={"artifact": {"private": "synthetic-secret"}},
        )


class PublicControllerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.manifest = controller.load_public_manifest()
        self.temporary = tempfile.TemporaryDirectory(prefix="afyx-controller-test-")
        self.workspace_parent = Path(self.temporary.name)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def input(self, candidate_id: str = "B0", scenario_index: int = 0) -> dict:
        scenario = self.manifest["scenarios"][scenario_index]
        candidate = self.manifest["candidates"][candidate_id]
        return {
            "schema_version": 1,
            "evaluation_run_id": "synthetic-run-001",
            "control_run_id": "synthetic-control-001",
            "cell_id": f"{scenario['scenario_id']}::{candidate_id}::r1",
            "candidate": {
                "id": candidate_id,
                "content_sha256": candidate["content_identity"],
                "activation": candidate["activation"],
            },
            "scenario": {
                "id": scenario["scenario_id"],
                "category": scenario["category"],
                "user_prompt": scenario["user_prompt"],
                "fixture_sha256": self.manifest["public_fixture"]["tree_sha256"],
                "allowed_file_scope": scenario["allowed_file_scope"],
                "validation_command": scenario["validation_command"],
            },
            "environment_sha256": ENVIRONMENT_FINGERPRINT,
            "limits": {"timeout_seconds": 30, "model_retries": 0},
        }

    def make_controller(
        self,
        launcher: FakeLauncher,
        *,
        workspace_manager: controller.DisposableWorkspaceManager | None = None,
        validator: controller.ArtifactValidator | None = None,
    ) -> controller.PublicController:
        return controller.PublicController(
            manifest=self.manifest,
            repository_root=ROOT,
            workspace_manager=workspace_manager
            or controller.DisposableWorkspaceManager(self.workspace_parent),
            launcher=launcher,
            artifact_validator=validator
            or controller.DigestArtifactValidator(
                {"known_math.py": CORRECT_DIGEST}, command_exit_code=0
            ),
            expected_environment_fingerprint=ENVIRONMENT_FINGERPRINT,
            expected_restricted_identity=RESTRICTED_IDENTITY,
        )

    def test_positive_cell_materializes_validates_and_cleans(self) -> None:
        launcher = FakeLauncher()
        result = self.make_controller(launcher).run(self.input())
        self.assertEqual(result["result"], "PASS")
        self.assertEqual(result["files_modified"], ["known_math.py"])
        self.assertEqual(result["cleanup"], "PASS")
        self.assertEqual(result["retry_count"], 0)
        self.assertEqual(result["hard_gate_results"]["correctness"], "NOT_TESTED")
        self.assertNotIn("stdout", result)
        self.assertEqual(
            launcher.requests[0].forbidden_output_markers,
            controller.DEFAULT_FORBIDDEN_OUTPUT_MARKERS,
        )
        self.assertFalse(any(self.workspace_parent.iterdir()))

    def test_all_frozen_candidates_materialize_without_contamination(self) -> None:
        for candidate_id in self.manifest["candidate_order"]:
            with self.subTest(candidate_id=candidate_id):
                result = self.make_controller(FakeLauncher()).run(self.input(candidate_id))
                self.assertEqual(result["result"], "PASS")
                self.assertEqual(result["candidate_id"], candidate_id)
                self.assertFalse(any(self.workspace_parent.iterdir()))

    def test_advisory_cell_preserves_null_command_and_zero_mutation(self) -> None:
        launcher = FakeLauncher(
            content=None,
            outcome=complete_outcome(
                identity=RESTRICTED_IDENTITY,
                exit_code=0,
                tool_calls=0,
            ),
        )
        validator = controller.DigestArtifactValidator({}, command_exit_code=None)
        result = self.make_controller(launcher, validator=validator).run(
            self.input(scenario_index=5)
        )
        self.assertEqual(result["result"], "PASS")
        self.assertEqual(result["files_modified"], [])
        self.assertIsNone(result["validation_outcomes"]["command_exit_code"])

    def test_malformed_input_is_rejected_before_workspace_creation(self) -> None:
        payload = self.input()
        payload.pop("control_run_id")
        with self.assertRaisesRegex(controller.ContractViolation, "public schema"):
            self.make_controller(FakeLauncher()).run(payload)
        self.assertFalse(any(self.workspace_parent.iterdir()))

    def test_candidate_fingerprint_mismatch_is_rejected(self) -> None:
        payload = self.input()
        payload["candidate"]["content_sha256"] = "0" * 64
        with self.assertRaisesRegex(controller.ContractViolation, "fingerprint mismatch"):
            self.make_controller(FakeLauncher()).run(payload)

    def test_unsafe_allowed_path_is_rejected(self) -> None:
        payload = self.input()
        payload["scenario"]["allowed_file_scope"] = ["../outside.py"]
        with self.assertRaises(controller.ContractViolation) as caught:
            self.make_controller(FakeLauncher()).run(payload)
        self.assertEqual(caught.exception.code, "unsafe_path")

    def test_reparse_tree_is_rejected_fail_closed(self) -> None:
        tree = self.workspace_parent / "synthetic-tree"
        tree.mkdir()
        with mock.patch.object(controller, "_is_reparse", return_value=True):
            with self.assertRaises(controller.ContractViolation) as caught:
                controller.assert_safe_tree(tree)
        self.assertEqual(caught.exception.code, "unsafe_reparse")

    def test_identity_mismatch_fails_result(self) -> None:
        outcome = complete_outcome(
            identity=r"SYNTHETIC\unexpected_identity", exit_code=0
        )
        result = self.make_controller(FakeLauncher(outcome=outcome)).run(self.input())
        self.assertEqual(result["result"], "FAIL")
        self.assertIn("identity_mismatch", result["validation_outcomes"]["failure_codes"])

    def test_timeout_and_owned_process_tree_status_are_recorded(self) -> None:
        outcome = complete_outcome(
            identity=RESTRICTED_IDENTITY,
            exit_code=None,
            timed_out=True,
            process_tree_terminated=False,
        )
        result = self.make_controller(FakeLauncher(outcome=outcome)).run(self.input())
        self.assertTrue(result["timeout"])
        self.assertIn("timeout", result["validation_outcomes"]["failure_codes"])
        self.assertIn(
            "process_tree_not_terminated", result["validation_outcomes"]["failure_codes"]
        )

    def test_unexpected_process_termination_fails(self) -> None:
        outcome = complete_outcome(identity=RESTRICTED_IDENTITY, exit_code=None)
        result = self.make_controller(FakeLauncher(outcome=outcome)).run(self.input())
        self.assertIn(
            "unexpected_process_termination", result["validation_outcomes"]["failure_codes"]
        )

    def test_cleanup_failure_is_correlated_and_fails(self) -> None:
        manager = FailedCleanupManager(self.workspace_parent)
        result = self.make_controller(FakeLauncher(), workspace_manager=manager).run(self.input())
        self.assertEqual(result["cleanup"], "FAIL")
        self.assertIn("cleanup_failed", result["validation_outcomes"]["failure_codes"])

    def test_unsafe_output_marker_is_not_published(self) -> None:
        outcome = complete_outcome(
            identity=RESTRICTED_IDENTITY,
            exit_code=0,
            stdout="Authorization: Bearer synthetic-secret",
        )
        result = self.make_controller(FakeLauncher(outcome=outcome)).run(self.input())
        self.assertEqual(result["sanitization"], "FAIL")
        self.assertIn("unsafe_output_marker", result["validation_outcomes"]["failure_codes"])
        self.assertNotIn("synthetic-secret", str(result))

    def test_unsafe_output_marker_beyond_capture_limit_fails_closed(self) -> None:
        outcome = complete_outcome(
            identity=RESTRICTED_IDENTITY,
            exit_code=0,
            stdout=("x" * 70_000) + " Authorization: Bearer synthetic-secret",
        )
        result = self.make_controller(FakeLauncher(outcome=outcome)).run(self.input())
        self.assertEqual(result["sanitization"], "FAIL")
        self.assertTrue(result["evidence"]["stdout_truncated"])
        self.assertIn("unsafe_output_marker", result["validation_outcomes"]["failure_codes"])
        self.assertNotIn("synthetic-secret", str(result))

    def test_upstream_truncation_without_complete_suffix_scan_fails_closed(self) -> None:
        outcome = controller.ProcessOutcome(
            identity=RESTRICTED_IDENTITY,
            exit_code=0,
            stdout="clean-prefix-only",
            stdout_upstream_truncated=True,
            stderr_upstream_truncated=False,
        )
        result = self.make_controller(FakeLauncher(outcome=outcome)).run(self.input())
        self.assertEqual(result["result"], "FAIL")
        self.assertEqual(result["sanitization"], "FAIL")
        self.assertIn(
            "upstream_output_unverified",
            result["validation_outcomes"]["failure_codes"],
        )
        self.assertFalse(result["evidence"]["stdout_truncated"])
        self.assertNotIn("clean-prefix-only", str(result))

    def test_invalid_or_missing_upstream_capture_metadata_fails_closed(self) -> None:
        cases = (
            controller.ProcessOutcome(identity=RESTRICTED_IDENTITY, exit_code=0),
            controller.ProcessOutcome(
                identity=RESTRICTED_IDENTITY,
                exit_code=0,
                stdout_upstream_truncated="invalid",
                stderr_upstream_truncated=False,
            ),
        )
        for outcome in cases:
            with self.subTest(metadata=outcome.stdout_upstream_truncated):
                result = self.make_controller(FakeLauncher(outcome=outcome)).run(
                    self.input()
                )
                self.assertEqual(result["sanitization"], "FAIL")
                self.assertIn(
                    "upstream_output_unverified",
                    result["validation_outcomes"]["failure_codes"],
                )

    def test_verified_bounded_upstream_scan_does_not_require_full_buffering(self) -> None:
        outcome = controller.ProcessOutcome(
            identity=RESTRICTED_IDENTITY,
            exit_code=0,
            stdout="bounded-clean-prefix",
            stdout_upstream_truncated=True,
            stderr_upstream_truncated=False,
            stdout_stream_scan_complete=True,
            stdout_stream_forbidden_marker=False,
        )
        result = self.make_controller(FakeLauncher(outcome=outcome)).run(self.input())
        self.assertEqual(result["result"], "PASS")
        self.assertEqual(result["sanitization"], "PASS")
        self.assertFalse(result["evidence"]["stdout_truncated"])
        self.assertNotIn("bounded-clean-prefix", str(result))

    def test_verified_upstream_scan_marker_fails_without_publishing_content(self) -> None:
        outcome = controller.ProcessOutcome(
            identity=RESTRICTED_IDENTITY,
            exit_code=0,
            stdout="bounded-clean-prefix",
            stdout_upstream_truncated=True,
            stderr_upstream_truncated=False,
            stdout_stream_scan_complete=True,
            stdout_stream_forbidden_marker=True,
        )
        result = self.make_controller(FakeLauncher(outcome=outcome)).run(self.input())
        self.assertEqual(result["sanitization"], "FAIL")
        self.assertIn(
            "unsafe_output_marker", result["validation_outcomes"]["failure_codes"]
        )
        self.assertNotIn("bounded-clean-prefix", str(result))

    def test_exit_zero_with_incorrect_artifact_fails(self) -> None:
        result = self.make_controller(
            FakeLauncher(content="def clamp(*args):\n    return 999\n")
        ).run(self.input())
        self.assertIn(
            "artifact_validation_failed", result["validation_outcomes"]["failure_codes"]
        )

    def test_unexpected_file_mutation_fails_scope(self) -> None:
        result = self.make_controller(FakeLauncher(extra_file=True)).run(self.input())
        self.assertIn("file_scope_violation", result["validation_outcomes"]["failure_codes"])

    def test_retry_policy_is_zero_and_enforced(self) -> None:
        payload = self.input()
        payload["limits"]["model_retries"] = 1
        with self.assertRaises(controller.ContractViolation) as caught:
            self.make_controller(FakeLauncher()).run(payload)
        self.assertEqual(caught.exception.code, "retry_policy")

    def test_observed_retry_is_reported_as_failure(self) -> None:
        outcome = complete_outcome(
            identity=RESTRICTED_IDENTITY,
            exit_code=0,
            retry_count=1,
        )
        result = self.make_controller(FakeLauncher(outcome=outcome)).run(self.input())
        self.assertEqual(result["retry_count"], 1)
        self.assertIn("retry_policy", result["validation_outcomes"]["failure_codes"])

    def test_public_result_rejects_raw_output_fields(self) -> None:
        result = self.make_controller(FakeLauncher()).run(self.input())
        result["stdout"] = "not publishable"
        with self.assertRaises(controller.ContractViolation) as caught:
            controller.validate_public_result(result, self.manifest)
        self.assertEqual(caught.exception.code, "result_schema")

    def test_public_result_rejects_private_capable_nested_adapter_values(self) -> None:
        mutations = (
            ("provider_tokens", {"input": {"private": "synthetic-secret"}}),
            ("provider_tokens", {f"metric-{index}": 1 for index in range(17)}),
            (
                "validation_outcomes",
                {
                    "command_exit_code": 0,
                    "content_checks": {"artifact": "synthetic-secret"},
                    "failure_codes": [],
                },
            ),
            (
                "validation_outcomes",
                {
                    "command_exit_code": 0,
                    "content_checks": {
                        f"check-{index}": True
                        for index in range(controller.MAX_PUBLIC_METADATA_ITEMS + 1)
                    },
                    "failure_codes": [],
                },
            ),
            (
                "lifecycle",
                {
                    "workspace_created": True,
                    "process_tree_terminated": True,
                    "cleanup_correlated": {"private": "synthetic-secret"},
                },
            ),
            ("evidence", {"private": "synthetic-secret"}),
        )
        baseline = self.make_controller(FakeLauncher()).run(self.input())
        for field, value in mutations:
            with self.subTest(field=field, value_type=type(value).__name__):
                result = copy.deepcopy(baseline)
                result[field] = value
                with self.assertRaises(controller.ContractViolation) as caught:
                    controller.validate_public_result(result, self.manifest)
                self.assertEqual(caught.exception.code, "result_schema")

    def test_injected_adapters_cannot_publish_private_capable_metadata(self) -> None:
        outcome = complete_outcome(
            identity=RESTRICTED_IDENTITY,
            exit_code=0,
            provider_tokens={"input": {"private": "synthetic-secret"}},
        )
        cases = (
            (FakeLauncher(outcome=outcome), None),
            (FakeLauncher(), PrivateCapableArtifactValidator()),
        )
        for launcher, validator in cases:
            with self.subTest(adapter=type(validator or launcher).__name__):
                with self.assertRaises(controller.ContractViolation) as caught:
                    self.make_controller(launcher, validator=validator).run(self.input())
                self.assertEqual(caught.exception.code, "result_schema")
                self.assertNotIn("synthetic-secret", str(caught.exception))
                self.assertFalse(any(self.workspace_parent.iterdir()))


if __name__ == "__main__":
    unittest.main(verbosity=2)
