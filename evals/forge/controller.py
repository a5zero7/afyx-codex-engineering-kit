#!/usr/bin/env python3
"""Public, synthetic-only Forge controller contract for AFYX-286.

This module deliberately contains no privileged launcher, provider client, or
private evaluator logic.  Owner-controlled integration supplies implementations
of the launcher and artifact-validator protocols after independent review.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import shutil
import stat
import tempfile
import time
import uuid
from dataclasses import dataclass
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any, Mapping, Protocol, Sequence

from evals.forge import validate as forge_validate


HEX_SHA256 = re.compile(r"^[0-9a-f]{64}$")
SAFE_CORRELATION = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
SAFE_METADATA_KEY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$")
MAX_PUBLIC_METADATA_ITEMS = 256
MAX_PUBLIC_COUNTER = 2**63 - 1
TOP_LEVEL_INPUT_FIELDS = {
    "schema_version",
    "evaluation_run_id",
    "control_run_id",
    "cell_id",
    "candidate",
    "scenario",
    "environment_sha256",
    "limits",
}
CANDIDATE_INPUT_FIELDS = {"id", "content_sha256", "activation"}
SCENARIO_INPUT_FIELDS = {
    "id",
    "category",
    "user_prompt",
    "fixture_sha256",
    "allowed_file_scope",
    "validation_command",
}
LIMIT_INPUT_FIELDS = {"timeout_seconds", "model_retries"}
RAW_OUTPUT_FIELDS = {"stdout", "stderr", "transcript", "prompt"}
PUBLIC_RESULT_FIELDS = {
    "schema_version",
    "evaluation_run_id",
    "control_run_id",
    "cell_id",
    "candidate_id",
    "scenario_id",
    "candidate_fingerprint",
    "fixture_fingerprint",
    "environment_fingerprint",
    "hard_gate_results",
    "result",
    "provider_tokens",
    "wall_time_seconds",
    "tool_calls",
    "repeated_reads",
    "retry_count",
    "first_pass_success",
    "validation_outcomes",
    "files_modified",
    "timeout",
    "cleanup",
    "exclusion_reason",
    "sanitization",
    "lifecycle",
    "evidence",
}
DEFAULT_FORBIDDEN_OUTPUT_MARKERS = tuple(
    marker.lower() for marker in forge_validate.PUBLIC_HANDOFF_FORBIDDEN
) + (
    "authorization: bearer",
    "api_key=",
    "password=",
    "private_holdout",
    "scoring_key",
)
VALIDATION_OUTCOME_FIELDS = {"command_exit_code", "content_checks", "failure_codes"}
LIFECYCLE_FIELDS = {
    "workspace_created",
    "process_tree_terminated",
    "cleanup_correlated",
}
EVIDENCE_FIELDS = {
    f"{stream}_{suffix}"
    for stream in ("stdout", "stderr")
    for suffix in ("bytes", "sha256", "truncated")
}
PUBLIC_FAILURE_CODES = {
    "advisory_validation_command_forbidden",
    "artifact_mismatch",
    "artifact_validation_failed",
    "artifact_validator_failure",
    "cleanup_failed",
    "controller_failure",
    "file_scope_violation",
    "fingerprint_mismatch",
    "identity_mismatch",
    "launcher_failure",
    "materialization_conflict",
    "process_exit_nonzero",
    "process_tree_not_terminated",
    "retry_policy",
    "timeout",
    "unexpected_process_termination",
    "unsafe_output_marker",
    "unsafe_path",
    "unsafe_reparse",
    "unsafe_source",
    "validation_exit_mismatch",
}


class ContractViolation(ValueError):
    """A stable, sanitized fail-closed contract violation."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ValidatedCell:
    evaluation_run_id: str
    control_run_id: str
    cell_id: str
    candidate_id: str
    scenario_id: str
    user_prompt: str
    allowed_file_scope: tuple[str, ...]
    validation_command: tuple[str, ...] | None
    timeout_seconds: int
    candidate_fingerprint: str
    fixture_fingerprint: str
    environment_fingerprint: str


