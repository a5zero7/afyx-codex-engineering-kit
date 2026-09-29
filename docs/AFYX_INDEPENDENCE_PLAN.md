# Afyx Graph Independence Audit and Closure Plan

Status: Phase 3B.12B audit complete  
Baseline: `e401cbf002a0d0e57fcb9774d22c974abe580c4e`  
Historical comparison commit: `b7a1aa2718dc1f6940e483043733f67020d9a62f`  
Classification: `INDEPENDENCE_PLAN_READY_WITH_GAPS`

This document records technical provenance and plans implementation closure. It
does not make a legal conclusion, authorize removal of attribution, or begin a
rewrite. Detailed machine-readable evidence is stored outside the repository in
the audit scratch directory named by Phase 3B.12B.

## Independence target and quality floor

Afyx Graph is technically independent only when it has no runtime, build,
operational, package, configuration, release, or product-identity dependency on
CodeGraph; retains no private upstream implementation; and has no unexplained
substantial implementation overlap. Historical comparison tooling may remain an
external development oracle, never a product or user dependency.

Independence must preserve the accepted product: Search, Context, Graph, DB and
WAL, Impact/Affected Tests, Watcher, Daemon, MCP, CLI, Extraction, Resolution,
the optional UI, provider-aware installation, and future Odoo and Engineering
Assurance layers. The quality floor remains
`CORE_ACCEPTED_WITH_KNOWN_GAPS`. Context ranking, relation-aware presentation,
exact query, Odoo semantics, inconclusive token measurement, and result
explanation are product backlogs, not provenance findings.

The closure rule is **no rewrite for similarity alone**. A slice must establish
clearer Afyx ownership or architecture, lower coupling, better maintainability,
or equal/better correctness, determinism, performance, or context efficiency.
Cosmetic source-text change is not closure.

## Method and classification

The audit inventories 431 production/infrastructure text files under
`engine/src`, `engine/ui/src`, and top-level engine scripts. Each file is
compared with the historical snapshot using the established method:

- trim and collapse whitespace;
- substantive line = at least 20 characters with an alphanumeric token,
  excluding comment lines;
- exact normalized substantive/comment line membership;
- five-line non-empty shingles;
- `SequenceMatcher(autojunk=False)` identical blocks;
- same-path historical file first, otherwise the best historical-corpus
  candidate.

Similarity is only an indicator. Classification also uses module role, public
and schema boundaries, Git history, current architecture, call relationships,
and accepted behavioral evidence. Per-file classification cannot erase mixed
regions: a file classified `PUBLIC_CONTRACT` may still contain legacy private
implementation requiring separation.

| Classification | Meaning in this audit |
|---|---|
| `AFYX_NATIVE` | Afyx architecture/history plus low unexplained historical overlap |
| `PUBLIC_CONTRACT` | Observable library/CLI/MCP/provider compatibility boundary; private internals are not automatically exempt |
| `STANDARD_IDIOM` | Generic platform/framework mechanism with little private originality |
| `SCHEMA_OR_PROTOCOL` | Required DB, wire, type, or protocol shape |
| `BEHAVIOR_DEFINING_DATA` | Language/framework tables, constants, or fixtures required for observable behavior |
| `LEGACY_PRIVATE_IMPLEMENTATION` | Private structure materially retained from the historical implementation |
| `UNKNOWN_REQUIRES_REVIEW` | Evidence is insufficient for a safe region-level conclusion |

Machine file-level counts are 65 `AFYX_NATIVE`, 24 `PUBLIC_CONTRACT`, nine
`SCHEMA_OR_PROTOCOL`, 62 `BEHAVIOR_DEFINING_DATA`, 220
`LEGACY_PRIVATE_IMPLEMENTATION`, and 51 `UNKNOWN_REQUIRES_REVIEW`. Standard
idioms occur as regions inside mixed files rather than as a whole-file class.

The provenance scopes are:

- **Scope A:** every inventoried file in the subsystem.
- **Scope B:** files with evidence sufficient for `AFYX_NATIVE`.
- **Scope C:** every remaining/frozen host, including files that also carry a
  public contract, schema, or behavior-defining data. Scope C is the complement
  of B and prevents contract labels from hiding private implementation.

## Subsystem inventory

