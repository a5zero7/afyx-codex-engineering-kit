# Afyx Alpha Integration Roadmap

Status: **T01 documentation contract complete; benchmark readiness remains provisional**
Observed: **2026-10-15**
Canonical milestone source: [AFYX_V1_MASTER_ROADMAP.md](AFYX_V1_MASTER_ROADMAP.md)
Identity ledger: [AFYX_ALPHA_BASELINES.json](AFYX_ALPHA_BASELINES.json)

## Scope and governance

This plan makes Graph, Afyx Engineering Expert, and Forge work executable against one vocabulary. It does not promote an artifact, activate Technical Alpha, run a benchmark, or change Jira status.

- `main` remains canonical integration. `dev` is ordinary engineering and starts at verified T02 final source `ad1560dd930ccde94b0dadaa7b42d804be55714f`. `alpha` is reviewed Technical Alpha stabilization and starts at the existing `release/alpha-0.1` baseline `018dce0a31f927f2dc200c7be0bc8b71a8a3535c`. The historical branches remain preserved.
- Promotion flows `dev` -> reviewed `alpha` promotion -> accepted `main` integration. This is documented policy only: GitHub reports `main` and `release/alpha-0.1` as unprotected, so reviews and non-force integration remain operational gates rather than enforced branch protection.
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
| T02 | Graph case reproduction and correctness closure | AFYX-248; reuse AFYX-280–282; AFYX-265/278 where relevant | Source-grounded disposable reproduction; correctness and layer accounting close | PASS; exact-head Graph Build 38700997957 succeeded on 3 OS |
| T03 | Graph candidate promotion and artifact identity | AFYX-279; separate Graph promotion tracking | After T02 PASS; immutable source/artifact identity and promotion review | PREPARED; promotion blocked by unresolved PR #59 review |
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

## T02 correctness closure and bounded T03 handoff

T02 used an owned, Git-tracked disposable Odoo-style fixture and an identified development build from implementation revision `7fe932892c06fb9aae873bafb686de0ff05be330`. The package is Afyx Graph `1.0.0`, extraction version 28; its temporary npm package SHA-256 is `56fc427324ea085aa61697c542a2f42c9c0bd4dc0c4f74b6025e4fe7f75d919d` and built CLI SHA-256 is `0bd19746ce165a317accd5b6d125155c9b64f0aac88a8325973883062f655456`. These identify a local development build only; no artifact was promoted or installed.

| Layer | Expected | Actual | Verdict |
|---|---|---|---|
| Discovery/scanning | Three scoped target files indexed; ignored/virtualenv excluded; sibling outside query scope may remain indexed | 4 discovered/eligible/indexed, 0 skipped/unsupported/failed; three target files plus one tracked sibling; ignored and `.venv` absent | PASS |
| Extraction | Nine supported scalar/list/tuple `_inherit` matches; `_name`, `sale.order.line`, comments/strings excluded; one dynamic expression unresolved | Independent Python AST and Graph agree on 9 declarations across 3 files/modules and one dynamic unresolved expression | PASS |
| Persistence | Exact paths, repeated class identity, line spans, module names survive storage | All nine rows and lines match AST ground truth; duplicate `SharedName` remains file-qualified | PASS |
| Freshness | Complete extraction-v28 index, current tracked tree, no pending change after reconciliation | `COMPLETE`, built/current extraction 28, `FRESH`, 0 pending after reconciliation, 0 pending references | PASS |
| Ranked retrieval | `limit=4` is a bounded relevance page, not inventory | Four rows shown with explicit truncation; full source population remains indexed | PASS |
| Exact inventory | Full query reports 9/3/3; limited query reports totals and incompleteness | Full CLI and actual MCP report 9 declarations, 3 files, 3 modules, complete coverage; limit 4 reports 5 remaining | PASS |

The historical nine-versus-four observation is reproduced as a retrieval-mode difference: ranked search at limit four returns four rows, while exact inventory over the same complete index returns all nine. It is not a remaining discovery, extraction, or persistence loss. The 45-versus-approximately-eight report has the same bounded-ranked-page explanation; the existing 45-declaration regression remains reused verified functionality.

