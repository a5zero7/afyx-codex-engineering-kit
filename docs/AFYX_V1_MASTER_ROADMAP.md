# Afyx v1 Master Roadmap

Status: **Phase 5 active**  
Canonical since: **2026-10-03**  
Contract revision: **2026-10-04**  
v1 scope policy: **FROZEN — Phase 1 through Phase 11**  
Post-v1 policy: **PLANNED EXPANSION — not a v1 release blocker**

Current work: **Phase 5F — Third-Party Source / Runtime Replacement**  
Task: `AFYX-91852`  
Canonical merged main baseline: `ebe34a2b3781c664713a362714ccb92bba2bc8e6`  
Active implementation branch: `afyx/native-phase5f-parser-grammar`  
Latest verified parser checkpoint at this revision: `d9039bf784c33bb494fbc24c5eaa72a97b43c61e`  
Last merged Phase 5F major checkpoint: **PR #57 — Utility Runtime + UI Runtime**  
Phase 5E merge baseline: `48b6078ed37349e405213258819fa5225bcdb3fb`

This document is the forward-looking execution contract for Afyx Code
Engineering Kit. Historical closure evidence remains in
`AFYX_INDEPENDENCE_PLAN.md`; it is evidence, not authority for creating new
micro-phases after C07.11.

## Product direction

Afyx is a local-first **Engineering Intelligence & Assurance Platform** for
developers and AI coding agents.

Core objective:

> **Maximum engineering outcome with minimum agent effort.**

Afyx Graph objective:

> **Provide the smallest sufficient engineering context required to produce the
> highest-confidence correct result.**

Long-term product evolution:

```text
Code understanding
  -> repository understanding
  -> engineering-system understanding
```

The product is not defined by parser count, tool count, or test count. It is
defined by correctness, useful engineering context, bounded cost, reliable
automation, maintainable ownership, and evidence-backed claims.

## Canonical development method

All remaining independence work follows this sequence:

1. Understand observable behavior.
2. Specify the smallest required Afyx contract.
3. Analyze redundancy, coupling, complexity, context cost, memory cost, and tool-call cost.
4. Design the Afyx-native implementation.
5. Reimplement independently.
6. Modify and optimize for the actual Afyx requirement.
7. Replace the superseded implementation.
8. Perform minimum sufficient validation for the risk.
9. Erase historical residue in the touched scope.
10. Perform one final global audit at the appropriate roadmap boundary.

Canonical rule:

> **Behavior reference, not source template.**

Testing is a verification guardrail, not the objective of the task. Stronger
differential, mutation, performance, or provenance evidence is reserved for
genuinely high-risk boundaries such as parsing, extraction, resolution,
security, concurrency, persistence, data-loss risk, and release integrity.

# Roadmap

## Phase 1 — Engineering Kit Foundation

Status: **COMPLETE**

Contract items:

- Windows installer.
- Linux/macOS installer.
- updater.
- verifier.
- uninstaller.
- safe staging.
- backup / swap / rollback.
- component inventory.
- non-destructive user configuration.

Outcome:

> Stable lifecycle foundation for Afyx Engineering Kit.

## Phase 2 — Engineering Skills & Local Workflow

Status: **CORE COMPLETE**

Contract items:

- Efficient Coding.
- Odoo Engineering 10–20.
- Prompt Master — **EXTERNAL**.
- Headroom — **EXTERNAL**.
- project detection.
- Afyx Doctor.
- Codex Usage Tracking.

Outcome:

> Daily local engineering workflow remains usable independently of Afyx Graph.

## Phase 3 — Evaluation & Evidence Foundation

Status: **FOUNDATION COMPLETE**

Contract items:

- evaluation harness.
- semantic fixtures.
- correctness gates.
- smoke tests.
- benchmark methodology.
- token / tool / time accounting.
- engineering evidence discipline.

Principle:

> Testing is a guardrail, not the development goal.

## Phase 4 — Afyx Graph Functional Core