| Subsystem | Significant current modules | Role and dependents | Current status |
|---|---|---|---|
| Search | `src/search/*` | Parsing, segmentation, scoring, vocabulary, path/test signals; used by public facade, CLI, MCP, Context, UI | Afyx-native core plus seven residual hosts |
| Context | `src/context/*` | Bounded seeding, expansion, rerank, rendering; consumed by facade, CLI and MCP | Mostly Afyx-native architecture; five residual hosts |
| Graph Core | `src/graph/*` | Store facade, traversal, relations, routes, hierarchy, dead-code and flow; used by all query surfaces | Native store/walk split around high-overlap legacy hosts |
| DB Read/Write | `src/db/*reader*`, `*writer*`, sessions, `queries.ts`, `index.ts` | SQLite persistence behind Graph, indexing and query surfaces | Native granular writers/readers coexist with residual monolith-derived hosts |
| WAL/durability | `src/db/wal-*`, `connection-tuning.ts` | Checkpoint, pressure, valve and connection policy; used by DB/index/sync | One native configuration module; five residual hosts |
| Impact/Affected Tests | `src/impact/*` | Symbol/file impact and affected-test propagation; called by CLI/MCP and future UI adapter | Afyx-native, corrected against ground truth |
| Watcher/Sync | `src/sync/*` | Worktree discovery, event scheduling, retry and sync policy; drives index freshness | Three native policy modules plus seven residual hosts |
| Daemon/Proxy | daemon/proxy/socket/liveness/writer-lock modules in `src/mcp` | Single-writer process and client lifecycle; hosts MCP engine | Granular current architecture, but private overlap remains |
| MCP | engine/session/tools/catalog/results/worker modules in `src/mcp` | MCP protocol adapter over public domain API | Afyx identity and newer registry/result split; large legacy hosts remain |
| CLI | `src/bin/*` | Public command contract and process lifecycle over domain APIs | Afyx product contract over substantially retained host implementation |
| CLI presentation | `src/ui/*` | ANSI/glyph/progress terminal rendering | Isolated but highly retained private implementation |
| Extraction | `src/extraction/*` | Discovery, parsing, language rules, workers, reconciliation and optional kernel | Reconciliation/registry work exists; parser/language host remains predominantly historical |
| Resolution | `src/resolution/*` | Import/name/framework/synthesizer resolution and worker pool | Corrected Afyx semantics and native policy extraction, but hosts remain predominantly historical |
| UI server | `src/ui-server/*` | Loopback HTTP, security, SSE, bounded presentation adapters and static serving | Optional adapter contract accepted; implementation predominantly historical |
| UI frontend | `ui/src/*` | Svelte views, models, navigation and visualization | Product identity updated; implementation predominantly historical |
| Installer/providers | `src/installer/*` | Target registry, config writers, provider integration | Correct ownership behavior, but implementation predominantly historical |
| Shared/public facade | `src/index.ts`, `types.ts`, freshness, directory, config, errors, product | Public `AfyxGraph` facade and shared product/state contracts | Mixed public contracts, two native modules, legacy private hosts |
| Packaging/distribution | engine build/check/smoke scripts and workflows | Builds npm/self-contained bundles and validates artifacts | Afyx release identity; four high-overlap helper hosts |
| Performance infrastructure | `scripts/benchmark*.mjs` | Deterministic subsystem performance baselines | Afyx-native and independent |

The public facade is consumed by CLI, MCP and UI as peer adapters. The UI
server reads through `AfyxGraph`; the daemon owns the writer; the installer is
outside graph semantics. These dependency boundaries remain frozen.

## Scope A/B/C provenance summary

Percentages below are normalized substantive-line overlap. Comment and shingle
columns describe Scope A. “Block” is the longest per-file identical non-empty
block; `>=8` is the total count of such blocks. These are measurement facts,
not derivation conclusions.

