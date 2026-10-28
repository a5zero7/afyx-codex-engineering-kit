#!/usr/bin/env python3
"""Native-Windows, zero-model Forge integration lab.

This developer-side adapter runs one fixed public synthetic child as the current
non-admin identity. It is not a privileged launcher or formal evaluator.
"""

from __future__ import annotations

import csv
import ctypes
import io
import json
import os
import subprocess
import sys
from ctypes import wintypes
from pathlib import Path

from evals.forge import controller, wsl_lab


SYNTHETIC_STDOUT = b"afyx-windows-lab: profile-is-workspace=true\n"
SYNTHETIC_STDERR = b"afyx-windows-lab: stderr complete\n"
SYNTHETIC_ARTIFACT = wsl_lab.SYNTHETIC_ARTIFACT
SYNTHETIC_CHILD = r"""
import os
import pathlib
import subprocess
import sys
import time

mode = sys.argv[1]
workspace = pathlib.Path.cwd().resolve()
profile = pathlib.Path(os.environ["USERPROFILE"]).resolve()
if profile != workspace:
    raise SystemExit(91)
time.sleep(0.5)
if mode == "timeout":
    child = subprocess.Popen(
        [sys.executable, "-I", "-c", "import time; time.sleep(60)"],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    print(f"child-pid={child.pid}", flush=True)
    time.sleep(60)
pathlib.Path("known_math.py").write_bytes(%r)
sys.stdout.buffer.write(%r)
sys.stdout.buffer.flush()
sys.stderr.buffer.write(%r)
sys.stderr.buffer.flush()
""" % (SYNTHETIC_ARTIFACT, SYNTHETIC_STDOUT, SYNTHETIC_STDERR)


WindowsLabFaults = wsl_lab.WslLabFaults
WindowsLabEvidenceRecorder = wsl_lab.WslLabEvidenceRecorder
WindowsLabEvidenceVerifier = wsl_lab.WslLabEvidenceVerifier


def expected_identity() -> str:
    """Return the actual current Windows SID in a stable public form."""
    completed = subprocess.run(
        ["whoami.exe", "/user", "/fo", "csv", "/nh"],
        check=True,
        capture_output=True,
        text=True,
        timeout=5,
    )
    row = next(csv.reader(io.StringIO(completed.stdout)))
    if len(row) != 2 or not row[1].startswith("S-1-"):
        raise RuntimeError("Windows identity output is invalid")
    return f"windows-sid:{row[1]}"


def _pid_exists(pid: int) -> bool:
    kernel32 = ctypes.windll.kernel32
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL
    process = kernel32.OpenProcess(0x1000, False, pid)
    if not process:
        return False
    kernel32.CloseHandle(process)
    return True


class _JobBasicLimitInformation(ctypes.Structure):
    _fields_ = [
        ("PerProcessUserTimeLimit", ctypes.c_longlong),
        ("PerJobUserTimeLimit", ctypes.c_longlong),
        ("LimitFlags", ctypes.c_uint32),
        ("MinimumWorkingSetSize", ctypes.c_size_t),
        ("MaximumWorkingSetSize", ctypes.c_size_t),
        ("ActiveProcessLimit", ctypes.c_uint32),
        ("Affinity", ctypes.c_size_t),
        ("PriorityClass", ctypes.c_uint32),
        ("SchedulingClass", ctypes.c_uint32),
    ]


class _IoCounters(ctypes.Structure):
    _fields_ = [
        ("ReadOperationCount", ctypes.c_uint64),
        ("WriteOperationCount", ctypes.c_uint64),
        ("OtherOperationCount", ctypes.c_uint64),
        ("ReadTransferCount", ctypes.c_uint64),
        ("WriteTransferCount", ctypes.c_uint64),
        ("OtherTransferCount", ctypes.c_uint64),
    ]


class _JobExtendedLimitInformation(ctypes.Structure):
    _fields_ = [
        ("BasicLimitInformation", _JobBasicLimitInformation),
        ("IoInfo", _IoCounters),
        ("ProcessMemoryLimit", ctypes.c_size_t),
        ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryUsed", ctypes.c_size_t),
        ("PeakJobMemoryUsed", ctypes.c_size_t),
    ]


def _create_owned_job(process: subprocess.Popen[bytes]) -> int:
    kernel32 = ctypes.windll.kernel32
    kernel32.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    kernel32.SetInformationJobObject.argtypes = [
        wintypes.HANDLE,
        ctypes.c_int,
        ctypes.c_void_p,
        wintypes.DWORD,
    ]
    kernel32.SetInformationJobObject.restype = wintypes.BOOL
    kernel32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel32.AssignProcessToJobObject.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL
    job = kernel32.CreateJobObjectW(None, None)
    if not job:
        raise OSError("Windows job creation failed")
    information = _JobExtendedLimitInformation()
    information.BasicLimitInformation.LimitFlags = 0x00002000
    if not kernel32.SetInformationJobObject(
        job, 9, ctypes.byref(information), ctypes.sizeof(information)
    ) or not kernel32.AssignProcessToJobObject(job, process._handle):
        kernel32.CloseHandle(job)
        raise OSError("Windows job assignment failed")
    return job