Status: **FUNCTIONALLY COMPLETE**

Functional contract:

- Search.
- Context.
- Graph.
- DB / WAL.
- Impact / Affected.
- Watcher.
- Daemon.
- MCP.
- CLI.
- Extraction.
- Resolution.
- Provider / Installer foundation.
- UI foundation.

Historical functional lineage retained for traceability:

- 3B.1 — Search.
- 3B.2 — Context.
- 3B.3 — Graph Core.
- 3B.4 — Persistence / DB / WAL.
- 3B.5 — Impact.
- 3B.6 — Sync / Watcher.
- 3B.7 — Daemon / Proxy.
- 3B.8 — MCP.
- 3B.9 — CLI.
- 3B.10 — Extraction.
- 3B.11 — Resolution.
- 3B.12 — UI.
- Rust/kernel-related functional work.

Important:

> Functional completeness does not imply native independence.

## Phase 5 — Afyx Native Full Independence

Status: **ACTIVE**

Goal:

> Replace transitional/historical implementation ownership with Afyx-native
> ownership while preserving product behavior, correctness, supported language
> coverage, and release safety.

### Phase 5A — Behavior Harvest & Contract Knowledge

Status: **FROZEN KNOWLEDGE**

Contract items:

- historical C07.1 through C07.11 behavior evidence.
- Search behavior.
- Files behavior.
- Relationships behavior.
- Impact behavior.
- Node behavior.
- Status behavior.
- Explore behavior.
- C07.12 Session work was **NEVER STARTED** and was superseded by Phase 5B.

Principle:

> Behavior reference, not source template.

### Phase 5B — Native MCP / CLI Runtime Reimplementation

Status: **COMPLETE / MERGED / FROZEN**

Pull request: **#53**  
Canonical merge: `3c5da1c148756ea47ecc31691f886307c6d38641`

Implemented contract:

- `AfyxSessionContext`.
- MCP session ownership.
- transport boundary.
- engine / project selection.
- worker / QueryPool boundary.
- CLI runtime.
- Afyx-native request/session ownership.
- bounded per-connection context ownership.
- direct/worker/proxy behavior convergence.

Completion meaning:

> Session, transport, CLI-host, worker, and request ownership are Afyx-owned.
> This does not claim final repository independence.

### Phase 5C — Native Domain Core Reimplementation

Status: **COMPLETE / MERGED / FROZEN**

Pull request: **#54**  
Canonical merge: `ab991951e8a4874088032e24a0ff14609d48f551`

Implemented contract:

- `ExtractionAdmission`.
- `ResolutionAdmission`.
- persistence ownership.
- resolution edge ownership.
- recovery / cleanup semantics.
- explicit Afyx domain admission boundaries.

Completion meaning:

> Core extraction/resolution ownership boundaries are Afyx-native without
> changing established graph semantics.

### Phase 5D — Native Product Surfaces

Status: **COMPLETE / MERGED / FROZEN**

Pull request: **#55**  
Canonical merge: `f683b0225ee8e805fcd7b9ea98bea88574cf61f4`

Implemented contract:

- provider surface.
- installer surface.
- inspect -> plan -> apply -> verify lifecycle.
- release packaging foundation.
- UI product boundary.
- product-owned artifact planning.

Completion meaning:

> Product-facing installation/provider/release surfaces have explicit Afyx
> ownership.

### Phase 5E — Native Optimization & Simplification

Status: **COMPLETE / MERGED / FROZEN**

Pull request: **#56**  
Canonical merge: `48b6078ed37349e405213258819fa5225bcdb3fb`

Implemented contract:

- context observability.
- bounded context.
- benchmark lifecycle.
- simplification of unnecessary abstractions.
- no speculative optimization retained without evidence.
- efficiency work preserves correctness as the primary gate.

Completion meaning:

> The native core has an evidence-based efficiency and simplification baseline.

### Phase 5F — Third-Party Source / Runtime Replacement

Status: **ACTIVE**