| Subsystem | A files | A subst. | A comments | A shingles | Block / >=8 | B files / subst. | C files / subst. |
|---|---:|---:|---:|---:|---:|---:|---:|
| Search | 15 | 13.49% | 22.86% | 0.62% | 7 / 0 | 8 / 8.45% | 7 / 21.51% |
| Context | 16 | 11.85% | 26.69% | 2.00% | 14 / 1 | 11 / 6.59% | 5 / 31.90% |
| Graph Core | 17 | 78.90% | 83.46% | 75.53% | 2130 / 33 | 8 / 4.35% | 9 / 91.93% |
| DB Read/Write | 27 | 43.77% | 28.65% | 12.08% | 139 / 24 | 11 / 9.84% | 16 / 51.94% |
| WAL/durability | 6 | 45.90% | 49.81% | 21.21% | 20 / 11 | 1 / 0.00% | 5 / 49.56% |
| Impact/Affected Tests | 4 | 5.80% | 13.64% | 0.00% | 4 / 0 | 4 / 5.80% | 0 / n/a |
| Watcher/Sync | 10 | 50.58% | 49.91% | 15.07% | 32 / 17 | 3 / 10.61% | 7 / 55.45% |
| Daemon/Proxy | 15 | 55.46% | 33.92% | 19.75% | 60 / 33 | 0 / n/a | 15 / 55.46% |
| MCP | 16 | 91.47% | 91.31% | 80.50% | 910 / 162 | 0 / n/a | 16 / 91.47% |
| CLI | 8 | 76.02% | 86.59% | 58.39% | 95 / 80 | 0 / n/a | 8 / 76.02% |
| CLI presentation | 5 | 97.79% | 95.33% | 91.96% | 132 / 7 | 0 / n/a | 5 / 97.79% |
| Extraction | 58 | 98.82% | 98.71% | 96.77% | 3694 / 142 | 1 / 13.33% | 57 / 98.94% |
| Resolution | 61 | 99.40% | 99.38% | 98.56% | 2735 / 103 | 0 / n/a | 61 / 99.40% |
| UI server | 34 | 98.32% | 98.69% | 93.80% | 1060 / 141 | 0 / n/a | 34 / 98.32% |
| UI frontend | 91 | 99.75% | 99.29% | 99.03% | 1142 / 121 | 0 / n/a | 91 / 99.75% |
| Installer/providers | 19 | 89.52% | 91.12% | 70.77% | 210 / 143 | 0 / n/a | 19 / 89.52% |
| Shared/public facade | 9 | 87.15% | 93.71% | 79.59% | 384 / 80 | 2 / 4.35% | 7 / 92.24% |
| Packaging helpers | 7 | 45.45% | 78.11% | 43.65% | 98 / 16 | 3 / 2.64% | 4 / 86.90% |
| Performance infrastructure | 13 | 2.27% | 12.80% | 0.00% | 3 / 0 | 13 / 2.27% | 0 / n/a |

## Classification findings

### Afyx-native modules

The strongest current native regions are:

- all four `src/impact/*` modules;
- Context budgets, builder, call paths, entry points, expansion, infix channels,
  query symbols, request, rerank, seeding, and settings;
- Graph catalog, containment, file graph, frontier walk, graph store, relations,
  route, and walk request;
- DB bulk windows, granular edge/file/graph/ref writers, graph reader, name
  vocabulary, query/write sessions, schema script, and SQL limits;
- Search edit distance, scoring, segmentation, stemming, terms, test paths,
  text runs, and vocabulary;
- Sync debounce scheduler, pending change set, and watcher scope;
- extraction registry, freshness and product identity modules;
- all 13 benchmark modules plus semantic/smoke/dist-clean helpers.

This list means those modules have positive architecture/history evidence and
low unexplained overlap. It does not imply that every neighboring caller is
independent.

### Legacy private implementation candidates

High-confidence candidates include `extraction/tree-sitter.ts`, extraction and
language hosts, `resolution/index.ts`, `import-resolver.ts`, `name-matcher.ts`,
resolution synthesizers, `graph/branch-guards.ts`, `graph/dead-code.ts`,
`mcp/tools.ts`, MCP diagnostics/session hosts, CLI and terminal presentation
internals, most UI API/view/model code, provider/installer implementations,
and legacy portions of the public facade. Large identical blocks and matching
private helper/control-flow organization support this classification; branding
does not.

The largest measured hosts include:

| File | Substantive overlap | Longest block |
|---|---:|---:|
| `src/extraction/tree-sitter.ts` | 99.97% | 3694 |
| `src/mcp/tools.ts` | 95.30% | 910 |
| `src/resolution/callback-synthesizer.ts` | 99.89% | 2735 |
| `src/resolution/name-matcher.ts` | 99.42% | 2169 |
| `src/graph/branch-guards.ts` | 100.00% | 2130 |
| `src/resolution/import-resolver.ts` | 98.63% | 1519 |
| `src/ui-server/api/steps.ts` | 99.04% | 1060 |
| `ui/src/lib/steps-model.ts` | 100.00% | 1142 |

### Unknown-review candidates

Region-level review remains necessary for `mcp/proxy.ts`, DB search/dependency/
node/file/reference/routing readers, `db/queries.ts`, `db/index.ts`, WAL
coordinator/maintenance/pressure, `graph/type-hierarchy.ts`,
`graph/queries.ts`, Context render/source helpers, `search/path-references.ts`,
sync filesystem/Git/worktree policy, `extraction/reconciliation.ts`, and
`resolution/resolution-policy.ts`. Several are architecturally Afyx-shaped but
still share material lines or structure; neither “native” nor “legacy” is safe
for the whole file yet.

### Contracts, schemas, idioms, and behavior data

