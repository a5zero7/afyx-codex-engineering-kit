# Codex token usage tracker

The Codex usage tracker is a local, global PowerShell utility for reporting the most recently completed Codex turn. It reads token metadata from Codex rollout telemetry and never sends session data to a model or remote service.

## Architecture

The implementation has five parts:

- `CodexUsage.psm1` parses telemetry events and owns token/cost accounting;
- `codex-usage-stop.ps1` correlates a Codex `Stop` event to its exact transcript/session/turn and returns a compact `systemMessage`;
- `codex-usage-watch.ps1` discovers rollout files, initializes a completed-turn baseline once, then tails only appended bytes;
- `codex-usage-pricing.json` keeps verified API pricing separate from parser logic;
- a global `~/.codex/hooks.json` entry provides the normal automatic UI path, while a VS Code User Task runs the watcher as a fallback/debugging tool.

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

Interactive installation through the main kit installer asks whether to install the optional tracker:

```powershell
.\install.ps1
# Install Codex Usage Tracking? [Y/N]: Y
```

For unattended installation or an explicit choice:

```powershell
.\install.ps1 -InstallUsageTracker
.\install.ps1 -SkipUsageTracker
```

Without either switch, a non-interactive run skips the optional tracker instead of waiting for input. Selecting `N` or `-SkipUsageTracker` never removes an existing installation. Explicit removal is available through `.\uninstall.ps1 -RemoveUsageTracker`.

The dedicated component installer remains available in PowerShell 7:

```powershell
pwsh -NoProfile -File .\scripts\install-codex-usage-tracker.ps1
```

This installs the runtime files under `%USERPROFILE%\.codex\tools` (or `%CODEX_HOME%\tools`), merges an Afyx-owned `Stop` handler into `%USERPROFILE%\.codex\hooks.json`, and creates or updates the global VS Code User Task at `%APPDATA%\Code\User\tasks.json`. Existing hook events, other `Stop` handlers, and unrelated tasks are preserved. Existing JSON files are backed up before a change, and repeated installation keeps exactly one Afyx handler. Invalid/non-strict JSON is not overwritten.

Codex requires review of changed non-managed hooks. After installation, open Codex and run `/hooks`, then review and trust **Afyx Codex Usage Tracking**. The installer does not bypass this protection.

The component installer supports `-WhatIf`, `-CodexHome`, `-HooksPath`, `-VSCodeUserTasksPath`, `-SkipVSCodeTask`, and `-Uninstall`.

## Normal usage

After the hook is trusted, no task command needs to be started and no terminal watcher needs to remain open. Each completed turn produces a compact local message such as:

```text
Codex Usage · 209,112 tokens · ~$0.095437
Input 208,798 · Cached 207,232 · Output 314 · Reasoning 45
```

The hook uses the event's `transcript_path`, verifies that it belongs to the event's `session_id`, then reads the bounded transcript tail beginning at the exact `turn_id`'s `task_started`. Codex invokes `Stop` before appending `task_complete`, so the trusted `Stop` event supplies the local completion boundary while the existing parser consumes the latest exact `turn_token_usage`. A short bounded retry covers the final token record write. If correlation is not confident, it returns no usage message rather than selecting a different conversation. Its output uses `continue: true`; it never uses `decision: block`, `additionalContext`, or a continuation prompt.

## Fallback/debug watcher

Run:

```text
Ctrl+Shift+P
→ Tasks: Run Task
→ Codex: Watch Token Usage
```

The task uses `pwsh`, stays active in a dedicated terminal, and reports one summary after each completed turn. It is a user-level troubleshooting tool, so no `.vscode/tasks.json` is added to application repositories. It is not started automatically.

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

The tests cover consecutive turns, cumulative deltas, cache-write accounting, reasoning non-duplication, unknown models, aborted-turn gaps, live file tailing, session rollover, watcher restart behavior, Stop-hook JSON and exact correlation, hook/task merge idempotency, skip behavior, and preservation during uninstall.

## Limitations and troubleshooting

- The parser targets the observed Codex 0.155.x JSONL schema and tolerates missing optional usage fields. A future incompatible telemetry schema may require an update.
- Pricing is deliberately explicit and can become stale. Update the separate JSON only after checking official OpenAI pricing.
- Hook trust state is not reliably machine-readable; use `/hooks` to review it.
- If no rollout file exists, start one Codex conversation and rerun the task.
- If the user task is missing, verify `%APPDATA%\Code\User\tasks.json`, rerun the installer, and restart VS Code's task picker.
- If pricing shows `N/A`, compare the telemetry model name with the explicit keys in `codex-usage-pricing.json`; do not alias it to another model without verified pricing.