Task: `AFYX-91852`

#### 5F.1 — Inventory / Before-State

Status: **COMPLETE**

Checkpoint:

`bef1643f21d76182776a9528e4f3ab262785a737`

Contract items:

- classify shipped runtime.
- classify shipped libraries.
- classify shipped source.
- classify shipped assets.
- classify build-only and test-only dependencies.
- record parser/grammar ownership.
- record native-kernel ownership.
- record release artifact composition.
- preserve historical legal evidence until technical removal is proven.

#### 5F.2 — Utility Runtime Replacement

Status: **MERGED / FROZEN**

Implemented items:

- Afyx CLI parser.
- Afyx terminal runtime.
- Afyx ignore matcher.
- Afyx path/glob matcher.
- Afyx JSONC reader/editor.

Result:

- direct product dependencies reduced from 10 to the 2 parser dependencies.
- removed utility packages have no replacement package.
- behavior/scope parity evidence retained.

#### 5F.3 — UI Runtime Replacement

Status: **MERGED / FROZEN**

Merged in PR **#57**.  
Canonical merge: `ebe34a2b3781c664713a362714ccb92bba2bc8e6`

Implemented items:

- Svelte product runtime removed.
- XYFlow product runtime removed.
- D3 UI closure removed with the graph UI stack.
- third-party font packages/assets removed.
- Afyx-owned DOM / SVG / CSS runtime.
- existing typed adapter/wire/model boundaries preserved.

Result:

- UI production dependencies = 0.
- active Svelte source = 0.
- shipped viewer reduced to native product assets.

#### 5F.4 — Parser / Grammar Replacement

Status: **ACTIVE NOW**

Current branch:

`afyx/native-phase5f-parser-grammar`

Latest verified checkpoint at this contract revision:

`d9039bf784c33bb494fbc24c5eaa72a97b43c61e`

Native foundation complete:

- dependency-free bounded native scanner.
- UTF-16 source-position contract.
- strings/comments treated as opaque.
- bounded delimiter handling.
- malformed/incomplete source safety.
- no fake historical AST compatibility layer.

Native-complete fact/syntax routes at this checkpoint:

- TypeScript.
- TSX.
- JavaScript.
- JSX.
- Python.
- Go.
- Java.

Native cross-cutting coverage at this checkpoint:

- syntax tokens for all seven native routes.
- function references for all seven native routes.
- branch guards for TypeScript / TSX / JavaScript / JSX.
- branch guards for Python / Java / Go.

Current evidence:

- focused branch-guard suite: **68/68 PASS**.
- OLD/NEW branch-guard differential: **7/7 PASS**.
- native cross-cutting gate: **139/139 PASS**.
- TypeScript typecheck: PASS.
- clean production/UI build: PASS.
- CLI/MCP smoke: **21 checks PASS**.
- normal semantic fixtures: **6 PASS**.
- native extraction: functional assertions PASS.
- four reported Windows extraction failures remain the established
  temporary-directory cleanup-only `EPERM` class.
- native-gated semantic structure remains equivalent; two floating search-score
  values differ slightly and remain tracked as a checkpoint limitation.

Pending native semantic routes:

- ArkTS.
- Rust.
- Kotlin.
- Scala.
- C.
- C++.
- Objective-C.
- C#.
- Solidity.
- PHP.
- Ruby.
- Swift.
- Dart.
- Lua.
- Luau.
- R.
- Nix.
- Pascal.
- CFML.
- CFScript.
- CFQuery.
- COBOL.
- VB.NET.
- Erlang.
- Terraform / OpenTofu where parser-backed semantics are required.
- parser-coupled SFC/template/special-format internals.

Pending cross-cutting migration:

- remaining branch-guard language routes.
- remaining syntax-token consumers.
- remaining function-reference consumers.
- embedded language/source-offset routes.
- special format parser coupling.

Final parser closure items:

- remove parser bootstrap/cache where obsolete.
- remove `web-tree-sitter`.
- remove `tree-sitter-wasms`.
- remove tracked parser grammar WASM.
- remove shipped parser grammar/runtime WASM.
- reduce engine production parser dependency closure to zero.
- validate fresh/incremental convergence.
- validate deterministic graph semantics.
- perform representative real-repository comparison.
- perform controlled parser artifact audit.
- run exact-head supported-platform CI.
- create one major parser checkpoint PR only after the full parser boundary is complete.

Parser principle:

> Preserve graph meaning, not parser implementation.

No supported language may be silently dropped to simplify independence.

#### 5F.5 — Native Kernel Closure

Status: **PENDING**

Contract items:

- classify remaining kernel product value after native parser completion.
- remove the optional kernel if it no longer provides justified product value,
  or independently reimplement the required product behavior.
- remove third-party native crates from the shipped product boundary.
- remove vendored/generated grammar source.
- remove optional third-party kernel runtime ownership.
- retain legal evidence until the underlying material and obligation are
  legitimately gone.

Exit:

> Shipped Afyx product has no third-party native-kernel ownership.

#### 5F.6 — Runtime / Distribution Closure

Status: **PENDING**

Contract items:

- bundled Node runtime -> 0.
- shipped `node_modules` -> 0.
- no substitute bundled general-purpose runtime merely to move the dependency.
- define the final external runtime contract if an external platform runtime is
  required.
- launcher/runtime detection.
- clear minimum-version policy.
- supported-platform validation.
- final release artifact composition.

Exit:

> Afyx release artifact contains no bundled general-purpose third-party runtime
> or dependency tree under the agreed strict product boundary.

#### 5F.7 — Final Phase 5F Artifact Audit

Status: **PENDING**

Required gates:

- product runtime dependency tree under strict scope: zero unwanted third-party runtime dependencies.
- bundled Node: zero.
- shipped `node_modules`: zero.
- tracked/shipped third-party parser grammar WASM: zero.
- third-party parser runtime: zero.
- vendored third-party grammar source: zero.
- shipped third-party UI runtime/assets: zero.
- shipped third-party native kernel: zero.
- new third-party product dependencies: zero.
- language semantic contract: PASS.
- core regression: PASS.
- release artifact audit: PASS.
- supported-platform CI: PASS.

Historical legal evidence may still remain until Phase 5H.

### Phase 5G — Legacy Product Identity / Historical Artifact Eradication

Status: **PENDING**

Contract items:

- historical product identity in active product surfaces = 0.
- historical naming in active architecture/config/runtime = 0.
- old config/env/path ownership = 0.
- historical implementation residue = 0.
- obsolete compatibility residue removed unless explicitly justified.
- historical evidence documents remain truthful and are not rewritten to erase
  provenance.

Exit:

> Active Afyx product and architecture no longer depend on or present the
> historical product identity.

### Phase 5H — Historical License Closure

Status: **PENDING**

Contract items:

- historical attribution review.
- third-party notice review.
- grammar/license evidence review.
- release notice payload review.
- verify that material requiring retained attribution has actually been removed
  before deleting any notice.
- keep Prompt Master and Headroom explicit as separately managed external
  exceptions.

Exit:

> Release legal/attribution state matches the actual final technical artifact.

### Phase 5I — Final Independence Audit

Status: **PENDING**

Required audits:

- native implementation audit.
- legacy identity/artifact eradication audit.
- zero-unwanted-third-party-license audit under the agreed strict product scope.
- release artifact audit.
- functional regression audit.
- supported-platform build audit.

Minimum final assertions:

- historical runtime dependency = 0.
- historical build dependency = 0.
- historical operational dependency = 0.
- historical implementation retained = 0.
- historical active product identity = 0.
- unexplained historical artifact = 0.
- unwanted third-party bundled source = 0.
- unwanted third-party bundled assets = 0.
- unwanted third-party bundled runtime = 0.
- unwanted third-party attribution requirement = 0.
- unwanted third-party release notice payload = 0.