Public contracts include `AfyxGraph`, CLI commands/output modes, MCP tool names
and schemas, provider config formats, and UI wire responses. Schema/protocol
regions include `db/schema.sql`, exported domain types, MCP/wire types and
ambient declarations. Standard idioms include Node HTTP/listener setup,
filesystem/path normalization, atomic file replacement, JSON/TOML parsing,
SQLite transaction scaffolding, worker startup, and Svelte/Vite wiring; these
must be reviewed in context but are not closure targets merely because lines
match. Language/framework rule tables and compatibility fixtures are
behavior-defining data and may remain contract-compatible while private control
flow is replaced.

## Operational identity and dependency remnants

A tracked-tree scan found zero CodeGraph product-name, legacy `.codegraph`,
`codegraph.db`, legacy MCP, CLI, environment, config, telemetry, waitlist,
release, or update identity hits. The generic phrase “code graph” describes the
domain and is not an upstream product remnant.

Current package, binary, state, DB, environment and MCP identities are Afyx:
`@a5zero7/afyx-graph`, `afyx-graph`, `.afyx-graph`, `afyx-graph.db`,
`AFYX_GRAPH_*`, `afyx_graph`, and `afyx_graph_*`. No runtime, build, operational,
or package dependency on CodeGraph was found. The historical snapshot is
reachable only through Git history/audit tooling.

This satisfies the operational-identity half of independence. It does not
offset retained private implementation.

## Package, distribution, license, and Git metadata

| Artifact | Classification and finding |
|---|---|
| Root `LICENSE` | `CURRENT_PROJECT_LICENSE`: MIT, Copyright Afyx |
| `afyx-graph/engine/LICENSE` | `THIRD_PARTY_ATTRIBUTION`: historical MIT notice; retained |
| `afyx-graph/THIRD_PARTY_NOTICES.md` | `THIRD_PARTY_ATTRIBUTION`: identifies incorporated historical software; shipped |
| `afyx-graph/LICENSES/THIRD_PARTY_ENGINE_MIT.txt` | `THIRD_PARTY_ATTRIBUTION`: exact notice; shipped |
| Engine `package.json` | `PACKAGE_SPECIFIC_METADATA`: Afyx package/repository/bin/license identity |
| UI `package.json` | `PACKAGE_SPECIFIC_METADATA`: private Afyx UI workspace |
| `dist/` | Build output, untracked; npm `files` includes it and bundle copies it |
| Source maps | Engine TypeScript emits `.js.map` and `.d.ts.map` into distributed `dist`; UI Vite source maps are disabled. Distribution exposure must be a deliberate later decision, not silently changed here. |
| Self-contained bundle | Official Node runtime, compiled app/viewer, production dependencies, Afyx metadata and both third-party notice files |
| Release workflows | Afyx artifact/tag/repository identity; no legacy URL found |

No nested `.git` directory exists under `afyx-graph`; only the repository-root
`.git` is present. No nested upstream remote or release metadata was found.
`afyx-graph/engine/.gitignore` is `KEEP_PACKAGE_SPECIFIC` for Node/build/state/
SQLite/test scratch. `afyx-graph/engine/afyx-graph-kernel/.gitignore` is
`KEEP_PACKAGE_SPECIFIC` for Rust target/prebuild output. Root/eval ignore files
serve different scopes; consolidation is not justified.

Technical status and attribution status are deliberately separate. No license,
notice, or third-party record was changed. Attribution review remains open even
after future technical closure and requires a complete distribution/provenance
review; this document cannot authorize removal.

## UI provenance and architecture compatibility

UI server Scope A is 98.32% substantive / 98.69% comment / 93.80% shingle
overlap; frontend Scope A is 99.75% / 99.29% / 99.03%. Renaming
`CodegraphUi.svelte` to `AfyxGraphUi.svelte` changed identity, not private
implementation provenance. HTTP APIs, wire serialization, SSE, trail storage,
security middleware, Svelte models/views, navigation, and graph visualization
therefore remain closure candidates.

Phase 3B.12A remains frozen. Closure must preserve optional UI packaging,
CLI/MCP/UI peer adapters, public-domain API consumption, loopback-only security,
single writer ownership, progressive disclosure, bounded results, modular
installation, provider ownership, and Assurance extension points. UI work may
replace presentation implementation but must not copy Search, traversal,
Resolution, or affected-test semantics into browser/server code. Functional UI
Phase 3B.12D must not resume until relevant UI private regions have passed their
independence slice.

## Installer and provider provenance

The registry implements eleven targets, including verified Codex, Claude Code,
and OpenCode adapters. Current strengths are targeted key/marker merges,
preservation of unrelated configuration, atomic writes, global/local location
handling, and read-only `detect()` implementations. Current provenance is high
(89.52% substantive Scope A) and the architecture still combines detection and
mutation in target objects.

