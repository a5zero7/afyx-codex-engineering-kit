#!/usr/bin/env python3
"""Validate the lightweight Phase 7 engineering-assurance contract and records."""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "scripts" / "engineering-assurance.json"
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
DIGEST_RE = re.compile(r"^[0-9a-f]{64}$")


class AssuranceError(ValueError):
    pass


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AssuranceError(f"cannot read valid JSON from {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise AssuranceError(f"{path} must contain one JSON object")
    return value


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssuranceError(message)


def validate_contract(contract: dict[str, Any]) -> None:
    require(contract.get("schema_version") == 1, "contract schema_version must be 1")
    require(contract.get("contract_id") == "afyx-engineering-assurance-v1", "unexpected contract_id")
    require(
        contract.get("lifecycle") == ["PLANNED", "ANALYZED", "IMPLEMENTED", "VALIDATED", "DOCUMENTED", "MERGE_READY"],
        "canonical lifecycle differs from the frozen Phase 7 order",
    )
    require(set(contract.get("statuses", [])) == {"PASS", "FAIL", "NOT_RUN", "BLOCKED"}, "invalid status vocabulary")
    levels = contract.get("validation_levels")
    require(isinstance(levels, dict) and set(levels) == {"1", "2", "3"}, "validation levels must be exactly 1, 2 and 3")
    previous: set[str] = set()
    for level in ("1", "2", "3"):
        kinds = levels[level].get("required_test_kinds", [])
        require(isinstance(kinds, list) and all(isinstance(item, str) and item for item in kinds), f"level {level} test kinds invalid")
        current = set(kinds)
        require(previous <= current, f"level {level} must include lower-level validation")
        previous = current
    require(contract.get("priority") == ["correctness", "security", "performance", "efficiency"], "assurance priority is invalid")


def path_allowed(path: str, patterns: list[str]) -> bool:
    normalized = path.replace("\\", "/").lstrip("./")
    return any(fnmatch.fnmatchcase(normalized, pattern) for pattern in patterns)


def validate_measurement(test: dict[str, Any], label: str) -> None:
    measurement = test.get("measurement")
    require(isinstance(measurement, dict), f"{label}: performance evidence requires measurement")
    value = measurement.get("value")
    threshold = measurement.get("threshold")
    comparator = measurement.get("comparator")
    require(isinstance(value, (int, float)) and isinstance(threshold, (int, float)), f"{label}: measurement values must be numeric")
    require(isinstance(measurement.get("unit"), str) and measurement["unit"], f"{label}: measurement unit is required")
    require(comparator in {"lte", "gte"}, f"{label}: comparator must be lte or gte")
    passed = value <= threshold if comparator == "lte" else value >= threshold
    require(passed, f"{label}: measured performance does not meet its threshold")


def validate_record(record: dict[str, Any], contract: dict[str, Any], expected_head: str | None) -> None:
    errors: list[str] = []

    def check(callback: Any) -> None:
        try:
            callback()
        except AssuranceError as exc:
            errors.append(str(exc))

    lifecycle = contract["lifecycle"]
    statuses = set(contract["statuses"])
    state = record.get("lifecycle_state")
    require(record.get("schema_version") == 1, "record schema_version must be 1")
    require(isinstance(record.get("task_id"), str) and record["task_id"].strip(), "task_id is required")
    require(state in lifecycle, "unknown lifecycle_state")

    baseline = record.get("baseline", {})
    source = record.get("source", {})
    require(isinstance(baseline, dict) and baseline.get("verified") is True, "baseline must be independently verified")
    require(baseline.get("worktree_clean") is True, "baseline worktree must be clean")
    require(isinstance(baseline.get("sha"), str) and SHA_RE.fullmatch(baseline["sha"]), "baseline SHA must be exact")
    require(isinstance(source, dict) and isinstance(source.get("sha"), str) and SHA_RE.fullmatch(source["sha"]), "source SHA must be exact")
    if expected_head:
        require(source["sha"] == expected_head, "record source SHA does not match --expected-head")
    require(isinstance(source.get("acceptance_revision"), str) and source["acceptance_revision"], "acceptance_revision is required")
    require(isinstance(source.get("relevant_source_digest"), str) and DIGEST_RE.fullmatch(source["relevant_source_digest"]), "relevant_source_digest must be SHA-256")
    require(isinstance(source.get("scope_fingerprint"), str) and DIGEST_RE.fullmatch(source["scope_fingerprint"]), "scope_fingerprint must be SHA-256")

    scope = record.get("scope", {})
    allowed = scope.get("allowed", []) if isinstance(scope, dict) else []
    changed = scope.get("changed", []) if isinstance(scope, dict) else []
    require(bool(allowed) and all(isinstance(item, str) and item for item in allowed), "scope.allowed must be non-empty")
    require(isinstance(changed, list) and all(isinstance(item, str) and item for item in changed), "scope.changed must be a string list")
    for path in changed:
        check(lambda path=path: require(path_allowed(path, allowed), f"scope violation: {path}"))

    risk = record.get("risk", {})
    level = risk.get("level") if isinstance(risk, dict) else None
    require(level in {1, 2, 3}, "risk level must be 1, 2 or 3")
    require(isinstance(risk.get("rationale"), str) and risk["rationale"].strip(), "risk rationale is required")
    for flag in ("mutation_required", "differential_required", "performance_required"):
        require(isinstance(risk.get(flag), bool), f"risk.{flag} must be boolean")

    budget = record.get("validation_budget", {})
    require(isinstance(budget, dict), "validation_budget is required")
    planned = budget.get("planned_seconds")
    actual = budget.get("actual_seconds")
    require(isinstance(planned, (int, float)) and planned > 0, "planned validation budget must be positive")
    require(isinstance(actual, (int, float)) and actual >= 0, "actual validation duration must be non-negative")
    if actual > planned:
        require(isinstance(budget.get("overrun_justification"), str) and budget["overrun_justification"].strip(), "validation budget overrun requires justification")

    tests = record.get("tests", [])
    require(isinstance(tests, list), "tests must be a list")
    test_ids: set[str] = set()
    passed_kinds: set[str] = set()
    blocking = False
    for index, test in enumerate(tests):
        label = f"tests[{index}]"
        if not isinstance(test, dict):
            errors.append(f"{label}: must be an object")
            continue
        test_id = test.get("id")
        status = test.get("status")
        kind = test.get("kind")
        requirement = test.get("requirement")
        check(lambda: require(isinstance(test_id, str) and bool(test_id), f"{label}: id is required"))
        if isinstance(test_id, str):
            check(lambda: require(test_id not in test_ids, f"duplicate test id: {test_id}"))
            test_ids.add(test_id)
        check(lambda: require(status in statuses, f"{label}: unknown status {status!r}"))
        check(lambda: require(isinstance(kind, str) and bool(kind), f"{label}: kind is required"))
        check(lambda: require(requirement in {"v1", "optional", "unrelated"}, f"{label}: invalid requirement classification"))
        if status == "PASS" and isinstance(kind, str):
            passed_kinds.add(kind)
        elif status == "NOT_RUN":
            check(lambda: require(test.get("disposition") in contract["skip_dispositions"], f"{label}: NOT_RUN needs a supported disposition"))
            check(lambda: require(isinstance(test.get("reason"), str) and test["reason"].strip(), f"{label}: NOT_RUN needs a reason"))
        elif status in {"FAIL", "BLOCKED"}:
            for field in ("reason", "owner", "resolution", "acceptance_evidence"):
                check(lambda field=field: require(isinstance(test.get(field), str) and test[field].strip(), f"{label}: {status} needs {field}"))
        if status != "PASS" and requirement == "v1":
            blocking = True
        if status in {"FAIL", "BLOCKED"} and test.get("blocks_readiness") is not False:
            blocking = True
        if kind == "performance" and status == "PASS":
            check(lambda test=test, label=label: validate_measurement(test, label))

    required_kinds = set(contract["validation_levels"][str(level)]["required_test_kinds"])
    missing_kinds = sorted(required_kinds - passed_kinds)
    if missing_kinds:
        errors.append(f"validation level {level} lacks PASS evidence for: {', '.join(missing_kinds)}")
    for flag, kind in (("mutation_required", "mutation"), ("differential_required", "differential"), ("performance_required", "performance")):
        if risk[flag] and kind not in passed_kinds:
            errors.append(f"risk requires PASS {kind} proof")

    reused = record.get("reused_evidence", [])
    require(isinstance(reused, list), "reused_evidence must be a list")
    evidence_ids = set(test_ids)
    for index, item in enumerate(reused):
        label = f"reused_evidence[{index}]"
        require(isinstance(item, dict), f"{label}: must be an object")
        evidence_id = item.get("id")
        require(isinstance(evidence_id, str) and evidence_id and evidence_id not in evidence_ids, f"{label}: unique id required")
        evidence_ids.add(evidence_id)
        require(item.get("status") == "PASS", f"{label}: only PASS evidence may be reused")
        require(item.get("relevant_source_digest") == source["relevant_source_digest"], f"{label}: stale or mismatched source evidence")
        require(item.get("acceptance_revision") == source["acceptance_revision"], f"{label}: acceptance contract mismatch")
        require(item.get("scope_fingerprint") == source["scope_fingerprint"], f"{label}: scope mismatch")
        require(item.get("new_relevant_failure") is False, f"{label}: new relevant failure invalidates reuse")

    ground_truth = record.get("ground_truth", [])
    require(isinstance(ground_truth, list) and ground_truth, "ground_truth must contain evidence-backed claims")
    for index, claim in enumerate(ground_truth):
        require(isinstance(claim, dict), f"ground_truth[{index}] must be an object")
        require(isinstance(claim.get("claim"), str) and claim["claim"].strip(), f"ground_truth[{index}].claim is required")
        require(claim.get("evidence_id") in evidence_ids, f"ground_truth[{index}] references unknown evidence")

    merge_ready = state == "MERGE_READY" or record.get("merge_readiness") == "READY"
    if merge_ready:
        check(lambda: require(state == "MERGE_READY" and record.get("merge_readiness") == "READY", "MERGE_READY lifecycle and decision must agree"))
        check(lambda: require(not blocking, "blocking failed, blocked or unexecuted v1 validation remains"))
        for gate in ("ci", "documentation"):
            value = record.get(gate, {})
            check(lambda value=value, gate=gate: require(isinstance(value, dict) and value.get("status") == "PASS", f"{gate} gate must PASS"))
            check(lambda value=value, gate=gate: require(isinstance(value, dict) and isinstance(value.get("evidence"), str) and value["evidence"].strip(), f"{gate} evidence is required"))

    if errors:
        raise AssuranceError("; ".join(errors))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract", type=Path, default=CONTRACT_PATH)
    parser.add_argument("--record", type=Path)
    parser.add_argument("--expected-head")
    args = parser.parse_args()
    try:
        contract = load_json(args.contract)
        validate_contract(contract)
        if args.expected_head:
            require(bool(SHA_RE.fullmatch(args.expected_head)), "--expected-head must be a 40-character lowercase SHA")
        if args.record:
            validate_record(load_json(args.record), contract, args.expected_head)
    except AssuranceError as exc:
        print(f"Engineering assurance: FAIL — {exc}", file=sys.stderr)
        return 1
    suffix = f"; record={args.record}" if args.record else ""
    print(f"Engineering assurance: PASS ({contract['contract_id']}{suffix})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