Exit:

> **AFYX_FULLY_INDEPENDENT = TRUE**

No earlier Phase 5 subphase may make this final claim.

## Phase 6 — Unified Kit & Provider Control Plane

Status: **PLANNED**

Contract items:

- immutable component plan.
- desired state vs actual state.
- provider / agent adapter registry.
- Minimal / Recommended / Full / Custom presets.
- drift detection.
- repair.
- ownership classification: AFYX / EXTERNAL / USER.
- installer / update / verify convergence.
- provider capability representation.

v1 provider policy:

> Codex remains the primary provider target for v1.

Exit:

> Afyx can reason consistently about desired installation/runtime state and
> repair drift without destructive user-config ownership.

## Phase 7 — Engineering Assurance

Status: **PLANNED**

Contract items:

- Task Contract.
- Baseline Guard.
- Scope Guard.
- Ground Truth.
- risk-based regression selection.
- Mutation Proof when justified.
- Differential Proof when justified.
- Performance Gate.
- CI Evidence.
- Documentation Evidence.
- Merge Readiness.

Canonical assurance state:

```text
PLANNED
  -> ANALYZED
  -> IMPLEMENTED
  -> VALIDATED
  -> DOCUMENTED
  -> MERGE_READY
```

Exit:

> Engineering completion is evidence-based rather than inferred from code
> modification alone.

## Phase 8 — Real-World Dogfood & Comparative Proof

Status: **PLANNED**

Contract items:

- real Odoo work.
- real engineering repositories.
- correctness measurement.
- context usefulness.
- tool-call count.
- latency.
- context/token volume.
- repeatable controlled tasks.
- same task/model/repository conditions where comparison is claimed.

Comparative campaign:

- CONTROL — no structural graph tool.
- BASELINE — frozen historical structural-graph implementation.
- TREATMENT — Afyx Graph.

Principle:

> Correctness > token reduction.

Claims policy:

> Do not claim measured superiority until this controlled campaign produces the
> evidence.

Exit:

> Afyx has real-world proof of where Graph helps, where it does not, and how much
> cost/correctness difference is actually measured.

## Phase 9 — Product Hardening & Release Engineering

Status: **PLANNED**

Contract items:

- crash recovery.
- corrupt/incomplete state recovery.
- disk-full handling.
- stale lock cleanup.
- daemon recovery.
- interrupted installer recovery.
- interrupted update recovery.
- rollback.
- checksum/signature policy.
- safe package validation.
- Windows validation.
- Linux validation.
- macOS validation.
- upgrade compatibility.
- failure diagnostics.
- release artifact smoke validation.

Exit:

> Afyx fails safely and predictably under realistic operational failure modes.

## Phase 10 — Afyx v0.1 / Private Beta

Status: **PLANNED**

Contract items:

- controlled private users.
- installer/runtime feedback.
- workflow ergonomics.
- diagnostics feedback.
- configuration stabilization.
- upgrade-contract stabilization.
- release-blocking defect triage.
- real-environment compatibility feedback.

Exit:

> Private beta has produced sufficient evidence to freeze the stable v1
> behavioral and upgrade contract.

## Phase 11 — Stable Afyx v1.0

Status: **TARGET**

Required gates:

- `AFYX_FULLY_INDEPENDENT = TRUE`.
- stable installer / update / uninstall.
- stable Afyx Graph runtime.
- stable Codex integration.
- stable project-state / migration policy.
- stable MCP contract.
- stable CLI contract.
- usable diagnostics and recovery path.
- representative dogfood PASS.
- supported-platform CI PASS.
- packaged artifact smoke PASS.
- known limitations documented.
- no critical correctness/security issue open.

Release:

> **Afyx Code Engineering Kit v1.0.0 — Stable**

Do not publish stable v1 merely because development package metadata already
contains `1.0.0`.

# Final independence contract

Phase 5 may be classified complete only when every Phase 5I gate passes.