Later Phase 4 work must preserve provider-specific compatibility and unrelated
user data; replace private historical orchestration; normalize explicit
capabilities, versions, pure plan, verification and ownership metadata; and
remove the current semantic mismatch where CLI `all` means all registered
targets rather than all `DETECTED + SUPPORTED + INTEGRATABLE`. Adapter presence
alone is not a support claim. Do not redesign this registry inside an unrelated
core closure slice.

## Test, fixture, and documentation provenance

The test audit found 324 same-path historical behavioral-oracle tests, 49 Afyx
regression/generic tests, four explicit Afyx ground-truth tests, one named
performance test, and cross-platform coverage distributed through tests and
CI. The filename classifier is conservative: benchmark scripts and prior
scratch mutation campaigns provide additional evidence outside these counts.

Historical oracle tests may remain when they protect public behavior. Afyx
ground truth has priority over historical compatibility. Extraction has 5/5
OLD mutations caught; Resolution has 7/7 current mutations caught (including
native policy and the imported-member regression); Impact has direct ground
truth and mutation evidence from its correction campaign. Search, Context,
Graph, DB/WAL, Watcher, Daemon, MCP and CLI have focused tests and deterministic
benchmarks, but future slices must inventory or add mutation coverage for the
specific private region rather than infer coverage from a neighboring test.

No product-facing CodeGraph identity appears in current tracked documentation.
README/engine notices accurately state historical authorship and are
`REQUIRED_ATTRIBUTION`; references to Prompt Master or Headroom upstream are
unrelated external-component documentation. Fixture descriptions referencing
an “upstream issue” are historical engineering context, not product identity.

## Independence scorecard

Evidence strength is qualitative and action names are the required closed set.

| Subsystem | Correctness | Native architecture | Private legacy | Perf / mutation / differential / real repo | Rewrite and UI/API risk | Action |
|---|---|---|---|---|---|---|
| Search | strong contracts | strong | small residual | benchmark-search; contracts; acceptance determinism/real repo | medium; Context/API consumers | `SMALL_CLOSURE` |
| Context | strong but ranking gap | strong | five hosts | benchmark-context; acceptance determinism/real repo; slice mutation needed | medium; token/result formatting | `SMALL_CLOSURE` |
| Graph Core | strong | mixed strong native split | substantial hosts | graph benchmarks/contracts and real repo; slice mutation needed | high downstream radius | `MEDIUM_REIMPLEMENTATION` |
| DB Read/Write | strong | mixed native split | substantial hosts | DB/query benchmarks, DB differential scenarios, real repo | very high persistence radius | `MEDIUM_REIMPLEMENTATION` |
| WAL | strong focused tests | partial | five hosts | WAL benchmark/tests; slice mutation needed | high durability risk | `SMALL_CLOSURE` |
| Impact/Affected | strong ground truth | strong | none identified | corrected ground truth, mutation/performance/real repo | low unless contract changed | `FREEZE_AS_NATIVE` |
| Watcher/Sync | strong convergence | partial | seven hosts | watcher benchmark/tests and real repo | high stale-index risk | `MEDIUM_REIMPLEMENTATION` |
| Daemon/Proxy | strong lifecycle tests | current modular shape | material | daemon benchmark/liveness tests; mutation gap | high process/platform risk | `MEDIUM_REIMPLEMENTATION` |
| MCP | strong protocol/downstream gates | partial registry/result split | large | MCP benchmark/smoke/acceptance; mutation gap | high agent/API risk | `LARGE_REIMPLEMENTATION` |
| CLI | strong command/smoke tests | public contract established | large private internals | CLI benchmark/smoke/CI; mutation gap | high public/cross-platform risk | `MEDIUM_REIMPLEMENTATION` |
| CLI presentation | focused output tests | weak independence | high but isolated | CLI benchmark/no-color/smoke | low semantic, medium output risk | `SMALL_CLOSURE` |
| Extraction | strong ground truth | limited native split | very large | OLD mutation 5/5, differential, real repo, benchmark | extreme language/routing risk | `LARGE_REIMPLEMENTATION` |
| Resolution | strong ground truth | native policy exists | very large | current mutation 7/7, OLD/NEW differential, real repo, performance | extreme semantic risk | `LARGE_REIMPLEMENTATION` |
| UI server | strong API/security tests | accepted boundary | very large | API/model/security tests; performance baseline incomplete | high contract/security risk | `LARGE_REIMPLEMENTATION` |
| UI frontend | strong model tests, visual gap | accepted adapter boundary | very large | model/package tests; browser perf/visual evidence gap | high UX, low core if boundary held | `LARGE_REIMPLEMENTATION` |
| Installer/providers | strong merge tests | direction frozen | large | installer tests; mutation/golden matrix incomplete | high user-config/platform risk | `MEDIUM_REIMPLEMENTATION` |
| Shared/facade | strong public tests | mixed | substantial | semantic/smoke/acceptance | maximum downstream contract risk | `MEDIUM_REIMPLEMENTATION` |
| Packaging helpers | strong CI/build gates | partial | four hosts | cross-platform CI/release build; mutation not relevant | medium distribution risk | `SMALL_CLOSURE` |
| Performance infrastructure | strong deterministic scripts | strong | none identified | itself supplies baselines | low | `FREEZE_AS_NATIVE` |
| Public/schema/behavior-data regions | contract-dependent | not an implementation claim | review mixed hosts | protected through consumers | high compatibility risk | `NO_ACTION_CONTRACT` |

