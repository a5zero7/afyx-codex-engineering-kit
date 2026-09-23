#!/usr/bin/env python3
"""Pure static validation for the Afyx evaluation manifest and references."""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path


EVAL_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = EVAL_ROOT.parent
MANIFEST_PATH = EVAL_ROOT / "manifest.json"
FIXTURES_ROOT = (EVAL_ROOT / "fixtures").resolve()
ODOO_REFERENCES = REPO_ROOT / "skills" / "odoo-engineering" / "references"

REQUIRED_TOP_LEVEL_KEYS = {
    "schema_version",
    "random_seed",
    "environment",
    "configurations",
    "scenarios",
}
REQUIRED_SCENARIO_KEYS = {
    "scenario_id",
    "category",
    "fixture",
    "user_prompt",
    "configurations",
    "required_skill_reads",
    "forbidden_skill_reads",
    "expected_assertions",
    "forbidden_patterns",
    "validation_command",
    "allowed_file_scope",
    "expected_file_scope",
    "output_kind",
}
LAST_VERIFIED_PATTERN = re.compile(
    r"^Last verified: (?P<value>\d{4}-\d{2}-\d{2})\s*$", re.MULTILINE
)


def validate_manifest(violations: list[str]) -> None:
    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        violations.append(f"manifest.json is not readable JSON: {error}")
        return
    if not isinstance(manifest, dict):
        violations.append("manifest.json top level must be an object")
        return

    missing_top = sorted(REQUIRED_TOP_LEVEL_KEYS - manifest.keys())
    for key in missing_top:
        violations.append(f"manifest.json missing top-level key: {key}")

    configurations = manifest.get("configurations")
    if not isinstance(configurations, dict):
        violations.append("manifest.json configurations must be an object")
        configuration_names: set[str] = set()
    else:
        configuration_names = set(configurations)

    scenarios = manifest.get("scenarios")
    if not isinstance(scenarios, list):
        violations.append("manifest.json scenarios must be an array")
        return

    scenario_ids = []
    for index, scenario in enumerate(scenarios):
        prefix = f"scenario[{index}]"
        if not isinstance(scenario, dict):
            violations.append(f"{prefix} must be an object")
            continue

        scenario_id = scenario.get("scenario_id")
        if isinstance(scenario_id, str) and scenario_id:
            scenario_ids.append(scenario_id)
            prefix = f"scenario {scenario_id!r}"
        else:
            violations.append(f"{prefix} scenario_id must be a non-empty string")

        for key in sorted(REQUIRED_SCENARIO_KEYS - scenario.keys()):
            violations.append(f"{prefix} missing required key: {key}")

        for key in ("required_skill_reads", "forbidden_skill_reads"):
            if key in scenario and not isinstance(scenario[key], list):
                violations.append(f"{prefix} {key} must be an array")

        fixture_value = scenario.get("fixture")
        if not isinstance(fixture_value, str) or not fixture_value:
            violations.append(f"{prefix} fixture must be a non-empty string")
        else:
            fixture_path = (EVAL_ROOT / fixture_value).resolve()
            try:
                fixture_path.relative_to(FIXTURES_ROOT)
            except ValueError:
                violations.append(
                    f"{prefix} fixture must resolve under evals/fixtures: {fixture_value}"
                )
            else:
                if not fixture_path.exists():
                    violations.append(f"{prefix} fixture does not exist: {fixture_value}")

        referenced_configs = scenario.get("configurations")
        if not isinstance(referenced_configs, list):
            violations.append(f"{prefix} configurations must be an array")
        else:
            for name in referenced_configs:
                if name not in configuration_names:
                    violations.append(
                        f"{prefix} references unknown configuration: {name!r}"
                    )

    duplicates = sorted(
        scenario_id for scenario_id, count in Counter(scenario_ids).items()
        if count > 1
    )
    for scenario_id in duplicates:
        violations.append(f"duplicate scenario_id: {scenario_id!r}")


def validate_odoo_headers(violations: list[str]) -> None:
    references = sorted(ODOO_REFERENCES.glob("odoo-*.md"))
    if not references:
        violations.append(f"no Odoo version references found under {ODOO_REFERENCES}")
        return
    for path in references:
        try:
            content = path.read_text(encoding="utf-8")
        except OSError as error:
            violations.append(f"{path.name} is not readable: {error}")
            continue
        match = LAST_VERIFIED_PATTERN.search(content)
        if not match:
            violations.append(
                f"{path.name} missing parseable 'Last verified: YYYY-MM-DD' header"
            )
            continue
        value = match.group("value")
        try:
            parsed = date.fromisoformat(value)
        except ValueError:
            violations.append(f"{path.name} has invalid Last verified date: {value}")
            continue
        if parsed.isoformat() != value:
            violations.append(f"{path.name} has non-canonical Last verified date: {value}")


def main() -> int:
    violations: list[str] = []
    validate_manifest(violations)
    validate_odoo_headers(violations)
    if violations:
        print(f"Static evaluation validation failed ({len(violations)} violation(s)):")
        for violation in violations:
            print(f"- {violation}")
        return 1
    print("Static evaluation validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
