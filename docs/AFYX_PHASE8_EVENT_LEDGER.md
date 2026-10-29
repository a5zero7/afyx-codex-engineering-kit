# AFYX-68 / AFYX-69 — Offline event ledger (draft, bounded)

This small **offline, standard-library-only** parser helps combine Phase 8.5 telemetry and Phase 8.6 human-intervention/rework evidence under one run identity. It **never launches an agent or makes provider calls**. Its input must already exist on the operator's machine. Raw messages, prompts, commands, tool payloads, personal paths, and secrets are not copied into the report. Only counts, run/thread identifiers, SHA-256 digests, and availability markers are emitted.

The source of truth for installed Codex token accounting remains `CodexUsage.psm1`; this tool only validates *run-local* `turn.completed.usage` evidence and must not replace the usage tracker. See `docs/CODEX_USAGE_TRACKER.md`. It does not estimate token usage from text length or monetary cost from API pricing.

## Read-only usage

Capture or locate a prior `codex exec --json` output file **locally**, without publishing it. Do not add `--ephemeral` when authoritative persisted rollout evidence is required, and preserve `turn.completed` and the correlated thread ID. A non-ephemeral session is not by itself evidence that the capture was complete.

```powershell
python scripts/phase8_event_ledger.py --run-id T1-ON --events D:\\private-evidence\\t1-on.jsonl --expected-thread-id <thread-id> --output D:\\private-evidence\\t1-on-summary.json
```

The parser refuses duplicate/missing `turn.completed`, unpaired item events, conflicting thread identities, invalid usage totals, negative tokens, and cached input greater than input. For missing usage fields, it emits `NOT_AVAILABLE` or `INCOMPLETE`. Its `observed_started` tool count is **capture-scoped**, not a claim to all internal agent calls; tool process success does not prove a nested operation escaped an ACL denial.

Optional adjudicated sidecar `annotations.jsonl` (one JSON object per line) can contain:

```jsonl
{"actor":"policy","event_type":"policy_denial","timestamp":"2026-10-29T01:00:00Z","evidence_ref":"local:event:001"}
{"actor":"agent","event_type":"agent_fallback","timestamp":"2026-10-29T01:00:10Z","evidence_ref":"local:event:002"}
{"actor":"agent","event_type":"rework","timestamp":"2026-10-29T01:00:20Z","evidence_ref":"local:revision:003","revision_before":"r1","revision_after":"r2","reason":"confirmed-correction"}
```

Human intervention must have `actor=human` and `event_type=human_intervention`. A policy denial is not a human action, an agent fallback is not automatically rework, and repeated similar tool calls are not automatically retry. An `explicit_retry` requires `attempt_group_id` and `attempt_index >= 2`.

Only after the responsible evaluator has audited a *complete* set of raw events may an annotation include:

```jsonl
{"type":"coverage","complete_categories":["human_intervention","rework"]}
```

Without the coverage attestation, even an empty sidecar yields `NOT_AVAILABLE`, not zero. A positive event without complete coverage is a **minimum observed**, not a complete total. A coverage attestation is an evaluator assertion requiring independent validation; the tool cannot prove that missing records never existed.

## Acceptance boundaries

- Existing AFYX-67/68 4-run historical sessions were ephemeral; no raw full event streams have been presented for these sessions. Do **not** fabricate totals or infer missing counts from final messages.
- One documented T1 ON policy-denied Graph retrieval and source fallback are *reported observations*, not proof of a human intervention or rework event.
- AFYX-68 and AFYX-69 stay **In Progress / PARTIAL** until the missing raw telemetry is acquired or a documented scope change is accepted.
- For new paired runs, freeze source SHA, task, model and reasoning effort, provider/tool exposure and approval policy, first. Obtain explicit owner budget/quota authorization before model calls; run each trial once to capture both Phase 8.5 and 8.6 evidence and avoid duplicate expense.
- Do not commit raw rollouts, transcripts, or private annotation evidence to GitHub. Keep PR #126 and owner-modified `.github/workflows/ci.yml` untouched.

Run focused tests with `python -m unittest scripts.tests.test_phase8_event_ledger -v`.