No whole subsystem is assigned `NEEDS_MORE_EVIDENCE`, but individual unknown
regions must receive evidence before their slice edits them.

## Closure order and slice contracts

The order favors bounded regression radius and strong gates before semantic
cores. Each slice produces a separate commit/PR and stops on unexplained
behavior. Large subsystem labels never authorize a batch rewrite.

### IND-C01 — terminal presentation seam

- **Scope/ownership:** private ANSI color, glyph, shimmer progress and worker
  implementation in `src/ui/{color,glyphs,shimmer-progress,shimmer-worker}.ts`;
  Afyx-owned replacement. `src/ui/types.ts` remains a frozen contract.
- **Current contract:** identical color/no-color selection, glyph fallback,
  progress ordering, cancellation, worker teardown, stdout/stderr discipline.
- **Ground truth:** CLI no-color/version/query/context/impact tests and smoke.
- **OLD mutation:** not established; capture baseline contract before edits.
- **NEW mutation plan:** invert color eligibility, break non-Unicode fallback,
  suppress cancellation, and leak worker; each must be caught.
- **Differential/real repo:** exact exit code and observable output structure for
  help/status/query/explore/context/impact on fixture and this repository.
- **Downstream gates:** CLI focused, smoke, MCP startup isolation, Windows/
  Linux/macOS CI.
- **Performance:** interleaved `benchmark-cli`, startup plus progress-heavy
  operation, absolute/p95 latency and peak RSS.
- **Provenance target:** independent helper/module/control-flow structure; no
  unexplained identical private block of eight lines or more. Standard ANSI/
  worker idioms may remain with classification.
- **Expected files:** the four files above plus narrowly scoped tests; no domain
  source.
- **Frozen:** all semantic subsystems, CLI registry/command contract, UI
  architecture.
- **Stop:** output/ordering regression, process leak, cross-platform failure,
  material reproducible startup regression, or scope crossing into CLI/domain.

### IND-C02 — packaging and distribution helpers

- **Scope/ownership:** high-overlap bundle/copy/check helpers only; Afyx release
  pipeline. Preserve package metadata and legal artifacts.
- **Contract/evidence:** six target bundles, viewer/WASM checks, npm contents,
  launchers, CI build/smoke. OLD mutation is not applicable; add packaging fault
  tests for missing viewer/WASM/notices and wrong launcher paths.
- **Differential/real repo/downstream:** archive manifest/hash comparison and
  launch smoke on available OS CI; release workflows.
- **Performance/provenance:** build time and archive size are reported; no
  unexplained private orchestration block. Do not remove notices or change
  source-map distribution without an explicit decision.
- **Expected files:** selected `engine/scripts` and focused build tests.
- **Frozen/stop:** runtime semantics and legal records frozen; stop on artifact,
  platform, license, or reproducibility mismatch.

### IND-C03 — Search and Context residual hosts

- **Scope/ownership:** seven Search and five Context Scope C hosts, one small
  contract at a time; Afyx query/context architecture.
- **Contract/evidence:** current parsing/ranking/budgets/path/render results;
  search/context tests, benchmark scripts, acceptance deterministic queries and
  real-repository outputs.
- **Mutation plan:** query parsing/path ambiguity, stable tie order, budget,
  expansion and render truncation mutants. Historical differential remains an
  oracle; corrected Afyx behavior wins.
- **Downstream/performance:** CLI, MCP, UI thin adapter; interleaved search/
  context benchmarks including result/token size and p95.
- **Provenance/expected files:** independent private algorithms in selected
  hosts only; split contracts/data before replacing internals.
- **Frozen/stop:** Graph/DB and known ranking backlog are frozen; stop on
  unexplained ordering/result/token delta or material latency regression.

### IND-C04 — DB and WAL residual hosts

