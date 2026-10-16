#!/usr/bin/env python3
"""Validate Forge T09.P0 public preparation without running model cells."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import random
import shutil
import subprocess
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
FORGE_ROOT = Path(__file__).resolve().parent
MANIFEST_PATH = FORGE_ROOT / "manifest.json"
EXPECTED_CANDIDATES = ["B0", "B1", "B2", "B3", "B4", "B5"]
EXPECTED_CATEGORIES = [
    "known_file_bug",
    "unknown_defect_diagnosis",
    "cross_module_change",
    "security_sensitive_change",
    "data_reliability_change",
    "negative_simple_task",
]
HARD_GATES = ["correctness", "task_fidelity", "evidence_quality", "security"]
REQUIRED_OWNER_DECISIONS = {
    "runtime_configuration",
    "forge_36_cell_budget",
    "confirmation_budget",
    "independent_evaluator_arrangement",
    "final_campaign_execution",
}
EXPECTED_MATERIALIZATION = {
    "B0": {
        "kind": "empty_workspace",
        "must_be_absent": ["AGENTS.md", ".agents/skills/efficient-coding"],
    },
    "B1": {
        "kind": "copy_tree",
        "source": "skills/efficient-coding",
        "destination": ".agents/skills/efficient-coding",
        "identity_root": ".agents/skills/efficient-coding",
    },
    "B5": {
        "kind": "copy_tree_contents",
        "source": "evals/forge/candidates/B5",
        "destination": ".",
        "identity_root": ".",
    },
}
EXPECTED_CAMPAIGN_BLOCKERS = [
    "B2_B3_IDENTITY_AND_AUTHORIZATION",
    "B4_EXECUTABLE_IDENTITY",
    "OWNER_APPROVED_RUNTIME_CONFIGURATION",
    "INDEPENDENTLY_ENFORCED_EVALUATOR_ISOLATION",
    "EXPLICIT_36_CELL_BUDGET_APPROVAL",
    "INDEPENDENT_EVALUATOR_ARRANGEMENT_APPROVAL",
    "FINAL_CAMPAIGN_EXECUTION_APPROVAL",
    "EVALUATOR_ONLY_BUNDLE_FREEZE",
    "ALL_B0_B5_EXECUTABLE_FINGERPRINTS",
]
PRIVATE_MARKERS = (
    "evaluator_rubric",
    "private_holdout",
    "private holdout",
    "canary_value",
    "expected_answer",
)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def canonical_content(path: Path) -> bytes:
    content = path.read_bytes()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        return content
    return text.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")


def file_sha256(path: Path) -> str:
    return hashlib.sha256(canonical_content(path)).hexdigest()


def directory_sha256(root: Path) -> str:
    digest = hashlib.sha256()
    files = sorted(
        (path for path in root.rglob("*") if path.is_file()),
        key=lambda path: path.relative_to(root).as_posix(),
    )
    for path in files:
        relative = path.relative_to(root).as_posix().encode("utf-8")
        digest.update(relative)
        digest.update(b"\0")
        digest.update(canonical_content(path))
        digest.update(b"\0")
    return digest.hexdigest()


def repository_path(value: str, violations: list[str], label: str) -> Path | None:
    path = (REPO_ROOT / value).resolve()
    try:
        path.relative_to(REPO_ROOT.resolve())
    except ValueError:
        violations.append(f"{label} escapes repository: {value}")
        return None
    return path


def discovery_cells(manifest: dict) -> list[str]:
    cells = [
        f"{scenario['scenario_id']}::{candidate}::r1"
        for scenario in manifest["scenarios"]
        for candidate in manifest["candidate_order"]
    ]
    random.Random(manifest["discovery"]["seed"]).shuffle(cells)
    return cells


def discovery_order_sha256(manifest: dict) -> str:
    payload = "\n".join(discovery_cells(manifest)).encode("utf-8") + b"\n"
    return hashlib.sha256(payload).hexdigest()


def validate_manifest(manifest: dict) -> list[str]:
    violations: list[str] = []
    if manifest.get("schema_version") != 1 or manifest.get("task") != "T09.P0":
        violations.append("manifest schema_version/task mismatch")
    if manifest.get("candidate_order") != EXPECTED_CANDIDATES:
        violations.append("candidate_order must be exact B0-B5")

    candidates = manifest.get("candidates")
    if not isinstance(candidates, dict) or list(candidates) != EXPECTED_CANDIDATES:
        violations.append("candidates must define exact ordered B0-B5")
        candidates = {}

    contract = manifest.get("a0_contract", {})
    contract_path = repository_path(contract.get("path", ""), violations, "a0_contract")
    if not contract_path or not contract_path.is_file():
        violations.append("A0 contract file is missing")
    elif file_sha256(contract_path) != contract.get("sha256"):
        violations.append("A0 contract SHA-256 mismatch")

    environment = manifest.get("environment", {})
    environment_path = repository_path(environment.get("path", ""), violations, "environment")
    if not environment_path or not environment_path.is_file():
        violations.append("proposed environment file is missing")
    else:
        if file_sha256(environment_path) != environment.get("sha256"):
            violations.append("proposed environment SHA-256 mismatch")
        proposal = load_json(environment_path)
        if proposal.get("status") != "OWNER_APPROVAL_REQUIRED":
            violations.append("proposed environment must remain OWNER_APPROVAL_REQUIRED")
        if proposal.get("campaign_source_revision") is not None:
            violations.append("unapproved campaign_source_revision must remain null")
        decisions = proposal.get("owner_decisions", {})
        if set(decisions) != REQUIRED_OWNER_DECISIONS:
            violations.append("owner decision register must contain exact P1 approvals")
        if any(value != "NOT_APPROVED" for value in decisions.values()):
            violations.append("owner decisions cannot be approved by preparation")

    if candidates:
        b0 = candidates["B0"]
        expected_b0 = hashlib.sha256(
            b"AFYX_FORGE_B0_NO_ADDITIONAL_DIRECTIVE\n"
        ).hexdigest()
        if b0.get("content_identity") != expected_b0 or b0.get("source") is not None:
            violations.append("B0 empty-directive identity mismatch")

        for candidate_id in ("B1", "B5"):
            candidate = candidates[candidate_id]
            source = repository_path(
                candidate.get("source", ""), violations, f"candidate {candidate_id}"
            )
            if not source or not source.is_dir():
                violations.append(f"candidate {candidate_id} source is missing")
            elif directory_sha256(source) != candidate.get("content_identity"):
                violations.append(f"candidate {candidate_id} content identity mismatch")

        for candidate_id, expected in EXPECTED_MATERIALIZATION.items():
            if candidates[candidate_id].get("materialization") != expected:
                violations.append(
                    f"candidate {candidate_id} materialization contract mismatch"
                )

        b2 = candidates["B2"]
        if (
            b2.get("readiness") != "BLOCKED_INPUT_AND_AUTHORIZATION_UNRESOLVED"
            or b2.get("content_identity") is not None
            or b2.get("source") is not None
        ):
            violations.append("B2 must remain blocked without guessed content")
        if candidates["B3"].get("composition_order") != ["B1", "B2"]:
            violations.append("B3 composition order must be B1 then B2")
        if candidates["B4"].get("readiness") != "BLOCKED_BY_B2_AND_NOT_CONSTRUCTED":
            violations.append("B4 cannot be represented as constructed before B2 review")
        if candidates["B5"].get("product_status") != (
            "evaluation prototype; not production Forge and not A8-approved architecture"
        ):
            violations.append("B5 evaluation-only product boundary is missing")

    fixture = manifest.get("public_fixture", {})
    fixture_path = repository_path(fixture.get("path", ""), violations, "public_fixture")
    if not fixture_path or not fixture_path.is_dir():
        violations.append("public fixture directory is missing")
    elif directory_sha256(fixture_path) != fixture.get("tree_sha256"):
        violations.append("public fixture tree identity mismatch")

    categories = manifest.get("categories")
    if categories != EXPECTED_CATEGORIES:
        violations.append("categories must match the frozen A0 order")
    scenarios = manifest.get("scenarios")
    if not isinstance(scenarios, list) or len(scenarios) != 6:
        violations.append("exactly six public scenarios are required")
        scenarios = []
    if scenarios and [scenario.get("category") for scenario in scenarios] != EXPECTED_CATEGORIES:
        violations.append("each frozen category must have one ordered public scenario")
    if len({scenario.get("scenario_id") for scenario in scenarios}) != len(scenarios):
        violations.append("scenario IDs must be unique")

    for scenario in scenarios:
        label = f"scenario {scenario.get('scenario_id', '<missing>')}"
        if scenario.get("fixture") != fixture.get("path"):
            violations.append(f"{label} must use the frozen public fixture")
        for relative in scenario.get("allowed_file_scope", []):
            candidate_path = (fixture_path / relative).resolve() if fixture_path else None
            if not candidate_path:
                violations.append(f"{label} allowed path is missing: {relative}")
            elif fixture_path not in candidate_path.parents:
                violations.append(f"{label} allowed path escapes fixture: {relative}")
            elif not candidate_path.is_file():
                violations.append(f"{label} allowed path is missing: {relative}")
        command = scenario.get("validation_command")
        if command is not None:
            if not isinstance(command, list) or command[:4] != ["python", "-m", "unittest", "-q"]:
                violations.append(f"{label} has an unsupported validation command")
            elif not fixture_path or not (fixture_path / command[-1]).is_file():
                violations.append(f"{label} validation target is missing")
            if scenario.get("baseline_expected_exit") != 1:
                violations.append(f"{label} coding baseline must fail deterministically")
            if scenario.get("target_validation_exit") != 0:
                violations.append(f"{label} target validation must be zero")
        elif scenario.get("category") != "negative_simple_task":
            violations.append(f"{label} lacks deterministic validation")

    discovery = manifest.get("discovery", {})
    expected_cells = len(EXPECTED_CANDIDATES) * len(EXPECTED_CATEGORIES)
    if discovery.get("expected_cells") != expected_cells:
        violations.append("discovery expected_cells must be 36")
    if discovery.get("execution_authorized") is not False:
        violations.append("T09.P0 must not authorize benchmark execution")
    if discovery.get("budget") != "NOT_APPROVED":
        violations.append("Forge discovery budget must remain NOT_APPROVED")
    cells = discovery_cells(manifest) if scenarios else []
    if len(cells) != expected_cells or len(set(cells)) != expected_cells:
        violations.append("discovery matrix must contain 36 unique cells")
    if discovery.get("cell_order_sha256") != discovery_order_sha256(manifest):
        violations.append("discovery cell-order identity mismatch")

    evaluator = manifest.get("evaluator_bundle", {})
    if evaluator.get("status") != "NOT_FROZEN":
        violations.append("private evaluator bundle cannot be frozen by developer preparation")
    if evaluator.get("hard_gates_in_order") != HARD_GATES:
        violations.append("evaluator hard-gate order mismatch")

    campaign = manifest.get("campaign_gate", {})
    if campaign.get("status") != "PREPARATION_COMPLETE_EXTERNAL_GATES_BLOCKED":
        violations.append("campaign gate must remain external-gates-blocked")
    for key in (
        "campaign_identity",
        "campaign_source_revision",
        "environment_fingerprint",
        "evaluator_identity",
        "private_bundle_manifest_sha256",
    ):
        if campaign.get(key) is not None:
            violations.append(f"blocked campaign cannot freeze {key}")
    if campaign.get("isolation_acceptance") != "NOT_TESTED":
        violations.append("independent Forge isolation must remain NOT_TESTED")
    if campaign.get("candidate_matrix_frozen") is not False:
        violations.append("partial candidate matrix cannot be marked frozen")
    if campaign.get("execution_authorization") != "NOT_GRANTED":
        violations.append("campaign execution cannot be self-authorized")
    if campaign.get("benchmark_execution") is not False:
        violations.append("T09.P1 must not execute the benchmark")
    if manifest.get("benchmark_execution_blockers") != EXPECTED_CAMPAIGN_BLOCKERS:
        violations.append("campaign blocker register mismatch")

    for relative in (
        "evals/forge/candidates/B5/AGENTS.md",
        "evals/forge/fixtures/public-engineering",
    ):
        path = REPO_ROOT / relative
        files = [path] if path.is_file() else sorted(p for p in path.rglob("*") if p.is_file())
        for file_path in files:
            text = file_path.read_text(encoding="utf-8").lower()
            for marker in PRIVATE_MARKERS:
                if marker in text:
                    violations.append(
                        f"public candidate/fixture contains private marker {marker!r}: "
                        f"{file_path.relative_to(REPO_ROOT).as_posix()}"
                    )
    return violations


def validate_candidate_materialization(manifest: dict) -> list[str]:
    violations: list[str] = []
    for candidate_id in ("B0", "B1", "B5"):
        candidate = manifest["candidates"][candidate_id]
        contract = candidate["materialization"]
        with tempfile.TemporaryDirectory(prefix=f"afyx-forge-{candidate_id.lower()}-") as temporary:
            workspace = Path(temporary).resolve()
            if contract["kind"] == "empty_workspace":
                for relative in contract["must_be_absent"]:
                    if (workspace / relative).exists():
                        violations.append(
                            f"candidate {candidate_id} unexpected material: {relative}"
                        )
                continue

            source = repository_path(
                contract["source"], violations, f"candidate {candidate_id} materialization"
            )
            destination = (workspace / contract["destination"]).resolve()
            identity_root = (workspace / contract["identity_root"]).resolve()
            try:
                destination.relative_to(workspace)
                identity_root.relative_to(workspace)
            except ValueError:
                violations.append(f"candidate {candidate_id} materialization escapes workspace")
                continue
            if not source or not source.is_dir():
                violations.append(f"candidate {candidate_id} materialization source is missing")
                continue
            if contract["kind"] == "copy_tree":
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copytree(source, destination)
            elif contract["kind"] == "copy_tree_contents":
                shutil.copytree(source, destination, dirs_exist_ok=True)
            else:
                violations.append(f"candidate {candidate_id} materialization kind is unsupported")
                continue
            if directory_sha256(identity_root) != candidate["content_identity"]:
                violations.append(f"candidate {candidate_id} materialized identity mismatch")
    return violations


def campaign_blockers(manifest: dict) -> list[str]:
    return list(manifest.get("benchmark_execution_blockers", []))


def validate_pristine_fixtures(manifest: dict) -> list[str]:
    violations: list[str] = []
    source = REPO_ROOT / manifest["public_fixture"]["path"]
    source_hash = directory_sha256(source)
    for scenario in manifest["scenarios"]:
        command = scenario.get("validation_command")
        if command is None:
            continue
        with tempfile.TemporaryDirectory(prefix="afyx-forge-fixture-") as temporary:
            work = Path(temporary) / "work"
            shutil.copytree(source, work)
            environment = dict(os.environ)
            environment["PYTHONDONTWRITEBYTECODE"] = "1"
            completed = subprocess.run(
                command,
                cwd=work,
                env=environment,
                text=True,
                capture_output=True,
                timeout=30,
                check=False,
            )
            if completed.returncode != scenario["baseline_expected_exit"]:
                violations.append(
                    f"{scenario['scenario_id']} baseline exit {completed.returncode}; "
                    f"expected {scenario['baseline_expected_exit']}"
                )
    if directory_sha256(source) != source_hash:
        violations.append("canonical public fixture mutated during baseline validation")
    return violations


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check-fixtures",
        action="store_true",
        help="run deterministic pristine baseline validations; never runs a model",
    )
    parser.add_argument("--print-order-digest", action="store_true")
    parser.add_argument(
        "--campaign-ready",
        action="store_true",
        help="fail closed unless every campaign blocker has been resolved",
    )
    args = parser.parse_args()
    manifest = load_json(MANIFEST_PATH)
    if args.print_order_digest:
        print(discovery_order_sha256(manifest))
        return 0
    violations = validate_manifest(copy.deepcopy(manifest))
    if args.check_fixtures:
        violations.extend(validate_pristine_fixtures(manifest))
        violations.extend(validate_candidate_materialization(manifest))
    if violations:
        print(f"Forge readiness validation failed ({len(violations)} violation(s)):")
        for violation in violations:
            print(f"- {violation}")
        return 1
    blockers = campaign_blockers(manifest)
    if args.campaign_ready and blockers:
        print(f"Forge campaign authorization: BLOCKED ({len(blockers)} gate(s)):")
        for blocker in blockers:
            print(f"- {blocker}")
        return 2
    fixture_state = "checked" if args.check_fixtures else "not-run"
    print(
        "Forge readiness validation: PASS "
        f"(prepared candidates 3/6; 36 cells; fixtures/materialization={fixture_state}; "
        "benchmark execution BLOCKED)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
