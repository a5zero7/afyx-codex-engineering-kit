# Codex token usage tracker

The Codex usage tracker is a local, global PowerShell utility for reporting the most recently completed Codex turn. It reads token metadata from Codex rollout telemetry and never sends session data to a model or remote service.

## Architecture

The implementation has four parts:

- `CodexUsage.psm1` parses telemetry events and owns token/cost accounting;
- `codex-usage-watch.ps1` discovers rollout files, initializes a completed-turn baseline once, then tails only appended bytes;
- `codex-usage-pricing.json` keeps verified API pricing separate from parser logic;
- a VS Code User Task runs the watcher in one dedicated background terminal.

The watcher also writes the latest metadata-only result to `%USERPROFILE%\.codex\tools\codex-usage-latest.json`. This is the integration boundary for a possible future status-bar extension, avoiding a second telemetry parser.

## Session source and events

The default session root is `%CODEX_HOME%\sessions` when `CODEX_HOME` is set, otherwise `%USERPROFILE%\.codex\sessions`. Rollout files are named `rollout-*.jsonl`.

The implementation was validated against Codex VS Code telemetry from Codex CLI schema 0.155.x. It uses only these metadata events and fields:

- `turn_context`: `turn_id` and `model`;
- `token_usage_record`: per-call `usage`, cumulative `turn_token_usage`, and cumulative `thread_token_usage`;
- `event_msg/token_count`: fallback cumulative `info.total_token_usage`;
- `event_msg/task_started` and `event_msg/task_complete`: turn boundaries.

Prompts, responses, reasoning content, tool payloads, authentication data, working directories, and repository content are neither printed nor copied into the latest-result file.

## Per-turn calculation

For each successful `task_complete`, the primary calculation is:

```text
current cumulative thread usage
- previous completed-turn cumulative baseline
= completed turn usage
```

The baseline advances only at `task_complete`. Current telemetry also provides exact `turn_token_usage`; the parser verifies it against the cumulative delta and uses it when an aborted/interrupted turn creates a gap between completed baselines. Negative values are never reported.

On watcher or VS Code restart, the active rollout file is scanned once without replaying historical summaries. That scan reconstructs the latest completed baseline and any currently active turn. After initialization, the watcher reads only appended bytes with file sharing enabled for concurrent Codex writes. A new or resumed conversation is detected from rollout file activity; truncated/recreated files are safely reinitialized.

## Cached input and reasoning

`cached_input_tokens` and `cache_write_input_tokens` are subsets of input. The displayed and billed uncached input is:

```text
max(0, input_tokens - cached_input_tokens - cache_write_input_tokens)
```

Reasoning tokens are shown as an output breakdown when the field exists. Actual telemetry confirms that `total_tokens = input_tokens + output_tokens`; reasoning is already included in output and is never added again.

## API-equivalent cost

Cost uses per-model, per-million-token rates from `codex-usage-pricing.json`. Each `token_usage_record.usage` is priced independently so short/long-context tiers are selected per model call rather than from an aggregate turn total.

The bundled `gpt-5.6-sol` standard-tier rates were verified on 2026-09-24 from the [official OpenAI pricing page](https://developers.openai.com/api/docs/pricing). Unknown models or missing rate categories produce `API-equivalent: N/A` without interrupting token reporting.

**API-equivalent cost is not an actual ChatGPT subscription charge.** It is a comparison against published API pricing and does not assert that the Codex session was billed through the API.

## Installation

From this repository in PowerShell 7:

```powershell
pwsh -NoProfile -File .\scripts\install-codex-usage-tracker.ps1
```

This installs the runtime files under `%USERPROFILE%\.codex\tools` (or `%CODEX_HOME%\tools`) and creates or updates the global VS Code User Task at `%APPDATA%\Code\User\tasks.json`. If an existing tasks file is valid JSON, it is backed up before merging. JSON-with-comments is not rewritten automatically; merge `tools/codex-usage/vscode-user-task.json` manually in that case.

The installer supports `-WhatIf`, `-CodexHome`, `-VSCodeUserTasksPath`, and `-SkipVSCodeTask`.

## Usage in VS Code

Run:

```text
Ctrl+Shift+P
→ Tasks: Run Task
→ Codex: Watch Token Usage
```

The task uses `pwsh`, stays active in a dedicated terminal, and reports one summary after each completed turn. It is a user-level task, so no `.vscode/tasks.json` is added to application repositories.

Direct invocation is also supported:

```powershell
pwsh -NoProfile -File "$env:USERPROFILE\.codex\tools\codex-usage-watch.ps1"
```

For a metadata-only inspection of existing telemetry without starting a persistent watcher:

```powershell
pwsh -NoProfile -File "$env:USERPROFILE\.codex\tools\codex-usage-watch.ps1" `
  -ReplayLatestCompletedTurns 1
```

## Validation

Run the dependency-free tests with:

```powershell
pwsh -NoProfile -File .\tools\codex-usage\tests\run-tests.ps1
```

The tests cover consecutive turns, cumulative deltas, cache-write accounting, reasoning non-duplication, unknown models, aborted-turn gaps, live file tailing, session rollover, and watcher restart behavior.

## Limitations and troubleshooting

- The parser targets the observed Codex 0.155.x JSONL schema and tolerates missing optional usage fields. A future incompatible telemetry schema may require an update.
- Pricing is deliberately explicit and can become stale. Update the separate JSON only after checking official OpenAI pricing.
- A status-bar extension is not bundled in this phase. The dedicated terminal is the verified UX; `codex-usage-latest.json` provides a stable, content-free input for a later extension.
- If no rollout file exists, start one Codex conversation and rerun the task.
- If the user task is missing, verify `%APPDATA%\Code\User\tasks.json`, rerun the installer, and restart VS Code's task picker.
- If pricing shows `N/A`, compare the telemetry model name with the explicit keys in `codex-usage-pricing.json`; do not alias it to another model without verified pricing.