- **Scope/ownership:** remaining DB readers/queries/index/adapter and WAL hosts;
  Afyx persistence architecture.
- **Contract/evidence:** schema, transaction atomicity, row mapping, WAL healing,
  incremental/fresh convergence; DB contract scenarios, WAL tests and benchmarks.
- **Mutation plan:** one read predicate/order, transaction rollback, deletion,
  checkpoint/pressure and recovery mutant per edited policy.
- **Differential/real repo:** byte-normalized semantic DB dump and full real
  index/reopen/sync; exact result digest, counts and state.
- **Downstream/performance:** Graph, Search, Context, Impact, daemon, MCP, CLI,
  UI; interleaved DB/query/WAL/index/sync with RSS, DB/WAL size and work counts.
- **Provenance/expected files:** select one cohesive reader or WAL policy group;
  schema remains `SCHEMA_OR_PROTOCOL`.
- **Frozen/stop:** schema/public API unless separately approved; stop on data
  loss, unexplained digest/order difference, lock/durability failure or material
  regression.

### IND-C05 — Graph legacy hosts

- **Scope/ownership:** branch guards, dead code, named flow, type hierarchy and
  remaining traversal hosts; use native graph store/frontier/relations seams.
- **Evidence:** graph contracts/benchmarks, semantic baseline, Impact/Context/
  MCP/CLI/UI downstream gates and real repository.
- **Mutation/differential:** traversal direction/depth/order/cycle/guard mutants;
  historical and fresh-index semantic digests.
- **Performance/provenance:** interleaved graph/high-fanout workloads with
  visited counts; replace selected private architecture, not behavior data.
- **Expected files/frozen:** one graph feature family per PR; DB, Resolution and
  public facade frozen.
- **Stop:** unexplained reachability/order delta, fanout blow-up or UI contract
  break.

### IND-C06 — Watcher, daemon and proxy lifecycle

- **Scope/ownership:** residual sync/watch and daemon/proxy lifecycle hosts;
  Afyx single-writer architecture.
- **Evidence:** convergence, watcher, writer-lock, liveness, socket fallback,
  daemon/proxy tests and benchmarks on all OS CI.
- **Mutation/differential:** coalescing/retry/drop event, dead-client, idle timer,
  lock ownership and socket cleanup mutants; controlled filesystem/process
  traces.
- **Performance:** event bursts, attach/cold start, p95, RSS and handles.
- **Expected files:** one watcher-policy or lifecycle seam per slice.
- **Frozen/stop:** DB semantics, MCP protocol and single writer; stop on stale
  index, competing writer, orphan/leak or platform-only failure.

### IND-C07 — MCP and CLI adapter internals

- **Scope/ownership:** split private implementation from frozen tool/command/
  wire contracts; use public `AfyxGraph` APIs and existing native registry/result
  seams.
- **Evidence:** CLI/MCP focused tests, semantic/smoke, acceptance, controlled
  payload and latency baselines.
- **Mutation/differential:** dispatch, validation, error/result mapping,
  availability and truncation mutants; JSON/MCP semantic comparison.
- **Performance:** startup, initialize, tools/list, first and repeated calls,
  payload bytes and RSS.
- **Expected files:** begin with one bounded MCP tool family or CLI command
  group; never rewrite `tools.ts` and CLI monolith together.
- **Frozen/stop:** public names/schema/output, domain semantics and UI peer
  boundary; stop on agent compatibility or startup/payload regression.

### IND-C08 — Extraction closure

- **Scope/ownership:** parser dispatch/control flow and language hosts after
  behavior tables/contracts are explicitly separated; Afyx extraction design.
- **Evidence:** extraction ground truth, 5/5 OLD mutations, kernel/JS parity,
  incremental/fresh differential and real repository.
- **Mutation plan:** retain existing mutations and add language-specific mutants
  only for touched logic.
- **Performance:** interleaved parse/index/sync, semantic digest, per-language
  result counts, visited/work, RSS and p95.
- **Expected files:** one language family or parser seam per PR; never global
  parser batch replacement.
- **Frozen/stop:** corrected facts, language behavior data, Resolution/DB; stop
  on unexplained fact delta, parity failure, language regression or material
  throughput loss.

### IND-C09 — Resolution closure

- **Scope/ownership:** import/name/framework/synthesizer hosts one strategy at a
  time, using the native deterministic policy seam.
- **Evidence:** 13/13 ground truth, current 7/7 mutations, prior OLD mutations,
  R0–R9 convergence, synthetic/real differential with `UNEXPLAINED=0` and
  interleaved performance.
- **Mutation plan:** retain existing seven; add strategy-specific candidate,
  ambiguity, cleanup and scope mutants.