def _observed_child_pid(output: bytes | None) -> int | None:
    for line in (output or b"").decode("utf-8", errors="replace").splitlines():
        if line.startswith("child-pid="):
            return int(line.removeprefix("child-pid="))
    return None


class WindowsSyntheticLauncher:
    """Actual-subprocess launcher for the fixed public Windows lab child."""

    def __init__(
        self,
        recorder: WindowsLabEvidenceRecorder,
        binding: controller.EvidenceBinding,
        *,
        mode: str = "success",
    ) -> None:
        if os.name != "nt":
            raise RuntimeError("Windows lab requires native Windows")
        if mode not in {"success", "timeout"}:
            raise ValueError("unsupported synthetic child mode")
        self.recorder = recorder
        self.binding = binding
        self.mode = mode

    def launch(self, request: controller.LaunchRequest) -> controller.ProcessOutcome:
        evidence_root = self.recorder.root
        workspace = request.workspace.resolve(strict=True)
        if (
            evidence_root == workspace
            or evidence_root in workspace.parents
            or workspace in evidence_root.parents
        ):
            raise ValueError("evidence and execution roots must be separate")

        isolated_environment = {
            "PATH": str(Path(sys.executable).parent),
            "SystemRoot": os.environ["SystemRoot"],
            "TEMP": str(workspace),
            "TMP": str(workspace),
            "USERPROFILE": str(workspace),
            "WINDIR": os.environ["WINDIR"],
        }
        process = subprocess.Popen(
            [sys.executable, "-I", "-c", SYNTHETIC_CHILD, self.mode],
            cwd=workspace,
            env=isolated_environment,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=(
                subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW
            ),
        )
        try:
            job = _create_owned_job(process)
        except Exception:
            process.kill()
            process.communicate()
            raise
        self.recorder.process_start_count += 1
        timed_out = False
        process_tree_terminated = True
        child_pid: int | None = None
        try:
            stdout, stderr = process.communicate(timeout=request.timeout_seconds)
        except subprocess.TimeoutExpired as error:
            timed_out = True
            child_pid = _observed_child_pid(error.output)
            kernel32 = ctypes.windll.kernel32
            kernel32.TerminateJobObject.argtypes = [wintypes.HANDLE, wintypes.UINT]
            kernel32.TerminateJobObject.restype = wintypes.BOOL
            process_tree_terminated = bool(
                kernel32.TerminateJobObject(job, 124)
            )
            if not process_tree_terminated:
                process.kill()
            stdout, stderr = process.communicate(timeout=10)
        finally:
            ctypes.windll.kernel32.CloseHandle(job)

        child_pid = child_pid or _observed_child_pid(stdout)
        child_alive = bool(child_pid is not None and _pid_exists(child_pid))
        process_tree_terminated = process_tree_terminated and not child_alive
        state = {
            "child_alive_after_cleanup": child_alive,
            "child_pid_observed": child_pid is not None,
            "exit_code": process.returncode,
            "launcher": "fixed-windows-synthetic-child-v1",
            "process_tree_terminated": process_tree_terminated,
            "profile_redirected_to_workspace": True,
            "timed_out": timed_out,
        }
        self.recorder.capture(
            request.evidence_session_id,
            binding=self.binding,
            stdout=stdout,
            stderr=stderr,
            process_state=state,
        )
        truncated = self.recorder.faults.truncate_stdout
        return controller.ProcessOutcome(
            identity=expected_identity(),
            exit_code=process.returncode,
            stdout=stdout.decode("utf-8", errors="replace"),
            stderr=stderr.decode("utf-8", errors="replace"),
            stdout_upstream_truncated=truncated,
            stderr_upstream_truncated=False,
            stdout_stream_scan_complete=True if truncated else None,
            stderr_stream_scan_complete=None,
            stdout_stream_forbidden_marker=False if truncated else None,
            stderr_stream_forbidden_marker=None,
            timed_out=timed_out,
            process_tree_terminated=process_tree_terminated,
            provider_tokens="NOT_AVAILABLE",
            tool_calls=0,
            retry_count=0,
        )


class BindingLauncher:
    """Bind the controller-generated evidence challenge before launch."""

    def __init__(
        self, recorder: WindowsLabEvidenceRecorder, *, mode: str = "success"
    ) -> None:
        self.recorder = recorder
        self.mode = mode

    def launch(self, request: controller.LaunchRequest) -> controller.ProcessOutcome:
        readiness = json.loads(
            (
                self.recorder.root
                / request.evidence_session_id
                / "readiness.json"
            ).read_text("utf-8")
        )
        binding = controller.EvidenceBinding(**readiness["binding"])
        return WindowsSyntheticLauncher(
            self.recorder, binding, mode=self.mode
        ).launch(request)


def synthetic_artifact_sha256() -> str:
    return wsl_lab.synthetic_artifact_sha256()
