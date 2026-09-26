#!/usr/bin/env python3
"""Deterministic Phase 3 benchmark runner using isolated Codex skill configs."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import shutil
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from freeze import REPOSITORY_SKILLS, directory_content_sha256, prompt_master_git_sha


EVAL_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = EVAL_ROOT.parent
MANIFEST_PATH = EVAL_ROOT / "manifest.json"
RESULTS_ROOT = EVAL_ROOT / "results"
AFYX_SKILLS = ("efficient-coding", "odoo-engineering", "prompt-master")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def verify_frozen_environment(environment: dict) -> None:
    """Abort before any model call when frozen benchmark inputs drift."""
    failures = []
    subject = environment.get("repository", {}).get("benchmark_subject_commit")
    if not subject:
        failures.append("repository.benchmark_subject_commit is missing")
    for name in REPOSITORY_SKILLS:
        expected = environment["skills"].get(name, {}).get("content_sha256")
        if not expected:
            failures.append(f"{name}: frozen content_sha256 is missing")
            continue
        actual = directory_content_sha256(REPO_ROOT / "skills" / name)
        if actual != expected:
            failures.append(
                f"{name}: content SHA256 mismatch (expected {expected}, actual {actual})"
            )

    prompt_entry = environment["skills"].get("prompt-master", {})
    expected_prompt_sha = prompt_entry.get("git_sha")
    prompt_checkout = Path.home() / ".agents" / "skills" / "prompt-master"
    if not expected_prompt_sha:
        failures.append("prompt-master: frozen git_sha is missing")
    else:
        try:
            actual_prompt_sha = prompt_master_git_sha(prompt_checkout)
        except (FileNotFoundError, RuntimeError) as error:
            failures.append(f"prompt-master: {error}")
        else:
            if actual_prompt_sha != expected_prompt_sha:
                failures.append(
                    "prompt-master: Git SHA mismatch "
                    f"(expected {expected_prompt_sha}, actual {actual_prompt_sha})"
                )

    if failures:
        details = "\n  - ".join(failures)
        raise RuntimeError(f"frozen environment preflight failed:\n  - {details}")


def ignored_path(rel: Path) -> bool:
    return any(part in {".agents", "__pycache__"} for part in rel.parts) or rel.suffix == ".pyc"


def tree_digest(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        rel = path.relative_to(root)
        if ignored_path(rel):
            continue
        digest.update(rel.as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def snapshot(root: Path) -> dict[str, str]:
    result = {}
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        rel = path.relative_to(root)
        if ignored_path(rel):
            continue
        result[rel.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def skill_sources() -> dict[str, Path]:
    user_root = Path.home() / ".agents" / "skills"
    return {
        "efficient-coding": REPO_ROOT / "skills" / "efficient-coding",
        "odoo-engineering": REPO_ROOT / "skills" / "odoo-engineering",
        "prompt-master": user_root / "prompt-master",
    }


def installed_skill_paths() -> list[Path]:
    root = Path.home() / ".agents" / "skills"
    return [root / name / "SKILL.md" for name in AFYX_SKILLS]


def prepare_skills(work: Path, active: list[str]) -> None:
    sources = skill_sources()
    target_root = work / ".agents" / "skills"
    target_root.mkdir(parents=True, exist_ok=True)
    for name in active:
        source = sources[name]
        if not (source / "SKILL.md").is_file():
            raise RuntimeError(f"skill source unavailable: {source}")
        shutil.copytree(source, target_root / name)


def skills_override() -> str:
    entries = ",".join(
        f'{{path="{path.as_posix()}",enabled=false}}'
        for path in installed_skill_paths()
    )
    return f"skills.config=[{entries}]"


def codex_command(work: Path, prompt: str) -> list[str]:
    return [
        "codex", "exec", "--ephemeral", "--ignore-user-config",
        "--skip-git-repo-check", "--approve-for-me", "--json", "-C", str(work),
        "-m", "gpt-5.6-sol",
        "-c", 'model_provider="openai"',
        "-c", 'model_reasoning_effort="medium"',
        "-c", skills_override(), prompt,
    ]


def parse_events(stdout: str) -> dict:
    usage = {}
    agent_messages = []
    tool_calls = 0
    failed_tools = 0
    search_calls = 0
    read_calls = 0
    commands = []
    for line in stdout.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") == "turn.completed":
            usage = event.get("usage", {})
        item = event.get("item") or {}
        if item.get("type") == "agent_message" and item.get("text"):
            agent_messages.append(item["text"])
        item_type = item.get("type", "")
        if event.get("type") == "item.completed" and item_type in {
            "command_execution", "mcp_tool_call", "tool_call", "file_change"
        }:
            tool_calls += 1
            command = item.get("command", "")
            trace = command or json.dumps(item, sort_keys=True)
            commands.append(trace)
            if command and re.search(r"\b(rg|grep|find|search)\b", command, re.I):
                search_calls += 1
            if command and re.search(r"\b(Get-Content|cat|type|read)\b", command, re.I):
                read_calls += 1
            if item.get("status") in {"failed", "error"}:
                failed_tools += 1
    return {
        "usage": usage,
        "message": agent_messages[-1] if agent_messages else "",
        "tool_calls": tool_calls,
        "failed_tools": failed_tools,
        "search_calls": search_calls,
        "read_calls": read_calls,
        "commands": commands,
    }


def check_assertions(
    scenario: dict, work: Path, output: str, validation_exit: int | None,
    modified: list[str],
) -> list[dict]:
    checks = []
    for assertion in scenario["expected_assertions"]:
        kind, value = assertion["type"], assertion["value"]
        if kind == "validation_exit":
            passed = validation_exit == value
        elif kind == "output_contains":
            passed = value.lower() in output.lower()
        else:
            passed = False
        checks.append({"type": kind, "expected": value, "passed": passed})
    file_corpus = "\n".join(
        (work / rel).read_text(encoding="utf-8", errors="replace")
        for rel in modified if (work / rel).is_file()
    )
    corpus = output if scenario["output_kind"] == "generated_prompt" else file_corpus
    for pattern in scenario["forbidden_patterns"]:
        checks.append({
            "type": "forbidden_pattern", "expected": pattern,
            "passed": pattern not in corpus,
        })
    for pattern in scenario.get("xml_forbidden_patterns", []):
        checks.append({
            "type": "xml_forbidden_pattern", "expected": pattern,
            "passed": pattern not in corpus,
        })
    return checks


def run_cell(manifest: dict, scenario: dict, config: str, repetition: int, timeout: int) -> dict:
    run_id = f"{scenario['scenario_id']}-{config}-r{repetition}-{uuid.uuid4().hex[:8]}"
    run_root = RESULTS_ROOT / run_id
    work = run_root / "work"
    fixture = EVAL_ROOT / scenario["fixture"]
    canonical_before = tree_digest(fixture)
    shutil.copytree(fixture, work)
    prepare_skills(work, manifest["configurations"][config])
    initial = snapshot(work)
    started = time.perf_counter()
    process = subprocess.run(
        codex_command(work, scenario["user_prompt"]),
        cwd=work, text=True, encoding="utf-8", errors="replace",
        capture_output=True, timeout=timeout,
    )
    elapsed = time.perf_counter() - started
    (run_root / "events.jsonl").write_text(process.stdout, encoding="utf-8")
    (run_root / "stderr.log").write_text(process.stderr, encoding="utf-8")
    parsed = parse_events(process.stdout)
    final = snapshot(work)
    modified = sorted({*initial, *final} - {k for k in initial if initial.get(k) == final.get(k)})
    validation_exit = None
    validation_output = None
    validation_commands = []
    if scenario["validation_command"]:
        validation_commands.append(scenario["validation_command"])
        validation = subprocess.run(
            scenario["validation_command"], cwd=work, text=True,
            encoding="utf-8", errors="replace",
            capture_output=True, timeout=timeout,
        )
        validation_exit = validation.returncode
        validation_output = validation.stdout + validation.stderr
    output = parsed["message"]
    if scenario["output_kind"] == "generated_prompt":
        (run_root / "generated_prompt.txt").write_text(output, encoding="utf-8")
    assertions = check_assertions(scenario, work, output, validation_exit, modified)
    command_text = "\n".join(parsed["commands"])
    observed_skill_reads = sorted(
        name for name in AFYX_SKILLS
        if re.search(rf"{re.escape(name)}[\\/]+SKILL\.md", command_text, re.I)
    )
    active_skills = manifest["configurations"][config]
    required_skill_reads = scenario["required_skill_reads"]
    forbidden_skill_reads = scenario["forbidden_skill_reads"]
    observed_set = set(observed_skill_reads)
    assertions.extend([
        {
            "type": "required_skill_reads",
            "expected": required_skill_reads,
            "observed": observed_skill_reads,
            "passed": set(required_skill_reads) <= observed_set,
        },
        {
            "type": "forbidden_skill_reads",
            "expected": forbidden_skill_reads,
            "observed": observed_skill_reads,
            "passed": not (observed_set & set(forbidden_skill_reads)),
        },
        {
            "type": "available_skill_reads",
            "expected": active_skills,
            "observed": observed_skill_reads,
            "passed": observed_set <= set(active_skills),
        },
    ])
    allowed = set(scenario["allowed_file_scope"])
    scope_ok = all(path in allowed for path in modified)
    expected_scope_ok = all(path in modified for path in scenario["expected_file_scope"])
    assertions.extend([
        {"type": "allowed_file_scope", "passed": scope_ok},
        {"type": "expected_file_scope", "passed": expected_scope_ok},
        {"type": "canonical_fixture_unchanged", "passed": canonical_before == tree_digest(fixture)},
    ])
    passed = process.returncode == 0 and all(item["passed"] for item in assertions)
    usage = parsed["usage"]
    input_tokens = usage.get("input_tokens")
    cached_input_tokens = usage.get("cached_input_tokens")
    output_tokens = usage.get("output_tokens")
    derived_input_output_tokens = (
        input_tokens + output_tokens
        if input_tokens is not None and output_tokens is not None else None
    )
    derived_uncached_input_tokens = (
        input_tokens - cached_input_tokens
        if input_tokens is not None and cached_input_tokens is not None else None
    )
    xml_forbidden_patterns = scenario.get("xml_forbidden_patterns")
    record = {
        "schema_version": 1,
        "run_id": run_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "scenario_id": scenario["scenario_id"],
        "configuration": config,
        "isolated_skills": active_skills,
        "observed_skill_reads": observed_skill_reads,
        "isolation_method": "session skills.config disable + repository-local selected copies",
        "component_versions": load_json(EVAL_ROOT / manifest["environment"])["skills"],
        "model_provider_fingerprint": load_json(EVAL_ROOT / manifest["environment"])["runtime"],
        "result": "PASS" if passed else "FAIL",
        "process_returncode": process.returncode,
        "assertions": assertions,
        "first_pass_success": passed,
        "correction_turns": 0,
        "input_tokens": input_tokens,
        "cached_input_tokens": cached_input_tokens,
        "output_tokens": output_tokens,
        "reasoning_tokens": usage.get("reasoning_output_tokens"),
        "total_tokens": usage.get("total_tokens"),
        "derived_input_output_tokens": derived_input_output_tokens,
        "derived_uncached_input_tokens": derived_uncached_input_tokens,
        "wall_time": elapsed,
        "tool_calls": parsed["tool_calls"],
        "search_calls": parsed["search_calls"],
        "read_calls": parsed["read_calls"],
        "files_opened": None,
        "unique_files_opened": None,
        "duplicate_reads": None,
        "files_modified": modified,
        "validation_commands": validation_commands,
        "failed_tools": parsed["failed_tools"],
        "wrong_version_api_count": sum(
            1 for item in assertions
            if item["type"] == "forbidden_pattern" and not item["passed"]
        ),
        "wrong_version_xml_count": (
            sum(
                1 for item in assertions
                if item["type"] == "xml_forbidden_pattern" and not item["passed"]
            )
            if xml_forbidden_patterns else None
        ),
        "unsupported_assumption_count": None,
        "canonical_fixture_unchanged": canonical_before == tree_digest(fixture),
        "validation_exit": validation_exit,
        "validation_output": validation_output,
        "generated_prompt_path": "generated_prompt.txt" if scenario["output_kind"] == "generated_prompt" else None,
        "error_summary": None if process.returncode == 0 else process.stderr[-2000:],
    }
    (run_root / "result.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    return record


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("smoke", "benchmark"), default="smoke")
    parser.add_argument("--repetitions", type=int)
    parser.add_argument("--seed", type=int)
    parser.add_argument("--timeout", type=int, default=300)
    parser.add_argument("--scenario", action="append")
    parser.add_argument(
        "--preflight-only", action="store_true",
        help="verify frozen inputs and exit without constructing runs or calling a model",
    )
    args = parser.parse_args()
    manifest = load_json(MANIFEST_PATH)
    environment = load_json(EVAL_ROOT / manifest["environment"])
    try:
        verify_frozen_environment(environment)
    except (KeyError, FileNotFoundError, RuntimeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    if args.preflight_only:
        print("Frozen environment preflight passed.")
        return 0
    repetitions = args.repetitions or (1 if args.mode == "smoke" else 3)
    if args.mode == "benchmark" and repetitions < 3:
        parser.error("benchmark mode requires at least 3 repetitions")
    seed = args.seed if args.seed is not None else manifest["random_seed"]
    scenarios = [
        s for s in manifest["scenarios"]
        if not args.scenario or s["scenario_id"] in args.scenario
    ]
    cells = [
        (scenario, config, repetition)
        for repetition in range(1, repetitions + 1)
        for scenario in scenarios
        for config in scenario["configurations"]
    ]
    random.Random(seed).shuffle(cells)
    RESULTS_ROOT.mkdir(parents=True, exist_ok=True)
    records = [run_cell(manifest, *cell, args.timeout) for cell in cells]
    summary = {
        "schema_version": 1,
        "mode": args.mode,
        "random_seed": seed,
        "repetitions": repetitions,
        "run_order": [record["run_id"] for record in records],
        "pass_count": sum(r["result"] == "PASS" for r in records),
        "total_count": len(records),
        "results": records,
    }
    (RESULTS_ROOT / "latest-summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    print(json.dumps({k: summary[k] for k in ("mode", "random_seed", "pass_count", "total_count")}, indent=2))
    return 0 if summary["pass_count"] == summary["total_count"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
