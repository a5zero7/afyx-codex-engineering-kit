#!/usr/bin/env python3
"""Source-level tests for the WSL container isolation prototype."""

from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest import mock

from evals.forge import controller, wsl_container


ROOT = Path(__file__).resolve().parents[2]
SECCOMP = ROOT / "evals/forge/policies/synthetic-seccomp-v1.json"
SECCOMP_SHA256 = hashlib.sha256(SECCOMP.read_bytes()).hexdigest()
PINNED_IMAGE = "registry.example.invalid/afyx/forge-synthetic@sha256:" + "a" * 64


class FakeRuntime:
    def __init__(self, result: wsl_container.ContainerExecution | None = None) -> None:
        self.result = result or wsl_container.ContainerExecution(
            exit_code=0,
            stdout=b"container stdout\n",
            stderr=b"container stderr\n",
            timed_out=False,
            workload_terminated=True,
            cleanup_observed=True,
            stdout_complete=True,
            stderr_complete=True,
        )
        self.calls: list[tuple[wsl_container.ContainerIsolationPolicy, int]] = []

    def execute(self, policy, timeout_seconds):
        self.calls.append((policy, timeout_seconds))
        return self.result


class WslContainerPolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="afyx-container-policy-")
        self.workspace_root = Path(self.temporary.name) / "workspaces"
        self.workspace = self.workspace_root / "lease" / "work"
        self.workspace.mkdir(parents=True)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def policy(self) -> wsl_container.ContainerIsolationPolicy:
        return wsl_container.build_synthetic_policy(
            image=PINNED_IMAGE,
            workspace=self.workspace,
            seccomp_profile=SECCOMP,
            seccomp_sha256=SECCOMP_SHA256,
            correlation_id="container-evidence-001",
        )

    def request(self, timeout_seconds: int = 30) -> controller.LaunchRequest:
        return controller.LaunchRequest(
            evaluation_run_id="container-run-001",
            control_run_id="container-control-001",
            cell_id="forge-known-file-001::B0::r1",
            workspace=self.workspace,
            user_prompt="public synthetic prompt",
            timeout_seconds=timeout_seconds,
            forbidden_output_markers=(),
            evidence_session_id="container-evidence-001",
        )

    def test_policy_and_shell_free_docker_argv_are_exact(self) -> None:
        policy = wsl_container.validate_policy(
            self.policy(), workspace_root=self.workspace_root
        )
        argv = wsl_container.build_docker_run_argv(policy)
        self.assertEqual(argv[:2], ("/usr/bin/docker", "run"))
        self.assertEqual(argv[2:4], ("--pull", "never"))
        self.assertNotIn("--privileged", argv)
        self.assertEqual(argv.count("--mount"), 1)
        self.assertIn("--read-only", argv)
        self.assertIn("--init", argv)
        self.assertIn("--pid", argv)
        self.assertIn("--ipc", argv)
        self.assertIn("none", argv)
        self.assertIn("ALL", argv)
        self.assertIn("no-new-privileges:true", argv)
        self.assertIn(f"seccomp={SECCOMP}", argv)
        self.assertNotIn("--cap-add", argv)
        rendered = " ".join(argv)
        self.assertNotIn("/var/run/docker.sock", rendered)
        self.assertNotIn("/mnt", rendered)
        self.assertEqual(
            argv[-4:],
            (
                wsl_container.FIXED_ENTRYPOINT,
                PINNED_IMAGE,
                "--mode",
                "public-synthetic",
            ),
        )
        self.assertNotIn("sh", argv)
        self.assertNotIn("bash", argv)

    def test_mutable_or_malformed_image_is_rejected(self) -> None:
        for image in (
            "afyx/forge-synthetic:latest",
            "afyx/forge-synthetic@sha256:short",
            "Afyx/forge@sha256:" + "a" * 64,
        ):
            with self.subTest(image=image), self.assertRaises(
                wsl_container.ContainerPolicyViolation
            ):
                wsl_container.validate_policy(
                    replace(self.policy(), image=image),
                    workspace_root=self.workspace_root,
                )
        with self.assertRaises(wsl_container.ContainerPolicyViolation):
            wsl_container.validate_policy(
                replace(self.policy(), correlation_id="../stale-container"),
                workspace_root=self.workspace_root,
            )

    def test_privilege_network_rootfs_and_capability_drift_fail_closed(self) -> None:
        unsafe = (
            replace(self.policy(), privileged=True),
            replace(self.policy(), network_mode="host"),
            replace(self.policy(), read_only_root=False),
            replace(self.policy(), uid=0),
            replace(self.policy(), cap_drop=()),
            replace(self.policy(), no_new_privileges=False),
        )
        for policy in unsafe:
            with self.subTest(policy=policy), self.assertRaises(
                wsl_container.ContainerPolicyViolation
            ):
                wsl_container.validate_policy(
                    policy, workspace_root=self.workspace_root
                )

    def test_forbidden_extra_mount_and_docker_socket_fail_closed(self) -> None:
        base = self.policy()
        forbidden = (
            wsl_container.ContainerMount(Path("/"), "/host", True),
            wsl_container.ContainerMount(
                Path("/var/run/docker.sock"), "/var/run/docker.sock", False
            ),
        )
        for mount in forbidden:
            with self.subTest(mount=mount), self.assertRaises(
                wsl_container.ContainerPolicyViolation
            ):
                wsl_container.validate_policy(
                    replace(base, mounts=base.mounts + (mount,)),
                    workspace_root=self.workspace_root,
                )

    def test_workspace_outside_approved_root_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="afyx-outside-workspace-") as outside:
            policy = replace(
                self.policy(),
                mounts=(
                    wsl_container.ContainerMount(
                        Path(outside), wsl_container.WORKSPACE_TARGET, False
                    ),
                ),
            )
            with self.assertRaises(wsl_container.ContainerPolicyViolation):
                wsl_container.validate_policy(
                    policy, workspace_root=self.workspace_root
                )

    def test_excessive_resource_or_timeout_policy_is_rejected(self) -> None:
        unsafe = (
            replace(self.policy(), pids_limit=129),
            replace(self.policy(), memory_bytes=1024 * 1024 * 1024),
            replace(self.policy(), cpus=4.0),
            replace(self.policy(), tmpfs_bytes=128 * 1024 * 1024),
            replace(self.policy(), max_timeout_seconds=601),
        )
        for policy in unsafe:
            with self.subTest(policy=policy), self.assertRaises(
                wsl_container.ContainerPolicyViolation
            ):
                wsl_container.validate_policy(
                    policy, workspace_root=self.workspace_root
                )

    def test_seccomp_digest_default_action_and_syscalls_are_enforced(self) -> None:
        with self.assertRaises(wsl_container.ContainerPolicyViolation):
            wsl_container.validate_policy(
                replace(self.policy(), seccomp_sha256="0" * 64),
                workspace_root=self.workspace_root,
            )
        symlink = Path(self.temporary.name) / "seccomp-link.json"
        symlink.symlink_to(SECCOMP)
        with self.assertRaises(wsl_container.ContainerPolicyViolation):
            wsl_container.validate_policy(
                replace(self.policy(), seccomp_profile=symlink),
                workspace_root=self.workspace_root,
            )

    @mock.patch("evals.forge.wsl_container.subprocess.run")
    @mock.patch("evals.forge.wsl_container.subprocess.Popen")
    def test_docker_backend_requires_remove_and_negative_inspect(
        self, popen: mock.Mock, run: mock.Mock
    ) -> None:
        process = popen.return_value
        process.communicate.return_value = (b"stdout", b"stderr")
        process.returncode = 0
        run.side_effect = (
            mock.Mock(returncode=0),
            mock.Mock(returncode=1),
        )
        result = wsl_container.DockerCliRuntime().execute(self.policy(), 30)
        self.assertTrue(result.workload_terminated)
        self.assertTrue(result.cleanup_observed)
        self.assertTrue(result.stdout_complete)
        self.assertIsInstance(popen.call_args.args[0], tuple)
        self.assertEqual(run.call_args_list[0].args[0][1:3], ("rm", "--force"))
        self.assertEqual(run.call_args_list[1].args[0][1], "inspect")
        unsafe_profile = Path(self.temporary.name) / "unsafe-seccomp.json"
        unsafe_profile.write_text(
            json.dumps(
                {
                    "defaultAction": "SCMP_ACT_ERRNO",
                    "syscalls": [
                        {"action": "SCMP_ACT_ALLOW", "names": ["read", "socket"]}
                    ],
                }
            ),
            encoding="utf-8",
        )
        digest = hashlib.sha256(unsafe_profile.read_bytes()).hexdigest()
        with self.assertRaises(wsl_container.ContainerPolicyViolation):
            wsl_container.validate_policy(
                replace(
                    self.policy(),
                    seccomp_profile=unsafe_profile,
                    seccomp_sha256=digest,
                ),
                workspace_root=self.workspace_root,
            )

    def test_launcher_maps_complete_runtime_result_to_controller_protocol(self) -> None:
        runtime = FakeRuntime()
        launcher = wsl_container.WslContainerLauncher(
            runtime=runtime,
            workspace_root=self.workspace_root,
            image=PINNED_IMAGE,
            seccomp_profile=SECCOMP,
            seccomp_sha256=SECCOMP_SHA256,
        )
        outcome = launcher.launch(self.request())
        self.assertEqual(outcome.identity, "container-uid:65532:65532")
        self.assertEqual(outcome.exit_code, 0)
        self.assertEqual(outcome.stdout, "container stdout\n")
        self.assertFalse(outcome.timed_out)
        self.assertTrue(outcome.process_tree_terminated)
        self.assertEqual(len(runtime.calls), 1)

    def test_incomplete_capture_or_termination_is_reported_fail_closed(self) -> None:
        result = wsl_container.ContainerExecution(
            exit_code=-9,
            stdout=b"partial",
            stderr=b"",
            timed_out=True,
            workload_terminated=False,
            cleanup_observed=False,
            stdout_complete=False,
            stderr_complete=True,
        )
        launcher = wsl_container.WslContainerLauncher(
            runtime=FakeRuntime(result),
            workspace_root=self.workspace_root,
            image=PINNED_IMAGE,
            seccomp_profile=SECCOMP,
            seccomp_sha256=SECCOMP_SHA256,
        )
        outcome = launcher.launch(self.request())
        self.assertTrue(outcome.timed_out)
        self.assertFalse(outcome.process_tree_terminated)
        self.assertTrue(outcome.stdout_upstream_truncated)
        self.assertFalse(outcome.stdout_stream_scan_complete)

    def test_requested_timeout_cannot_exceed_policy(self) -> None:
        runtime = FakeRuntime()
        launcher = wsl_container.WslContainerLauncher(
            runtime=runtime,
            workspace_root=self.workspace_root,
            image=PINNED_IMAGE,
            seccomp_profile=SECCOMP,
            seccomp_sha256=SECCOMP_SHA256,
        )
        with self.assertRaises(wsl_container.ContainerPolicyViolation):
            launcher.launch(self.request(timeout_seconds=301))
        self.assertEqual(runtime.calls, [])


if __name__ == "__main__":
    unittest.main()