One product defect remained. AFYX-282 made `afyx_graph_inventory` a default correctness route, but the older `<500`-file MCP tool filter retained only navigation tools and silently removed inventory after project initialization. The default actual MCP session therefore advertised only `afyx_graph_explore` on the small acceptance fixture. The minimal fix retains inventory in that filter; actual MCP now advertises `afyx_graph_inventory` plus `afyx_graph_explore`, and the inventory call returns the exact 9/3/3 result. No extraction, ranking, schema, index, or parser behavior changed, so extraction version remains 28.

Existing incremental coverage is reused and rerun: add raises 9→10, delete restores 9, rename moves stored paths without duplicates, modify produces 8 then restores 9, catch-up gates the query, and reopen preserves 9. A separate disposable reconciliation also removed a transient probe file and returned the index to 4 files, 35 nodes, 31 edges, and zero pending changes.

Local validation: focused inventory/routing 29/29 PASS; expanded sync/freshness selection 101/101 PASS; clean TypeScript/UI build PASS; semantic extraction-v28 additive contract and six-fixture historical baseline PASS; CLI/MCP smoke 21/21 PASS; identity, component, independence, and artifact-identity checks PASS. The full local Node 26 Windows suite is FAIL because of pre-existing/environmental TEMP cleanup `EPERM`, a Windows `which` fixture, and load-sensitive timeouts; isolated T02 and representative sync cases pass. Exact-final-head Node 24 Windows/Linux/macOS Graph Build remains the T02 closure authority and is recorded externally to avoid a self-referential documentation commit.

T02 closed at source/documentation HEAD `ad1560dd930ccde94b0dadaa7b42d804be55714f`. Exact-head [Graph Build 38700997957](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38700997957) passed on Windows, Linux, and macOS. Its input to T03 is the accepted source revision, local build identity above, nine-declaration evidence, MCP exposure regression, and validation record. Installed Windows/macOS acceptance remains T04/T05 and was not performed here.

## T03 branch governance and promotion manifest

Observed branch topology on 2026-10-15:

| Role | Branch | Starting revision | Actual enforcement |
|---|---|---|---|
| Canonical integration | `main` | `5349c4a184e539f0ac0752d895ff3262c6326e29` | GitHub branch protection NOT CONFIGURED |
| Technical Alpha stabilization | `alpha` | `018dce0a31f927f2dc200c7be0bc8b71a8a3535c` | Policy documented; GitHub protection NOT CONFIGURED |
| Ordinary engineering | `dev` | `ad1560dd930ccde94b0dadaa7b42d804be55714f` | Tracks `origin/dev`; review required before Alpha promotion |