@dataclass(frozen=True)
class WorkspaceLease:
    correlation_id: str
    root: Path
    work: Path


@dataclass(frozen=True)
class LaunchRequest:
    evaluation_run_id: str
    control_run_id: str
    cell_id: str
    workspace: Path
    user_prompt: str
    timeout_seconds: int


@dataclass(frozen=True)
class ProcessOutcome:
    identity: str
    exit_code: int | None
    stdout: str = ""
    stderr: str = ""
    timed_out: bool = False
    process_tree_terminated: bool = True
    provider_tokens: Mapping[str, int] | str = "NOT_AVAILABLE"
    tool_calls: int = 0
    retry_count: int = 0


@dataclass(frozen=True)
class ArtifactValidation:
    command_exit_code: int | None
    content_checks: Mapping[str, bool]

    @property
    def passed(self) -> bool:
        return bool(self.content_checks) and all(self.content_checks.values())


class RestrictedProcessLauncher(Protocol):
    """Owner integration must launch only as the reviewed restricted identity."""

    def launch(self, request: LaunchRequest) -> ProcessOutcome:
        ...


class ArtifactValidator(Protocol):
    """Validation must run in the restricted boundary, never as owner/evaluator."""

    def validate(
        self,
        request: LaunchRequest,
        outcome: ProcessOutcome,
        files_modified: Sequence[str],
    ) -> ArtifactValidation:
        ...


def _sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _raw_file_sha256(path: Path) -> str:
    return _sha256_bytes(path.read_bytes())


