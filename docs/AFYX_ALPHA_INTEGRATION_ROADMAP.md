# Afyx Alpha Integration Roadmap

Status: **T01 documentation contract complete; benchmark readiness remains provisional**
Observed: **2026-10-15**
Canonical milestone source: [AFYX_V1_MASTER_ROADMAP.md](AFYX_V1_MASTER_ROADMAP.md)
Identity ledger: [AFYX_ALPHA_BASELINES.json](AFYX_ALPHA_BASELINES.json)

## Scope and governance

This plan makes Graph, Afyx Engineering Expert, and Forge work executable against one vocabulary. It does not promote an artifact, activate Technical Alpha, run a benchmark, or change Jira status.

- `main` remains canonical integration; `afyx/native-phase5f-parser-grammar` remains ongoing engineering; `release/alpha-0.1` remains stabilization-only.
- AFYX-248 owns IJP Odoo 10/17 Windows acceptance. AFYX-269 owns Adit's macOS pilot. Neither is closed here.
- The accepted candidate, branch HEAD, source revision, installed executable, and persisted index are distinct identities. A claim about one never proves another.
- PR [#59](https://github.com/a5zero7/afyx-codex-engineering-kit/pull/59) is open, targets `release/alpha-0.1`, and promotes AFYX-266 security work from head `0ca928da5e4b6f3ce170d954fed31d50319da2bb`. Its recorded checks passed, but it predates AFYX-282 and does not prove Graph inventory inclusion.
- Graph engineering acceptance for AFYX-282 and Knowledge Catalog is reusable, but installed-artifact acceptance for extraction v28 is still unverified.
- Expert D.5 is recorded as a reported automated 5/5 PASS. D.6 substantive review and formal A1/B1 remain independent gates.
- Forge Track A is scheduled into the current Alpha development cycle. Its identity and A0-A12 gates are unchanged. This scheduling exception does not add Forge to the frozen v1 release requirements and does not auto-complete Technical Alpha, Alpha, Private Beta, or Stable.
- Holdouts, rubrics, canaries, and ground truth stay evaluator-only outside both developer and evaluated-agent roots. Only sanitized development evidence belongs in this repository.

Jira was not directly available during T01. Issue status assertions below are therefore repository-backed observations or explicitly `NOT VERIFIED`; no Jira comment was posted.

## Twelve planning groups

These are planning groups, not twelve new Jira issues and not predictions of PASS.

| # | Planning group | Reused Jira | Dependency / exit | State |
|---|---|---|---|---|
| 1 | T01 scope, identity, and acceptance contract | AFYX-248 | This document and identity ledger validated | COMPLETE (documentation) |
| 2 | Graph installed-runtime provenance | AFYX-248 | Exact executable/artifact SHA, manifest digest, platform, extraction/index version | OPEN |
| 3 | Graph first reproducible inventory case | AFYX-248; AFYX-282 evidence | Group 2; Git/direct-source ground truth and fresh index | OPEN (T02 handoff) |
| 4 | Graph layer correctness and freshness | AFYX-248; AFYX-282 | Discovery, extraction, persistence, catch-up/restart, failures accounted separately | OPEN |
| 5 | Graph ON/OFF acceptance experiment | AFYX-248; AFYX-269 on macOS | Groups 2-4; frozen public cases and correlated evidence | PROVISIONAL |
| 6 | Expert candidate provenance | AFYX-283 | v0.1.1 fingerprint and v0.1.0 history remain distinct | COMPLETE (identity only) |
| 7 | Expert D.6 substantive evidence review | AFYX-283 | Fresh D.5 records with matching run correlation and independent evaluator | OPEN / Jira status NOT VERIFIED |
| 8 | Expert formal A1/B1 comparison | AFYX-283 | Group 7; frozen rubric, sampling, budget, holdout boundary | BLOCKED by Group 7 and thresholds |
| 9 | Forge A0 evaluation freeze | AFYX-12 | Public tasks, protected holdouts, scoring, budget, fingerprints approved | PLANNED / Jira state NOT VERIFIED |
| 10 | Forge A1-A4 harvest, matrix, refinement, candidates | AFYX-12 | Group 9; B0-B5 identities immutable per campaign | PLANNED |
| 11 | Forge A5-A8 harness, quality, efficiency, decision | AFYX-12 | Group 10; independent evidence and predeclared decision rule | PLANNED |
| 12 | Forge A9-A12 implementation, adaptive directive, dogfood, stable | AFYX-12 | A8 explicitly selects architecture; later maturity gates pass | PLANNED |

AFYX-279 remains the security-promotion issue and is not repurposed as a Graph, Expert, or Forge acceptance group. Current Jira details for AFYX-12 and linked tickets require Jira-side confirmation.

Forge gate coverage is explicit: A0 evaluation freeze; A1 capability harvest; A2 capability matrix; A3 deduplication/refinement; A4 B0-B5 candidate construction; A5 benchmark harness; A6 quality gate; A7 efficiency gate; A8 evidence-driven architecture decision; A9 implementation; A10 adaptive directive; A11 dogfood/optimization; A12 stable contract. Groups 9-12 preserve this order and do not skip a gate.

## Identity interpretation

The JSON ledger is authoritative for T01 observations. `NOT_VERIFIED` is a result, not an invitation to infer equality. In particular:

- development source is verified at `cdce74c7b75fae94ca99966bb80451afdb766e60`;
- the frozen accepted Technical Alpha source remains `a431ba9ad5fae7bd06329f1fc6e42f1ba503f6dd`, while its per-platform archive digests were not locally verified in T01;
- the Windows runtime revision `5b6ab08d...` is historical AFYX-265 evidence, not a current-runtime claim; macOS runtime identity is unknown;
- source extraction version is 28; every installed index must separately report its build version and freshness;
- Expert v0.1.0 historical evidence and v0.1.1 candidate evidence must never be pooled;
- Forge has definitions only: no frozen harness or B4/B5 candidate exists yet.

## Acceptance contracts

All contracts apply hard gates in this order: correctness, task fidelity, evidence quality, and security; efficiency is considered only after those gates pass. Provider-reported tokens, elapsed time, and observable tool calls may be compared. Monetary cost is `NOT AVAILABLE` unless the provider supplies a trustworthy value; it must not be estimated.

### Graph ON/OFF — PROVISIONAL

| Field | Contract |
|---|---|
| Public categories | Exact structural inventory; ranked navigation/relationship discovery; incremental freshness/restart; negative unsupported/ignored/path-safety cases |
| OFF | Direct source/Git-grounded inspection with Graph unavailable; same revision, prompt, permissions, and oracle |
| ON | Exact pinned installed Graph artifact and fresh extraction-v28 index; inventory for exhaustive supported facts, ranked tools only for navigation |
| Sampling | **PROPOSED:** four categories × ON/OFF × three fresh repetitions = 24 cells, deterministic interleaving and recorded seeds |
| Budget | **PROPOSED:** existing 27-run campaign ceiling; identical per-cell timeout and permissions; no unbounded retries |
| Hard acceptance | **PROPOSED:** 100% supported-fact ground-truth correctness, zero unauthorized access/mutation, zero fabricated completeness, all failures/ignored/unsupported files accounted for |
| Regression tolerance | **PROPOSED:** zero correctness/security regression versus OFF. Efficiency is descriptive until a stable paired baseline exists; no token/time win is claimed |
| Evidence | Archive SHA-256 and manifest, embedded revision, platform, extraction version, Git revision, index timestamps/state, discovery accounting, exact totals/pages, ranked limit/truncation, correlated result IDs |

Blocker before freeze: installed runtime/artifact and index identity are not verified, and the numeric efficiency non-inferiority margin has no approved empirical baseline.

Graph layer verdicts are independent: discovery decides eligible paths; extraction produces supported facts; persistence stores facts and diagnostics; freshness covers catch-up, reconciliation, restart and version drift; ranked retrieval is bounded relevance navigation; exact inventory is exhaustive only for supported values within its declared scope and coverage. A short ranked page is not evidence of missing indexing. A limited inventory page is not complete even when its rows are correct.

### Expert A1/B1 — PROVISIONAL

Expert aliases are `A0=N`, `A1=CORE`, `B0=X`, and `B1=CORE_X`. This B1 means Core plus Expert; it is unrelated to Forge B1.

| Field | Contract |
|---|---|
| Public categories | Architecture, security, database/reliability, ERP/Odoo composition, negative routing; DEVELOPMENT prompts may calibrate but are not private holdouts |
| A1 | Efficient Coding + Odoo Engineering + Prompt Master, exact frozen versions |
| B1 | Same A1 skills plus exact Expert candidate fingerprint; identical model, provider, reasoning, permissions, fixture, and prompt |
| Sampling | Existing discovery round: one fresh cell per scenario/configuration; confirmation only for ambiguity/failure, within 27 total runs. Formal repetition rule needs approval |
| Budget | Correlated `evaluation_run_id`, fresh workspaces, MXC/root-deny isolation, bounded child timeout and cleanup; same limits for A1/B1 |
| Hard acceptance | **PROPOSED:** every applicable cell passes all four gates; zero evaluator access; negative routing has no Afyx read/tool call; ERP observes distinct Expert/Odoo ownership; no fabricated execution |
| Regression tolerance | **PROPOSED:** zero loss of an A1 hard-gate PASS in B1. Start with one primary and at most two supporting domains unless evidence justifies expansion. Efficiency remains descriptive pending D.6 |
| Evidence | Environment/skill hashes, run/control IDs, observable skill/reference/workflow reads, sanitized output, independent-evaluator rubric verdicts, provider token fields, wall time, tool calls, mutation check |

Blockers: D.6 has not been independently verified by T01, the historical seven-reference disclosure defect remains a regression target, and formal repetition/efficiency thresholds are not approved. The reported D.5 5/5 result cannot substitute for D.6 or A1/B1.

### Forge B0-B5 — PROVISIONAL / A0 NOT FROZEN

| Field | Contract |
|---|---|
| Public categories | Known-file bug; unknown-defect diagnosis; cross-module change; security-sensitive change; data/reliability change; negative/simple task |
| Candidates | B0 no directive; B1 Efficient Coding 1.2.0; B2 independent master prompt; B3 B1+B2; B4 refined convergence; B5 native Forge |
| Sampling | **PROPOSED DISCOVERY:** one fresh repetition of six categories per candidate (36 cells). This exceeds the current 27-run Expert ceiling, so Forge must approve a separate budget or reduce a predeclared stratified set before A0 freezes |
| Budget | Identical model/provider/reasoning/tool permissions and task budgets; bounded retries; candidate fingerprints immutable within a campaign |
| Hard acceptance | **PROPOSED:** correctness/security regressions = 0; all task validation passes; no unauthorized scope expansion; provenance complete. B4/B5 meet quality before efficiency ranking |
| Regression tolerance | **PROPOSED:** no hard-gate loss versus the best legitimate baseline. Numeric token/time tolerance is `NOT APPROVED` until A0 measures variance |
| Evidence | Public task/fixture hashes, evaluator-only holdout IDs, candidate hashes, environment fingerprint, run correlation, test output, file diff, skill/tool reads, provider tokens, elapsed time, failures/exclusions |

Pre-benchmark blockers: AFYX-12 status is not verified, A0 task/rubric freeze has not occurred, B2 content identity is not recorded here, B4/B5 do not exist, and the proposed 36-cell matrix conflicts with the current 27-run ceiling. No Forge evaluation or implementation is ready from T01 alone.

## T02 bounded Graph handoff

First case: reproduce the nine-file Odoo-17-style `_inherit = 'sale.order'` exact-inventory case in an owned disposable Git repository using the installed candidate artifact—never a client repository.

Collect: (1) Git revision and direct-source/independent Python-AST ground truth, including ignored and negative declarations; (2) archive digest, release manifest, embedded revision, platform, CLI version, and sanitized runtime path; (3) index extraction version, timestamps/state, and discovered/eligible/indexed/skipped/unsupported/failed accounting; (4) initial and limited exact inventory, ranked limit/truncation, incremental create/modify/delete/rename, catch-up, restart, and reconciliation; (5) correlated stdout/stderr/exit status and fixture immutability.

Acceptance: Git/AST and exact inventory agree on all nine supported declarations and locations; ignored/negative/dynamic cases have documented dispositions; limited pages say incomplete; catch-up and restart converge without stale rows; every diagnostic is accounted for; ranked results are not treated as exhaustive inventory. Installed-artifact provenance and extraction-v28 freshness must be `MATCH`. Missing identity or freshness evidence is `BLOCKED`, not PASS.

## Jira comment drafts — not posted

### AFYX-248

> T01 reconciled the Alpha plan at development revision `cdce74c7...`. AFYX-248 remains the Windows IJP acceptance umbrella; AFYX-269 remains the separate macOS pilot. Graph AFYX-282/Knowledge Catalog engineering results are reused but do not prove the installed artifact. The next bounded gate is T02 installed-artifact provenance plus the owned nine-declaration exact-inventory case. No benchmark, install, runtime mutation, status change, or client-repository mutation occurred.

### AFYX-283

> T01 records Expert v0.1.1 candidate identity (`8df29c3...`, content SHA-256 `06d947c...`) separately from historical v0.1.0. D.5 5/5 is retained as reported evidence; D.6 substantive review and formal A1/B1 remain separate, provisional gates. The contract preserves independent evaluator isolation, correlated evidence, four hard quality gates, negative routing, ERP composition ownership, and the seven-reference regression target. No evaluation was run and no status was changed.

### AFYX-12

> T01 schedules Forge Track A into the current Alpha development cycle without making it a frozen-v1 blocker or changing A0-A12. The B0-B5 contract is provisional: A0 is not frozen, Jira state is not independently verified, B2 identity is missing, B4/B5 do not exist, and the proposed 36-cell matrix needs an approved budget. No Forge benchmark, implementation, promotion, or status change occurred.
