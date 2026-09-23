# Afyx evaluation foundation

This directory contains the deterministic Phase 3 benchmark foundation. Phase 3A validates isolation, fixture reset, capture, and serialization only; it does not provide product conclusions.

## Frozen environment

`environment.json` records the repository commit, skill versions and Prompt Master SHA, Codex/model/provider settings, tool versions, and optional enhancement availability. The runner uses the recorded `gpt-5.6-sol`, medium reasoning, and direct `openai` provider settings explicitly. It does not read or store authentication secrets.

Before a benchmark series, compare installed component versions with the fingerprint. Do not update a skill or tool during the series. If a mismatch is found, stop and create a new fingerprint rather than mixing results.

Freeze repository skill content before the first run:

```text
python evals/harness/freeze.py
```

The freezer hashes the sorted POSIX-relative file list and full bytes of every file under Efficient Coding and Odoo Engineering. Every runner invocation recomputes both hashes and verifies the installed Prompt Master checkout SHA before constructing a run or calling a model. Any mismatch aborts with exit code 2.

Validate only the frozen inputs without constructing runs or calling a model:

```text
python evals/harness/run.py --mode smoke --preflight-only
```

Validate the manifest, fixture references, configuration references, and Odoo reference dates without network or model calls:

```text
python evals/harness/validate.py
```

## Genuine skill isolation

Codex officially supports per-skill enablement through `skills.config`. Every invocation:

1. uses `--ignore-user-config` and explicit model/provider/reasoning arguments;
2. disables the three personal Afyx skill paths with a session-only `-c skills.config=...` override;
3. copies only the selected frozen skill sources into the fresh fixture's repository-local `.agents/skills` directory;
4. runs an ephemeral, fresh Codex session.

This supports `N`, `E`, `O`, `P`, `EO`, `PO`, and `CORE`. It neither renames/deletes personal skills nor edits production config. Authentication remains in the existing `CODEX_HOME`; the harness never copies or serializes it. Non-Afyx system/plugin skills are outside the ablation definition.

## Scenario and evaluator separation

`manifest.json` stores scenario prompts and evaluator-only fields: assertions, forbidden patterns, validation command, and allowed/expected file scope. The harness sends only `user_prompt` to the agent. The agent works inside a fixture copy and cannot infer assertions from filenames in its working tree.

Each scenario defines:

- `scenario_id`, category, fixture, user prompt, and configurations;
- explicit required and forbidden skill reads for activation assertions;
- binary expected assertions and forbidden patterns;
- optional XML-specific forbidden patterns for typed contamination counts;
- a validation command or `null`;
- allowed and expected file scope;
- coding or generated-prompt output type.

Phase 3A includes only three neutral smoke fixtures: a Python bug, an Odoo version trap, and a prompt-authoring request.

## Fresh fixtures

Every cell copies its canonical fixture to a unique ignored directory under `evals/results/<run-id>/work`. The runner hashes the canonical tree before and after the run and fails `canonical_fixture_unchanged` if it changes. File-diff metrics exclude injected `.agents/skills` content.

## Running

Smoke once per declared cell:

```text
python evals/harness/run.py --mode smoke
```

Benchmark mode enforces at least three repetitions:

```text
python evals/harness/run.py --mode benchmark --repetitions 3
```

Cells are deterministically shuffled with the recorded seed, interleaving configurations and scenarios. Override it explicitly with `--seed`. Each cell starts a fresh session and fresh fixture.

Summarize captured records:

```text
python evals/harness/analyze.py
```

## Metrics

Each `result.json` follows a stable machine-readable shape. Provider-reported tokens are captured when present. Wall time, tool/search/read calls observable in Codex JSON events, modified files, validation commands, failed tools, critical assertions, and version-contamination counters are recorded.

Unavailable fields are `null`; the harness never estimates tokens or file-read counts. Provider `total_tokens` remains untouched and nullable. `derived_input_output_tokens` and `derived_uncached_input_tokens` are separately labeled arithmetic diagnostics, never substitutes for provider totals. Character or word counts are not substitutes for tokens. Correctness assertions gate PASS before efficiency can be considered.

Raw run directories are ignored. `latest-summary.json` is a sanitized, bounded summary intended for reproducibility checks, not a final benchmark conclusion.

## Smoke versus benchmark

Smoke mode uses one repetition to validate mechanics and fixtures. It is not evidence for configuration recommendations. Benchmark mode requires at least three independent repetitions and is reserved for later Phase 3 work with a complete scenario library.

## Current limitations

- Tool/read/search metrics depend on the event detail exposed by the installed Codex CLI.
- File-open and duplicate-read counts remain unavailable when event payloads do not identify paths.
- Phase 3A does not evaluate CodeGraph, Headroom, end-to-end Prompt Master value, or comparative skill effectiveness.
- The current fixtures validate the harness only and must not be used to claim benchmark superiority.