def _require_object(value: Any, fields: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ContractViolation("malformed_input", f"{label} must be an object")
    keys = set(value)
    if keys != fields:
        raise ContractViolation("malformed_input", f"{label} fields do not match the public schema")
    return value


def _require_correlation(value: Any, label: str) -> str:
    if not isinstance(value, str) or not SAFE_CORRELATION.fullmatch(value):
        raise ContractViolation("malformed_input", f"{label} is not a safe correlation identifier")
    return value


def _require_sha256(value: Any, label: str) -> str:
    if not isinstance(value, str) or not HEX_SHA256.fullmatch(value):
        raise ContractViolation("malformed_input", f"{label} must be a lowercase SHA-256")
    return value


def normalize_relative_path(value: Any) -> str:
    """Return one canonical POSIX relative path or fail closed."""

    if not isinstance(value, str) or not value or "\x00" in value or "\\" in value:
        raise ContractViolation("unsafe_path", "allowed path is not canonical POSIX-relative")
    posix = PurePosixPath(value)
    windows = PureWindowsPath(value)
    if posix.is_absolute() or windows.is_absolute() or windows.drive:
        raise ContractViolation("unsafe_path", "absolute or drive-qualified path rejected")
    if any(part in {"", ".", ".."} for part in posix.parts):
        raise ContractViolation("unsafe_path", "path traversal or normalization segment rejected")
    canonical = posix.as_posix()
    if canonical != value:
        raise ContractViolation("unsafe_path", "non-canonical relative path rejected")
    return canonical


def _is_reparse(path: Path) -> bool:
    metadata = path.lstat()
    attributes = getattr(metadata, "st_file_attributes", 0)
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    return path.is_symlink() or bool(attributes & reparse_flag)


def assert_safe_ancestry(path: Path) -> None:
    """Reject an existing path reached through any symlink/reparse ancestor."""

    absolute = path.absolute()
    for entry in reversed((absolute, *absolute.parents)):
        if entry.exists() and _is_reparse(entry):
            raise ContractViolation("unsafe_reparse", "path ancestry contains a reparse point")


def assert_safe_tree(root: Path) -> None:
    """Reject links/reparse points and any resolved descendant outside root."""

    unresolved_root = root.absolute()
    if _is_reparse(unresolved_root):
        raise ContractViolation("unsafe_reparse", "tree root is a reparse point")
    root = unresolved_root.resolve(strict=True)
    for entry in sorted(root.rglob("*"), key=lambda item: item.relative_to(root).as_posix()):
        if _is_reparse(entry):
            raise ContractViolation("unsafe_reparse", "tree contains a reparse point")
        try:
            entry.resolve(strict=True).relative_to(root)
        except ValueError as error:
            raise ContractViolation("unsafe_path", "tree entry resolves outside its root") from error


def _copy_tree_contents(source: Path, destination: Path) -> None:
    assert_safe_tree(source)
    destination.mkdir(parents=True, exist_ok=True)
    for entry in sorted(source.rglob("*"), key=lambda item: item.relative_to(source).as_posix()):
        relative = entry.relative_to(source)
        target = destination / relative
        if entry.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        if not entry.is_file():
            raise ContractViolation("unsafe_source", "source contains an unsupported entry")
        if target.exists():
            raise ContractViolation("materialization_conflict", "materialization would overwrite a file")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(entry, target)


def _verify_copy(source: Path, destination: Path) -> None:
    for entry in sorted(source.rglob("*"), key=lambda item: item.relative_to(source).as_posix()):
        if not entry.is_file():
            continue
        target = destination / entry.relative_to(source)
        if not target.is_file() or _raw_file_sha256(target) != _raw_file_sha256(entry):
            raise ContractViolation("artifact_mismatch", "materialized artifact content mismatch")


def _materialize_candidate(
    manifest: Mapping[str, Any], candidate_id: str, repository_root: Path, work: Path
) -> None:
    candidate = manifest["candidates"][candidate_id]
    contract = candidate["materialization"]
    kind = contract["kind"]
    if kind == "empty_workspace":
        for relative in contract["must_be_absent"]:
            if (work / normalize_relative_path(relative)).exists():
                raise ContractViolation("candidate_mismatch", "empty candidate contract violated")
        return
    if kind == "ordered_composition":
        for component in contract["components"]:
            _materialize_candidate(manifest, component, repository_root, work)
        return
    if kind not in {"copy_tree", "copy_tree_contents"}:
        raise ContractViolation("candidate_mismatch", "unsupported materialization contract")
    source_relative = normalize_relative_path(contract["source"])
    destination_relative = contract["destination"]
    source_input = repository_root / source_relative
    assert_safe_tree(source_input)
    source = source_input.resolve(strict=True)
    try:
        source.relative_to(repository_root.resolve(strict=True))
    except ValueError as error:
        raise ContractViolation("unsafe_source", "candidate source escapes repository") from error
    destination = work if destination_relative == "." else work / normalize_relative_path(destination_relative)
    _copy_tree_contents(source, destination)
    _verify_copy(source, destination)


def _snapshot(root: Path) -> dict[str, str]:
    assert_safe_tree(root)
    return {
        path.relative_to(root).as_posix(): _raw_file_sha256(path)
        for path in sorted(root.rglob("*"), key=lambda item: item.relative_to(root).as_posix())
        if path.is_file()
    }


def _changed_files(before: Mapping[str, str], after: Mapping[str, str]) -> list[str]:
    return sorted(
        relative
        for relative in set(before) | set(after)
        if before.get(relative) != after.get(relative)
    )


def validate_cell_input(
    payload: Any,
    manifest: Mapping[str, Any],
    repository_root: Path,
    expected_environment_fingerprint: str,
    max_timeout_seconds: int,
) -> ValidatedCell:
    """Validate one public input against the exact frozen manifest."""

    violations = forge_validate.validate_manifest(dict(manifest))
    if violations:
        raise ContractViolation("manifest_invalid", "public Forge manifest failed validation")
    data = _require_object(payload, TOP_LEVEL_INPUT_FIELDS, "cell input")
    if data["schema_version"] != 1:
        raise ContractViolation("malformed_input", "unsupported cell input schema version")
    evaluation_run_id = _require_correlation(data["evaluation_run_id"], "evaluation_run_id")
    control_run_id = _require_correlation(data["control_run_id"], "control_run_id")
    cell_id = data["cell_id"]
    if not isinstance(cell_id, str) or not cell_id or len(cell_id) > 256:
        raise ContractViolation("malformed_input", "cell_id must be a bounded string")

    candidate_data = _require_object(data["candidate"], CANDIDATE_INPUT_FIELDS, "candidate")
    candidate_id = candidate_data["id"]
    if candidate_id not in manifest["candidate_order"]:
        raise ContractViolation("candidate_mismatch", "candidate is not in the frozen order")
    candidate = manifest["candidates"][candidate_id]
    candidate_fingerprint = _require_sha256(candidate_data["content_sha256"], "candidate fingerprint")
    if candidate_fingerprint != candidate["content_identity"]:
        raise ContractViolation("fingerprint_mismatch", "candidate fingerprint mismatch")
    if candidate_data["activation"] != candidate["activation"]:
        raise ContractViolation("candidate_mismatch", "candidate activation mismatch")

    scenario_data = _require_object(data["scenario"], SCENARIO_INPUT_FIELDS, "scenario")
    scenario_id = scenario_data["id"]
    scenario = next(
        (item for item in manifest["scenarios"] if item["scenario_id"] == scenario_id), None
    )
    if scenario is None:
        raise ContractViolation("scenario_mismatch", "scenario is not frozen in the manifest")
    provided_scope = scenario_data["allowed_file_scope"]
    if not isinstance(provided_scope, list):
        raise ContractViolation("malformed_input", "allowed_file_scope must be a list")
    allowed_file_scope = tuple(normalize_relative_path(relative) for relative in provided_scope)
    expected_scenario = {
        "id": scenario["scenario_id"],
        "category": scenario["category"],
        "user_prompt": scenario["user_prompt"],
        "fixture_sha256": manifest["public_fixture"]["tree_sha256"],
        "allowed_file_scope": scenario["allowed_file_scope"],
        "validation_command": scenario["validation_command"],
    }
    if scenario_data != expected_scenario:
        raise ContractViolation("scenario_mismatch", "scenario contract differs from the frozen manifest")
    fixture_fingerprint = _require_sha256(
        scenario_data["fixture_sha256"], "fixture fingerprint"
    )
    source = (repository_root / manifest["public_fixture"]["path"]).resolve(strict=True)
    if forge_validate.directory_sha256(source) != fixture_fingerprint:
        raise ContractViolation("fingerprint_mismatch", "fixture fingerprint mismatch")

    environment_fingerprint = _require_sha256(
        data["environment_sha256"], "environment fingerprint"
    )
    if environment_fingerprint != expected_environment_fingerprint:
        raise ContractViolation("fingerprint_mismatch", "environment fingerprint mismatch")
    limits = _require_object(data["limits"], LIMIT_INPUT_FIELDS, "limits")
    timeout_seconds = limits["timeout_seconds"]
    if type(timeout_seconds) is not int or not 1 <= timeout_seconds <= max_timeout_seconds:
        raise ContractViolation("malformed_input", "timeout is outside the approved bound")
    if limits["model_retries"] != 0:
        raise ContractViolation("retry_policy", "model retries must remain zero")

    expected_cell_id = f"{scenario_id}::{candidate_id}::r1"
    if cell_id != expected_cell_id or cell_id not in forge_validate.discovery_cells(dict(manifest)):
        raise ContractViolation("cell_mismatch", "cell is not in the frozen discovery order")
    command = scenario_data["validation_command"]
    return ValidatedCell(
        evaluation_run_id=evaluation_run_id,
        control_run_id=control_run_id,
        cell_id=cell_id,
        candidate_id=candidate_id,
        scenario_id=scenario_id,
        user_prompt=scenario_data["user_prompt"],
        allowed_file_scope=allowed_file_scope,
        validation_command=tuple(command) if command is not None else None,
        timeout_seconds=timeout_seconds,
        candidate_fingerprint=candidate_fingerprint,
        fixture_fingerprint=fixture_fingerprint,
        environment_fingerprint=environment_fingerprint,
    )


class DisposableWorkspaceManager:
    """Create and clean only leases correlated under one caller-owned root."""

    def __init__(self, root: Path) -> None:
        unresolved_root = root.absolute()
        assert_safe_ancestry(unresolved_root)
        self.root = unresolved_root.resolve(strict=True)
        self._active: dict[str, Path] = {}

    def create(self, evaluation_run_id: str) -> WorkspaceLease:
        correlation_id = uuid.uuid4().hex
        prefix = f"afyx-{evaluation_run_id[:24]}-"
        root = Path(tempfile.mkdtemp(prefix=prefix, dir=self.root)).resolve(strict=True)
        assert_safe_ancestry(root)
        work = root / "work"
        work.mkdir()
        self._active[correlation_id] = root
        return WorkspaceLease(correlation_id=correlation_id, root=root, work=work)

    def cleanup(self, lease: WorkspaceLease) -> bool:
        registered = self._active.get(lease.correlation_id)
        if registered != lease.root or lease.root.parent != self.root:
            return False
        try:
            if _is_reparse(lease.root):
                return False
            shutil.rmtree(lease.root)
        except OSError:
            return False
        self._active.pop(lease.correlation_id, None)
        return not lease.root.exists()


class DigestArtifactValidator:
    """Synthetic content validator; it executes no command or returned code."""

    def __init__(self, expected_sha256: Mapping[str, str], command_exit_code: int | None) -> None:
        self.expected_sha256 = {
            normalize_relative_path(path): _require_sha256(digest, "expected artifact digest")
            for path, digest in expected_sha256.items()
        }
        self.command_exit_code = command_exit_code

    def validate(
        self,
        request: LaunchRequest,
        outcome: ProcessOutcome,
        files_modified: Sequence[str],
    ) -> ArtifactValidation:
        checks: dict[str, bool] = {
            "expected_file_set": set(files_modified) == set(self.expected_sha256)
        }
        for relative, expected in self.expected_sha256.items():
            target = request.workspace / relative
            checks[f"sha256:{relative}"] = (
                target.is_file() and forge_validate.file_sha256(target) == expected
            )
        if not self.expected_sha256:
            checks["no_files_modified"] = not files_modified
        return ArtifactValidation(self.command_exit_code, checks)


def validate_public_result(result: Mapping[str, Any], manifest: Mapping[str, Any]) -> None:
    if set(result) != PUBLIC_RESULT_FIELDS:
        raise ContractViolation("result_schema", "public result fields do not match the schema")
    missing = set(manifest["result_schema"]["required_fields"]) - set(result)
    if missing:
        raise ContractViolation("result_schema", "public result is missing required fields")
    if RAW_OUTPUT_FIELDS & set(result):
        raise ContractViolation("result_schema", "raw private-capable output is not publishable")
    retry_count = result.get("retry_count")
    if (
        type(retry_count) is not int
        or retry_count < 0
        or retry_count > MAX_PUBLIC_COUNTER
    ):
        raise ContractViolation("result_schema", "public retry count is invalid")
    if result.get("candidate_id") not in manifest["candidate_order"]:
        raise ContractViolation("result_schema", "public result candidate is not frozen")
    candidate = manifest["candidates"][result["candidate_id"]]
    if result.get("candidate_fingerprint") != candidate["content_identity"]:
        raise ContractViolation("result_schema", "public result candidate fingerprint mismatch")
    scenarios = {scenario["scenario_id"]: scenario for scenario in manifest["scenarios"]}
    if result.get("scenario_id") not in scenarios:
        raise ContractViolation("result_schema", "public result scenario is not frozen")
    if result.get("fixture_fingerprint") != manifest["public_fixture"]["tree_sha256"]:
        raise ContractViolation("result_schema", "public result fixture fingerprint mismatch")
    if result.get("schema_version") != 1 or result.get("result") not in {"PASS", "FAIL"}:
        raise ContractViolation("result_schema", "public result state is invalid")
    hard_gates = result.get("hard_gate_results")
    if not isinstance(hard_gates, dict) or set(hard_gates) != set(forge_validate.HARD_GATES):
        raise ContractViolation("result_schema", "public hard-gate fields are invalid")
    if any(
        verdict not in {"PASS", "FAIL", "BLOCKED", "NOT_TESTED"}
        for verdict in hard_gates.values()
    ):
        raise ContractViolation("result_schema", "public hard-gate verdict is invalid")
    if not isinstance(result.get("files_modified"), list):
        raise ContractViolation("result_schema", "files_modified must be a public list")
    for relative in result["files_modified"]:
        normalize_relative_path(relative)
    if type(result.get("timeout")) is not bool or result.get("cleanup") not in {"PASS", "FAIL"}:
        raise ContractViolation("result_schema", "public lifecycle state is invalid")
    if result.get("sanitization") not in {"PASS", "FAIL"}:
        raise ContractViolation("result_schema", "public sanitization state is invalid")
    for field in ("tool_calls", "repeated_reads"):
        value = result.get(field)
        if type(value) is not int or not 0 <= value <= MAX_PUBLIC_COUNTER:
            raise ContractViolation("result_schema", f"public {field} is invalid")
    wall_time = result.get("wall_time_seconds")
    if (
        type(wall_time) not in {int, float}
        or not math.isfinite(wall_time)
        or wall_time < 0
        or wall_time > 86_400
    ):
        raise ContractViolation("result_schema", "public wall time is invalid")
    if type(result.get("first_pass_success")) is not bool:
        raise ContractViolation("result_schema", "public first-pass state is invalid")

    tokens = result.get("provider_tokens")
    if tokens != "NOT_AVAILABLE":
        if not isinstance(tokens, dict) or not 1 <= len(tokens) <= 16:
            raise ContractViolation("result_schema", "public provider tokens are invalid")
        for key, value in tokens.items():
            if (
                not isinstance(key, str)
                or not SAFE_METADATA_KEY.fullmatch(key)
                or any(marker in key.casefold() for marker in DEFAULT_FORBIDDEN_OUTPUT_MARKERS)
                or type(value) is not int
                or not 0 <= value <= MAX_PUBLIC_COUNTER
            ):
                raise ContractViolation("result_schema", "public provider token metadata is unsafe")

    outcomes = result.get("validation_outcomes")
    if not isinstance(outcomes, dict) or set(outcomes) != VALIDATION_OUTCOME_FIELDS:
        raise ContractViolation("result_schema", "public validation outcomes are invalid")
    exit_code = outcomes["command_exit_code"]
    if exit_code is not None and (
        type(exit_code) is not int or not -(2**31) <= exit_code < 2**31
    ):
        raise ContractViolation("result_schema", "public validation exit code is invalid")
    checks = outcomes["content_checks"]
    if not isinstance(checks, dict) or not 1 <= len(checks) <= MAX_PUBLIC_METADATA_ITEMS:
        raise ContractViolation("result_schema", "public content checks are invalid")
    for key, value in checks.items():
        if (
            not isinstance(key, str)
            or not SAFE_METADATA_KEY.fullmatch(key)
            or any(marker in key.casefold() for marker in DEFAULT_FORBIDDEN_OUTPUT_MARKERS)
            or type(value) is not bool
        ):
            raise ContractViolation("result_schema", "public content-check metadata is unsafe")
    failure_codes = outcomes["failure_codes"]
    if (
        not isinstance(failure_codes, list)
        or len(failure_codes) > len(PUBLIC_FAILURE_CODES)
        or len(failure_codes) != len(set(failure_codes))
        or any(code not in PUBLIC_FAILURE_CODES for code in failure_codes)
    ):
        raise ContractViolation("result_schema", "public failure codes are invalid")

    lifecycle = result.get("lifecycle")
    if (
        not isinstance(lifecycle, dict)
        or set(lifecycle) != LIFECYCLE_FIELDS
        or any(type(value) is not bool for value in lifecycle.values())
    ):
        raise ContractViolation("result_schema", "public lifecycle metadata is invalid")
    evidence = result.get("evidence")
    if not isinstance(evidence, dict) or set(evidence) not in (set(), EVIDENCE_FIELDS):
        raise ContractViolation("result_schema", "public evidence metadata is invalid")
    if evidence:
        for stream in ("stdout", "stderr"):
            size = evidence[f"{stream}_bytes"]
            digest = evidence[f"{stream}_sha256"]
            truncated = evidence[f"{stream}_truncated"]
            if (
                type(size) is not int
                or not 0 <= size <= MAX_PUBLIC_COUNTER
                or not isinstance(digest, str)
                or not HEX_SHA256.fullmatch(digest)
                or type(truncated) is not bool
            ):
                raise ContractViolation("result_schema", "public evidence values are invalid")


class PublicController:
    """Deterministic public orchestration around injected restricted interfaces."""

    def __init__(
        self,
        *,
        manifest: Mapping[str, Any],
        repository_root: Path,
        workspace_manager: DisposableWorkspaceManager,
        launcher: RestrictedProcessLauncher,
        artifact_validator: ArtifactValidator,
        expected_environment_fingerprint: str,
        expected_restricted_identity: str,
        max_timeout_seconds: int = 600,
        max_capture_bytes: int = 65_536,
        forbidden_output_markers: Sequence[str] = DEFAULT_FORBIDDEN_OUTPUT_MARKERS,
    ) -> None:
        self.manifest = manifest
        self.repository_root = repository_root.resolve(strict=True)
        self.workspace_manager = workspace_manager
        self.launcher = launcher
        self.artifact_validator = artifact_validator
        self.expected_environment_fingerprint = _require_sha256(
            expected_environment_fingerprint, "expected environment fingerprint"
        )
        if not expected_restricted_identity:
            raise ContractViolation("identity_mismatch", "restricted identity must be explicit")
        self.expected_restricted_identity = expected_restricted_identity.casefold()
        self.max_timeout_seconds = max_timeout_seconds
        self.max_capture_bytes = max_capture_bytes
        self.forbidden_output_markers = tuple(marker.casefold() for marker in forbidden_output_markers)

    def _materialize(self, cell: ValidatedCell, work: Path) -> dict[str, str]:
        fixture_source_input = self.repository_root / self.manifest["public_fixture"]["path"]
        assert_safe_tree(fixture_source_input)
        fixture_source = fixture_source_input.resolve(strict=True)
        if forge_validate.directory_sha256(fixture_source) != cell.fixture_fingerprint:
            raise ContractViolation("fingerprint_mismatch", "fixture changed before materialization")
        _copy_tree_contents(fixture_source, work)
        _verify_copy(fixture_source, work)
        _materialize_candidate(self.manifest, cell.candidate_id, self.repository_root, work)
        assert_safe_tree(work)
        return _snapshot(work)

    def _evidence(self, outcome: ProcessOutcome) -> tuple[dict[str, Any], bool]:
        evidence: dict[str, Any] = {}
        safe = True
        for label, value in (("stdout", outcome.stdout), ("stderr", outcome.stderr)):
            encoded = value.encode("utf-8", errors="replace")
            bounded = encoded[: self.max_capture_bytes]
            # Publication stays bounded, but the fail-closed marker check covers
            # the complete captured stream so a suffix cannot bypass sanitization.
            text = value.casefold()
            marker_found = any(marker in text for marker in self.forbidden_output_markers)
            safe = safe and not marker_found
            evidence[f"{label}_bytes"] = len(encoded)
            evidence[f"{label}_sha256"] = _sha256_bytes(bounded)
            evidence[f"{label}_truncated"] = len(encoded) > len(bounded)
        return evidence, safe

    def run(self, payload: Any) -> dict[str, Any]:
        cell = validate_cell_input(
            payload,
            self.manifest,
            self.repository_root,
            self.expected_environment_fingerprint,
            self.max_timeout_seconds,
        )
        started = time.monotonic()
        lease: WorkspaceLease | None = None
        outcome: ProcessOutcome | None = None
        validation = ArtifactValidation(None, {"not_executed": False})
        files_modified: list[str] = []
        failure_codes: list[str] = []
        evidence: dict[str, Any] = {}
        sanitization = "PASS"
        cleanup = "FAIL"
        try:
            lease = self.workspace_manager.create(cell.evaluation_run_id)
            before = self._materialize(cell, lease.work)
            request = LaunchRequest(
                evaluation_run_id=cell.evaluation_run_id,
                control_run_id=cell.control_run_id,
                cell_id=cell.cell_id,
                workspace=lease.work,
                user_prompt=cell.user_prompt,
                timeout_seconds=cell.timeout_seconds,
            )
            try:
                outcome = self.launcher.launch(request)
            except Exception:
                failure_codes.append("launcher_failure")
            if outcome is not None:
                evidence, output_safe = self._evidence(outcome)
                if not output_safe:
                    sanitization = "FAIL"
                    failure_codes.append("unsafe_output_marker")
                if outcome.identity.casefold() != self.expected_restricted_identity:
                    failure_codes.append("identity_mismatch")
                if outcome.retry_count != 0:
                    failure_codes.append("retry_policy")
                if outcome.timed_out:
                    failure_codes.append("timeout")
                elif outcome.exit_code is None:
                    failure_codes.append("unexpected_process_termination")
                elif outcome.exit_code != 0:
                    failure_codes.append("process_exit_nonzero")
                if not outcome.process_tree_terminated:
                    failure_codes.append("process_tree_not_terminated")
                try:
                    after = _snapshot(lease.work)
                    files_modified = _changed_files(before, after)
                except ContractViolation as error:
                    failure_codes.append(error.code)
                unsafe_mutations = sorted(set(files_modified) - set(cell.allowed_file_scope))
                if unsafe_mutations:
                    failure_codes.append("file_scope_violation")
                try:
                    validation = self.artifact_validator.validate(
                        request, outcome, files_modified
                    )
                except Exception:
                    failure_codes.append("artifact_validator_failure")
                if cell.validation_command is not None:
                    scenario = next(
                        item for item in self.manifest["scenarios"]
                        if item["scenario_id"] == cell.scenario_id
                    )
                    if validation.command_exit_code != scenario["target_validation_exit"]:
                        failure_codes.append("validation_exit_mismatch")
                elif validation.command_exit_code is not None:
                    failure_codes.append("advisory_validation_command_forbidden")
                if not validation.passed:
                    failure_codes.append("artifact_validation_failed")
        except ContractViolation as error:
            failure_codes.append(error.code)
        except Exception:
            failure_codes.append("controller_failure")
        finally:
            if lease is not None:
                cleanup = "PASS" if self.workspace_manager.cleanup(lease) else "FAIL"
                if cleanup == "FAIL":
                    failure_codes.append("cleanup_failed")

        failure_codes = list(dict.fromkeys(failure_codes))
        passed = not failure_codes
        result = {
            "schema_version": 1,
            "evaluation_run_id": cell.evaluation_run_id,
            "control_run_id": cell.control_run_id,
            "cell_id": cell.cell_id,
            "candidate_id": cell.candidate_id,
            "scenario_id": cell.scenario_id,
            "candidate_fingerprint": cell.candidate_fingerprint,
            "fixture_fingerprint": cell.fixture_fingerprint,
            "environment_fingerprint": cell.environment_fingerprint,
            "hard_gate_results": {
                gate: "NOT_TESTED" for gate in forge_validate.HARD_GATES
            },
            "result": "PASS" if passed else "FAIL",
            "provider_tokens": outcome.provider_tokens if outcome else "NOT_AVAILABLE",
            "wall_time_seconds": round(time.monotonic() - started, 6),
            "tool_calls": outcome.tool_calls if outcome else 0,
            "repeated_reads": 0,
            "retry_count": outcome.retry_count if outcome else 0,
            "first_pass_success": passed,
            "validation_outcomes": {
                "command_exit_code": validation.command_exit_code,
                "content_checks": dict(validation.content_checks),
                "failure_codes": failure_codes,
            },
            "files_modified": files_modified,
            "timeout": outcome.timed_out if outcome else False,
            "cleanup": cleanup,
            "exclusion_reason": None if passed else ",".join(failure_codes),
            "sanitization": sanitization,
            "lifecycle": {
                "workspace_created": lease is not None,
                "process_tree_terminated": outcome.process_tree_terminated if outcome else False,
                "cleanup_correlated": cleanup == "PASS",
            },
            "evidence": evidence,
        }
        validate_public_result(result, self.manifest)
        return result


def load_public_manifest(path: Path = forge_validate.MANIFEST_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))
