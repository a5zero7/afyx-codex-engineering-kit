#!/usr/bin/env python3
"""Actual-subprocess tests for the developer-only native-Windows Forge lab."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from evals.forge import controller, windows_lab


ROOT = Path(__file__).resolve().parents[2]
ENVIRONMENT_FINGERPRINT = "7" * 64


@unittest.skipUnless(os.name == "nt", "native-Windows lab")
class ForgeWindowsLabTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="afyx-windows-lab-test-")
        self.root = Path(self.temporary.name)
        self.workspace_root = self.root / "workspaces"
        self.evidence_root = self.root / "retained-evidence"
        self.workspace_root.mkdir()
        self.manifest = controller.load_public_manifest()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def payload(self, timeout_seconds: int = 5) -> dict[str, object]:
        scenario = self.manifest["scenarios"][0]
        candidate = self.manifest["candidates"]["B0"]
        return {
            "schema_version": 1,
            "evaluation_run_id": "windows-lab-run-001",
            "control_run_id": "windows-lab-control-001",
            "cell_id": "forge-known-file-001::B0::r1",
            "candidate": {
                "id": "B0",
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
            "limits": {"timeout_seconds": timeout_seconds, "model_retries": 0},
        }

    def run_lab(
        self,
        *,
        mode: str = "success",
        faults: windows_lab.WindowsLabFaults | None = None,
    ) -> tuple[dict, windows_lab.WindowsLabEvidenceRecorder]:
        recorder = windows_lab.WindowsLabEvidenceRecorder(
            self.evidence_root, faults=faults
        )
        verifier = windows_lab.WindowsLabEvidenceVerifier(self.evidence_root)
        lab_controller = controller.PublicController(
            manifest=self.manifest,
            repository_root=ROOT,
            workspace_manager=controller.DisposableWorkspaceManager(
                self.workspace_root
            ),
            launcher=windows_lab.BindingLauncher(recorder, mode=mode),
            artifact_validator=controller.DigestArtifactValidator(
                {"known_math.py": windows_lab.synthetic_artifact_sha256()},
                command_exit_code=0,
            ),
            evidence_recorder=recorder,
            evidence_receipt_verifier=verifier,
            expected_environment_fingerprint=ENVIRONMENT_FINGERPRINT,
            expected_restricted_identity=windows_lab.expected_identity(),
        )
        return (
            lab_controller.run(
                self.payload(timeout_seconds=1 if mode == "timeout" else 5)
            ),
            recorder,
        )

    def only_session(self) -> Path:
        sessions = [
            path
            for path in self.evidence_root.iterdir()
            if not path.name.startswith(".")
        ]
        self.assertEqual(len(sessions), 1)
        return sessions[0]

    def test_actual_windows_process_identity_retention_and_cleanup(self) -> None:
        result, recorder = self.run_lab()
        session = self.only_session()
        capture = json.loads((session / "capture.json").read_text("utf-8"))

        self.assertEqual(result["result"], "PASS")
        self.assertEqual(recorder.process_start_count, 1)
        self.assertEqual(result["provider_tokens"], "NOT_AVAILABLE")
        self.assertEqual(result["retry_count"], 0)
        self.assertTrue(
            all(
                verdict == "NOT_TESTED"
                for verdict in result["hard_gate_results"].values()
            )
        )
        self.assertTrue(result["evidence_retention"]["archive_ready"])
        self.assertTrue(result["evidence_retention"]["archive_finalized"])
        self.assertEqual(result["cleanup"], "PASS")
        self.assertFalse(any(self.workspace_root.iterdir()))
        self.assertTrue((session / "finalization.json").is_file())
        self.assertEqual(
            capture["process_state"]["launcher"],
            "fixed-windows-synthetic-child-v1",
        )
        self.assertTrue(
            capture["process_state"]["profile_redirected_to_workspace"]
        )
        self.assertFalse(capture["process_state"]["timed_out"])
        self.assertTrue(capture["process_state"]["process_tree_terminated"])

    def test_timeout_terminates_owned_process_tree_and_retains_failure(self) -> None:
        result, _ = self.run_lab(mode="timeout")
        capture = json.loads(
            (self.only_session() / "capture.json").read_text("utf-8")
        )

        self.assertEqual(result["result"], "FAIL")
        self.assertTrue(result["timeout"])
        self.assertIn("timeout", result["validation_outcomes"]["failure_codes"])
        self.assertEqual(result["cleanup"], "PASS")
        self.assertTrue(result["evidence_retention"]["archive_finalized"])
        self.assertTrue(capture["process_state"]["child_pid_observed"])
        self.assertFalse(capture["process_state"]["child_alive_after_cleanup"])
        self.assertTrue(capture["process_state"]["process_tree_terminated"])

    def test_persisted_verifier_rejects_replay_after_restart(self) -> None:
        recorder = windows_lab.WindowsLabEvidenceRecorder(self.evidence_root)
        binding = controller.EvidenceBinding(
            evaluation_run_id="windows-lab-run-replay",
            control_run_id="windows-lab-control-replay",
            cell_id="forge-known-file-001::B0::r1",
            candidate_id="B0",
            scenario_id="forge-known-file-001",
            candidate_fingerprint=self.manifest["candidates"]["B0"][
                "content_identity"
            ],
            fixture_fingerprint=self.manifest["public_fixture"]["tree_sha256"],
            environment_fingerprint=ENVIRONMENT_FINGERPRINT,
            retention_challenge_id="1" * 32,
        )
        receipt = recorder.prepare(binding)
        restarted_verifier = windows_lab.WindowsLabEvidenceVerifier(
            self.evidence_root
        )
        restarted_verifier.verify_readiness(binding, receipt)

        another_restart = windows_lab.WindowsLabEvidenceVerifier(self.evidence_root)
        with self.assertRaises(FileExistsError):
            another_restart.verify_readiness(binding, receipt)

    def test_capture_interruption_fails_without_false_finalization(self) -> None:
        result, recorder = self.run_lab(
            faults=windows_lab.WindowsLabFaults(capture_failure=True)
        )

        self.assertEqual(recorder.process_start_count, 1)
        self.assertEqual(result["result"], "FAIL")
        self.assertIn("launcher_failure", result["validation_outcomes"]["failure_codes"])
        self.assertFalse(result["evidence_retention"]["archive_finalized"])
        self.assertEqual(result["cleanup"], "PASS")


if __name__ == "__main__":
    unittest.main(verbosity=2)
