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

Jira was not directly available to this Codex session. The user supplied a separately verified snapshot dated 2026-10-15: AFYX-12 `To Do`, AFYX-248 `In Progress`, AFYX-269 `To Do`, AFYX-279 `In Review`, AFYX-282 `Done`, and AFYX-283 `In Progress`. This is attributed external evidence, not a live Jira verification or status change by this session; no Jira comment was posted.

## Twelve master tasks

These are the twelve approved master-task identities. They reuse existing Jira issues, create no new issues, and do not predict PASS.

| Task | Deliverable | Reused Jira | Dependency / exit | Planning state |
|---|---|---|---|---|
| T01 | Scope, baseline, evaluation contract | AFYX-248 / AFYX-283 / AFYX-12 | This document and ledger validated | COMPLETE (documentation only) |
| T02 | Graph case reproduction and correctness closure | AFYX-248; reuse AFYX-280–282; AFYX-265/278 where relevant | Source-grounded disposable reproduction; correctness and layer accounting close | READY, NOT STARTED |
| T03 | Graph candidate promotion and artifact identity | AFYX-279; separate Graph promotion tracking | After T02 PASS; immutable source/artifact identity and promotion review | BLOCKED by T02 |
| T04 | Installed-artifact IJP Windows acceptance and durability | AFYX-252/253/254 | After T03; exact installed artifact on AFYX-248 Windows scope | BLOCKED by T03 |
| T05 | Adit native macOS pilot acceptance | AFYX-269; related child issues | After T03; compatible native artifact and tester consent | BLOCKED by T03; AFYX-269 externally reported To Do |
| T06 | Expert D.6 substantive review and candidate freeze | AFYX-283 | Fresh, correlated D.5 evidence; independent substantive review | OPEN; AFYX-283 externally reported In Progress |
| T07 | Expert controlled A1/B1 acceptance | AFYX-283; related AFYX-67/68 | After T06; frozen candidate, rubric, isolation, sampling, and budget | BLOCKED by T06 |
| T08 | Forge A0–A3 capability and contract work | AFYX-88–91 / AFYX-171–176 | Evaluation freeze before capability harvest/matrix/refinement | PLANNED |
| T09 | Forge A4–A8 candidate evaluation and architecture decision | AFYX-92–96 / AFYX-177–183 | After T08; immutable B0–B5 candidates and predeclared decision rule | BLOCKED by T08 |
| T10 | Forge A9–A10 implementation and adaptive modes | AFYX-97/98 / AFYX-184–186 | Only after T09 records an explicit GO at A8 | BLOCKED by T09 GO |
| T11 | Forge A11–A12 dogfood and final acceptance | AFYX-99/100 / AFYX-187/188 | After T10; dogfood and stable-contract gates | BLOCKED by T10 |
| T12 | Combined artifact and integration acceptance | AFYX-248 / AFYX-269 / AFYX-283 / AFYX-12 | After T04, T05, T07, and T11 PASS | BLOCKED by component acceptance |

PR #59 remains the AFYX-279 security promotion and does not prove Graph inventory inclusion. T03 must track Graph promotion separately without creating a duplicate issue. Jira status for child issues not present in the supplied snapshot remains `NOT VERIFIED`.

Forge gate coverage is explicit: A0 evaluation freeze; A1 capability harvest; A2 capability matrix; A3 deduplication/refinement; A4 B0-B5 candidate construction; A5 benchmark harness; A6 quality gate; A7 efficiency gate; A8 evidence-driven architecture decision; A9 implementation; A10 adaptive directive; A11 dogfood/optimization; A12 stable contract. T08–T11 preserve this order and do not skip a gate. T12 is combined Kit integration acceptance, not Forge stable acceptance.

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

Pre-benchmark blockers: AFYX-12 is externally reported `To Do`, A0 task/rubric freeze has not occurred, B2 content identity is not recorded here, B4/B5 do not exist, and the proposed 36-cell matrix conflicts with the current 27-run ceiling. No Forge evaluation or implementation is ready from T01 alone.

## T02 bounded Graph handoff

First case: reproduce the nine-declaration Odoo-17-style `_inherit = 'sale.order'` exact-inventory case in an owned disposable Git repository using an identified development build—never an installed user runtime or client repository. The reference build must record its exact source revision, archive/build digest, package version, platform, and extraction version; `a5112a36f76a1f0168e3a85900ffe33d34ebcb08` is the T01 closure baseline, not permission to assume an unrecorded binary matches it.

Collect: (1) fixture Git revision and direct-source/independent Python-AST ground truth, including ignored and negative declarations; (2) development-build digest, embedded source revision, platform, package/CLI version, extraction version, and sanitized runtime path; (3) index timestamps/state and discovered/eligible/indexed/skipped/unsupported/failed accounting; (4) initial and limited exact inventory, ranked limit/truncation, incremental create/modify/delete/rename, catch-up, restart, and reconciliation; (5) correlated stdout/stderr/exit status and fixture immutability. Record any installed artifact identity as a separate observation; it is not the T02 execution subject.

Acceptance: Git/AST and exact inventory agree on all nine supported declarations and locations; ignored/negative/dynamic cases have documented dispositions; limited pages say incomplete; catch-up and restart converge without stale rows; every diagnostic is accounted for; ranked results are not treated as exhaustive inventory; development-build provenance and index freshness match the recorded T02 baseline. Installed extraction-v28 acceptance belongs after T03 in T04/T05 and is not a prerequisite for T03 promotion review.

## Jira comment drafts — not posted

### AFYX-248

> T01.1 corrects the twelve master-task identities without changing the accepted baselines or contracts. AFYX-248 remains externally reported In Progress; AFYX-269 remains the separate macOS task, externally reported To Do. T02 is source-grounded correctness on an owned nine-declaration fixture and identified development build. Graph promotion is T03; installed Windows/macOS acceptance is T04/T05. No benchmark, install, promotion, status change, or client-repository mutation occurred.

### AFYX-283

> T01.1 preserves Expert v0.1.1 identity separately from historical v0.1.0. AFYX-283 is externally reported In Progress. T06 owns D.6 substantive review and candidate freeze; T07 owns controlled A1/B1 acceptance and cannot start before T06. The reported D.5 5/5 evidence, isolation contract, hard quality gates, and progressive-disclosure regression target remain unchanged. No evaluation was run and no status was changed.

### AFYX-12

> T01.1 preserves Forge Track A in the current Alpha development cycle without making it a frozen-v1 blocker. AFYX-12 is externally reported To Do. T08 owns A0–A3, T09 owns A4–A8, T10 owns A9–A10 only after an A8 GO, and T11 owns A11–A12. T12 is combined integration acceptance. The B0–B5 contract remains provisional; no Forge benchmark, implementation, promotion, or status change occurred.