- **Downstream/performance:** Graph, Search, Context, Impact, MCP, CLI and UI;
  ambiguity/import/unresolved/realistic scenarios with digest, counts, RSS/p95.
- **Expected files:** one resolver strategy/host boundary per PR.
- **Frozen/stop:** Afyx-corrected ground truth outranks historical behavior; stop
  on unexplained edge/unresolved/order delta or material regression.

### IND-C10 — provider/installer closure

- **Scope/ownership:** introduce side-effect-free detection/capability/plan/
  verify seams, then replace private orchestration per provider.
- **Evidence:** installer target tests plus golden configs for Codex, Claude and
  OpenCode across global/local locations and OS path rules.
- **Mutation plan:** detection writes, unrelated-key loss, wrong location,
  non-atomic apply, ownership over-delete and `All detected` selection mutants.
- **Differential/real repo:** temporary configs only; byte preservation outside
  Afyx-owned keys; no user production config.
- **Performance:** bounded detection only; correctness dominates latency.
- **Expected files:** shared types/plan plus one provider adapter per PR.
- **Frozen/stop:** Phase 3B.12A ownership/modular model; stop on side effects in
  detect/plan or unrelated configuration mutation.

### IND-C11 — UI server and frontend closure

- **Scope/ownership:** loopback transport/security/wire/SSE/trails followed by
  browser adapter/models/views in bounded vertical slices; Afyx optional UI.
- **Evidence:** UI server/API/security/package/model tests; add browser visual/
  interaction ground truth and mutation evidence before each view replacement.
- **Differential/real repo:** normalized wire contracts and deterministic view
  models against fixture and real repository; presentation changes must be
  intentional, not silently normalized.
- **Performance:** server startup, local HTTP, browser render, bundle size, RSS,
  visible elements and pagination p95.
- **Provenance target:** independent UI architecture/implementation with public
  domain APIs; public wire/schema/standard Svelte idioms classified separately.
- **Expected files:** one vertical surface at a time, starting with status shell
  only after common server/adapter seams are independent.
- **Frozen/stop:** every Phase 3B.12A invariant; stop if core semantics enter UI,
  remote exposure appears, writer ownership changes, or bounded transfer breaks.

## Validation rules for every implementation slice

Correctness priority is ground truth, then corrected Afyx semantics, then
historical compatibility. Every OLD/NEW difference is classified and
`UNEXPLAINED` must equal zero. Same frozen input/index/configuration must produce
the same observable result and order when order is public.

Performance runs are OLD/NEW interleaved and record semantic digest, absolute
latency, percentage delta, result/work counts, memory where meaningful and p95
for stable workloads. A large microbenchmark percentage with negligible
absolute cost is reported as such, while real-repository cost remains required.
A material reproducible regression without correctness justification blocks.

Each slice begins with a clean baseline, captures ground truth, tests the OLD
implementation, implements a small Afyx-native seam, runs focused tests and
mutations, compares differential and real-repository results, runs the relevant
benchmark, then runs downstream semantic/smoke/platform gates. It commits only
after source-scope and provenance review. No slice removes legal notices.

## Final technical-independence gate

Phase 3B.12C closure is complete only when every box is evidenced:

- [x] runtime upstream dependency = 0
- [x] build upstream dependency = 0
- [x] operational upstream dependency = 0
- [x] product-facing upstream identity = 0
- [x] legacy CLI/env/config identity = 0
- [x] upstream telemetry/update/release URLs = 0
- [ ] retained private upstream implementation = 0
- [ ] unexplained substantial overlap = 0
- [x] Afyx-owned ground truth exists (coverage must expand per slice)
- [x] Afyx-owned mutation/eval evidence exists (coverage must expand per slice)
- [ ] every closure slice has parity or better performance, except documented
  correctness work
- [x] current cross-platform baseline is healthy
- [ ] accepted core correctness is re-proven after all closure slices
- [ ] Phase 3B.12A UI architecture is re-proven after UI/installer closure

Current `TECHNICAL_INDEPENDENCE_STATUS` is
`OPERATIONALLY_INDEPENDENT_BUT_IMPLEMENTATION_CLOSURE_REQUIRED`.
Current `ATTRIBUTION_REVIEW_STATUS` is `OPEN_RETAIN_ALL_NOTICES`.

The exact next task is **IND-C01 only**: reimplement the four private terminal
presentation modules behind the frozen `src/ui/types.ts` contract, add the four
specified mutation classes, run exact CLI differential plus real-repository
smoke and interleaved CLI performance, require cross-platform CI, and stop
without touching domain semantics, legal files, packaging, MCP, or browser UI.