Historical refs `afyx/native-phase5f-parser-grammar`, `release/alpha-0.1`, and `afyx/afyx-279-alpha-security-promotion` are retained unchanged. PR [#59](https://github.com/a5zero7/afyx-codex-engineering-kit/pull/59) remains open against legacy `release/alpha-0.1`: it is mergeable/CLEAN and its recorded Windows/Linux/macOS CI and Graph Build checks pass, but no review decision is recorded. It must be approved and merged by its existing process before `alpha` is synchronized by verified non-force integration. T03 does not merge or retarget it.

The reviewable promotion is layered rather than a merge of all `dev`:

1. Preserve frozen candidate source `a431ba9ad5fae7bd06329f1fc6e42f1ba503f6dd` as historical rollback evidence.
2. Complete PR #59 security review and integrate its four commits (`5c5a4a5`, `637bdae`, `923cf1c`, `0ca928d`) into legacy Alpha through the existing review.
3. Synchronize the approved legacy Alpha result into `alpha` without rewriting history.
4. Create a Graph-only promotion from that exact security baseline. Include accepted AFYX-280 bounded-search prerequisites (`4572dc2`, `e508732`), AFYX-282/extraction-v28 inventory and acceptance (`d728a20`, `c16ff5c`, `ef8777a`, `0a9615d`, `2e81388`, `8837ea9`), and T02 MCP allowlist correction (`7fe9328`). Review the resulting patch rather than relying on commit ancestry alone.
5. Exclude Expert, Forge, evaluation harness, unrelated skill/installer changes, and all other development-only files. A direct PR #59-head-to-`dev` comparison contains 106 changed paths, including 75 non-Graph paths outside the bounded release/documentation/workflow scope, so merging all of `dev` is prohibited.

General CI now runs on pushes to `main`, `dev`, and `alpha`, and on pull requests to `main` or `alpha`. Graph Build runs path-filtered pushes to those three branches and path-filtered pull requests to `main` or `alpha`; it remains manually dispatchable. The stable Graph Release workflow is unchanged and must not be used for this Technical Alpha candidate.

Candidate identity remains pending until the scoped promotion is reviewed and merged. The required matrix is six inner archives—`win32-x64`, `win32-arm64`, `linux-x64`, `linux-arm64`, `darwin-x64`, and `darwin-arm64`—each tied to the same exact `alpha` source SHA, package/product `1.0.0`, channel `technical-alpha`, Node `>=22.5.0`, extraction version 28, embedded revision, release manifest, and inner-archive SHA-256. GitHub wrapper ZIP digests are not accepted as archive identities. Publisher authenticity remains `NOT VERIFIED` unless independent attestation is established.

No new candidate artifact exists in T03 preparation. The T02 archive is a local development package, not a distribution candidate; therefore archive digests, retained downloads, isolated candidate installation, upgrade/rollback, and T04/T05 handoff are `NOT PERFORMED`. The local Node 26 Windows full-suite failure remains a supported-runtime compatibility risk: cleanup `EPERM` and missing Unix `which` are environment-specific in isolated evidence, while load-sensitive timeouts are not fully dispositioned. Node 24 is the cross-platform CI baseline; the published Node floor remains `>=22.5.0`. Candidate approval requires explicit Node 26 disposition rather than narrowing support or calling the local suite PASS.

## Jira comment drafts — not posted

### AFYX-279

> T03 preparation established `dev` at T02 final source `ad1560dd930ccde94b0dadaa7b42d804be55714f` and `alpha` at legacy stabilization baseline `018dce0a31f927f2dc200c7be0bc8b71a8a3535c`; historical branches remain unchanged. PR #59 is OPEN, mergeable/CLEAN, and its recorded 3-OS checks pass, but no review decision is recorded. The scoped promotion manifest includes the accepted AFYX-280 prerequisites, AFYX-282 extraction-v28 inventory changes, and T02 allowlist fix while excluding Expert, Forge, and other development-only paths. No candidate SHA or archive digest exists yet. Status: PREPARED / PROMOTION BLOCKED pending PR #59 approval, verified Alpha synchronization, scoped promotion review, exact-source CI, retained six-target artifacts, inner-archive SHA-256 verification, isolated acceptance, and Node 26 compatibility disposition. No merge, release, install, or Jira status change was performed.

### AFYX-248

> T02 is complete: exact-head Graph Build 38700997957 passed Windows/Linux/macOS at `ad1560dd930ccde94b0dadaa7b42d804be55714f`, with AST and exact inventory agreeing on 9/3/3 and tiny-repository MCP advertising Inventory plus Explore. T03 branch governance and a bounded Graph-only promotion manifest are prepared, but promotion is blocked by unresolved PR #59 review and no candidate artifact has been created. T04/T05 remain blocked; no IJP/Adit install or acceptance was performed. The local Node 26 full-suite failure remains explicitly recorded as a supported-runtime compatibility risk pending disposition.

### AFYX-283

> T01.1 preserves Expert v0.1.1 identity separately from historical v0.1.0. AFYX-283 is externally reported In Progress. T06 owns D.6 substantive review and candidate freeze; T07 owns controlled A1/B1 acceptance and cannot start before T06. The reported D.5 5/5 evidence, isolation contract, hard quality gates, and progressive-disclosure regression target remain unchanged. No evaluation was run and no status was changed.

### AFYX-12

> T01.1 preserves Forge Track A in the current Alpha development cycle without making it a frozen-v1 blocker. AFYX-12 is externally reported To Do. T08 owns A0–A3, T09 owns A4–A8, T10 owns A9–A10 only after an A8 GO, and T11 owns A11–A12. T12 is combined integration acceptance. The B0–B5 contract remains provisional; no Forge benchmark, implementation, promotion, or status change occurred.