Prompt Master and Headroom are the only explicitly allowed final external
exceptions in this contract and remain separately managed. They must never be
silently reclassified as Afyx-owned source.

Phase 5F performs technical replacement. Phase 5H performs attribution/license
closure. Legal notices may be removed only after the underlying code, assets,
runtime, and obligations are legitimately gone.

# V1 release contract

Phase 11 is reached only after:

1. Phase 5 independence is complete.
2. Phase 6 lifecycle/control-plane behavior is stable.
3. Phase 7 assurance is usable.
4. Phase 8 real-world dogfood/comparative evidence is sufficient for public
   product claims.
5. Phase 9 hardening passes supported-platform release gates.
6. Phase 10 private beta produces no unresolved release-blocking defect.
7. no critical correctness/security issue remains open.

Version path:

```text
internal development
  -> 0.x alpha/internal bundle
  -> v0.1 Private Beta
  -> 0.x stabilization / release candidate
  -> v1.0.0 Stable
```

# Post-v1 expansion program

Status: **PLANNED — NOT A V1 RELEASE BLOCKER**

The post-v1 program is part of the long-term Afyx development contract, but it
does not reopen the frozen v1 feature scope.

Post-v1 work is organized into two parallel tracks so provider generalization
does not block intelligence expansion, and intelligence expansion does not wait
for every provider integration.

## Track A — Platform Generalization & Provider Expansion

Contract items:

- provider-neutral core contracts.
- stable `ProviderAdapter` contract.
- provider/agent capability discovery.
- provider feature negotiation.
- provider-neutral task/context contract.
- provider-neutral evidence contract.
- additional coding-agent integrations based on measured demand.
- preserve Codex integration while generalizing the core.

Goal:

> Generalize the stable v1 architecture without allowing provider-specific
> behavior to leak into Afyx core ownership.

## Track B — Engineering Intelligence Expansion

### B1 — Repository & Runtime Intelligence

Planned support:

- Shell:
  - `.sh`
  - `.bash`
  - `.zsh`
- PowerShell:
  - `.ps1`
  - `.psm1`
  - `.psd1`
- Build systems:
  - `Makefile`
  - `*.mk`
  - `CMakeLists.txt`
  - `*.cmake`
- Runtime/deployment:
  - `Dockerfile`
  - Docker Compose
- Project manifests:
  - generic JSON / JSONC.
  - TOML.

Target relationships:

- script -> invoked command.
- build target -> source/output.
- manifest -> dependency/workspace/entrypoint.
- container -> copied artifact/entrypoint/service.
- runtime -> project component.

### B2 — Data & Infrastructure Intelligence

Planned support:

- SQL:
  - PostgreSQL — **HIGH PRIORITY**.
  - MySQL / MariaDB.
  - SQLite.
  - SQL Server / T-SQL.
  - Oracle / PL-SQL later.
- CI/CD:
  - GitHub Actions.
  - additional pipeline formats based on demand.
- Infrastructure:
  - Kubernetes.
  - Ansible.
  - Terraform/OpenTofu semantic enrichment.
  - Docker Compose semantic enrichment.
- environment/config relationships.

Target relationships:

- code -> query.
- query -> table/view/function/procedure.
- schema -> migration.
- service -> container.
- deployment -> config/secret/environment.
- infrastructure resource -> runtime component.

### B3 — API & Schema Intelligence

Planned support:

- GraphQL:
  - `.graphql`
  - `.gql`
- Protocol Buffers:
  - `.proto`
- OpenAPI:
  - YAML representation.
  - JSON representation.
- AsyncAPI later.
- database/schema relationships.

Target relationships:

- API declaration -> route/RPC/query.
- route/RPC/query -> implementation.
- implementation -> service.
- service -> persistence/schema.

### B4 — Deep Framework Intelligence

Priority candidate:

#### Odoo intelligence

Planned semantic relationships:

- Python model.
- `_inherit`.
- fields.
- compute.
- `@api.depends`.
- onchange.
- XML views.
- buttons.
- actions.
- menus.
- `ir.model.access.csv`.
- record rules.
- cross-module relationships.

Other planned framework families:

- Django.
- FastAPI.
- Flask.
- Spring.
- Laravel.
- Rails.
- React.
- Next.js.
- Vue / Nuxt.
- SvelteKit.
- Flutter.
- .NET / ASP.NET.
- Android.

Goal:

> Move from language-level symbol understanding to framework-level engineering
> relationships.

### B5 — Programming Language Expansion

Planned candidates:

- Groovy — **HIGH ROI** because of Gradle/Jenkins ecosystems.
- Elixir.
- Zig.
- F#.
- Clojure.
- Haskell.
- OCaml.
- Julia.
- Perl.
- additional languages chosen by measured demand.

Prioritization formula:

```text
user demand
  x ecosystem value
  x repository prevalence
  / implementation complexity
```

Policy:

> Do not optimize for language-count marketing. Deep repository, build,
> runtime, database, API/schema, and framework understanding has higher product
> value than adding low-demand parser breadth.

# Long-term intelligence target

The desired post-v1 graph combines:

- language graph.
- framework graph.
- configuration graph.
- database graph.
- API/schema graph.
- build graph.
- deployment/infrastructure graph.

Target:

```text
Language facts
  + framework semantics
  + config relationships
  + database relationships
  + API/schema relationships
  + build relationships
  + deployment/infrastructure relationships
  = Engineering Knowledge Graph
```

Example target for Odoo:

```text
Python model
  -> XML view
  -> button/action
  -> security
  -> related model
  -> database/migration
  -> deployment/runtime context
```

Afyx should understand how the engineering system fits together, not merely
recognize more file extensions.

# Contract governance

## V1 frozen-scope rule

Phase 1 through Phase 11 are frozen as the v1 contract.

A new idea may enter Phase 1–11 only when all are true:

1. it is required to satisfy an already-defined v1 exit gate;
2. excluding it would make an existing v1 claim false or unsafe;
3. it is not merely desirable product expansion;
4. scope and validation impact are explicitly documented.

Otherwise it belongs to the post-v1 expansion program.

## Post-v1 rule

Track A and Track B may progress independently after v1 and are prioritized by
measured product value rather than numbering alone.

## Progress rule

A merge is not sufficient evidence of roadmap completion.

Every substantial task must report:

- roadmap phase/sub-boundary.
- baseline SHA.
- branch.
- implementation scope.
- what became genuinely Afyx-native.
- what remains transitional.
- historical implementation removed.
- third-party dependency/license state.
- validation performed.
- regressions/limitations.
- final PR/head when applicable.
- exact next roadmap step.

## Independence vocabulary

Allowed state vocabulary:

- `OPERATIONALLY_AFYX`.
- `IMPLEMENTATION_TRANSITIONAL`.
- `NATIVE_BUT_ARTIFACT_CLEANUP_PENDING`.
- `LICENSE_CLOSURE_PENDING`.
- `AFYX_FULLY_INDEPENDENT`.

Only Phase 5I may authorize:

`AFYX_FULLY_INDEPENDENT`.

# Final definition of success

The v1 contract is satisfied only when:

- Afyx implementation is native under the agreed product scope.
- historical implementation retained = 0.
- historical active product identity = 0.
- unwanted third-party product source/assets = 0.
- unwanted third-party bundled runtime = 0.
- unwanted third-party attribution obligation = 0.
- Prompt Master remains external.
- Headroom remains external.
- Codex integration is stable.
- engineering workflow is stable.
- Afyx Graph is usable and hardened.
- Engineering Assurance is usable.
- comparative proof is evidence-based.
- private beta is complete.
- stable release gates pass.

Then, and only then:

> **Afyx Code Engineering Kit v1.0.0 — Stable**

After v1, expansion follows Track A / Track B without reopening the v1 feature
contract unless maintenance of an existing v1 guarantee requires it.
