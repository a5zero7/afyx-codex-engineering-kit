# Afyx v1 Master Roadmap

Status: **Phase 5 active**  
Canonical since: **2026-10-03**  
Contract revision: **2026-10-08**  
v1 scope policy: **FROZEN — Phase 1 through Phase 11**  
Post-v1 policy: **PLANNED EXPANSION — not a v1 release blocker**

Current work: **Phase 5F — Third-Party Source / Runtime Replacement**  
Task: `AFYX-91852`  
Canonical merged main baseline: `5349c4a184e539f0ac0752d895ff3262c6326e29`  
Active implementation branch: `afyx/native-phase5f-parser-grammar`  
Latest verified Phase 5F implementation checkpoint: `3e6b624505680e264af3b5f681be0f806a84648d`  
Latest verified Phase 5F contract-decision checkpoint: `3425348dcf4079bb35385a31a98ce54286ec9f0b`  
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

### V1 optimization contract

Afyx v1 optimizes for **quality-adjusted resource efficiency**, not for the
smallest raw token count.

Canonical rule:

> **Use no less context, reasoning, tooling, or validation than required for the
> target quality, and no more than produces useful evidence.**

Therefore:

- correctness and precision are hard gates;
- token efficiency means eliminating irrelevant context, repeated discovery,
  duplicate reads, redundant tool calls, and redundant validation;
- Afyx must not starve an agent of context merely to reduce token usage;
- Afyx Graph should reduce the search space toward the **minimum sufficient
  engineering context**, especially for large repositories and workspaces;
- validation scope is proportional to the real impact/risk of a change;
- evidence that remains valid is reused rather than recomputed;
- after correctness is established, prefer the most direct, efficient, and
  performant Afyx-native implementation supported by measurement;
- v1 requires no arbitrary percentage claim against the historical baseline;
  comparative superiority claims require measured evidence.

The intended engineering loop is:

```text
task
  -> relevant graph / impact cone
  -> minimum sufficient context
  -> sufficient reasoning / tools
  -> scoped implementation
  -> minimum sufficient validation
  -> closure evidence
```

Optimization is successful only when resource waste decreases **without reducing
required output quality**.

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

Status: **ACTIVE — NATIVE ROUTES COMPLETE; V1 CONTRACT DECISION / ERADICATION PENDING**

Current branch:

`afyx/native-phase5f-parser-grammar`

Latest verified implementation checkpoint:

`3e6b624505680e264af3b5f681be0f806a84648d`

Current native foundation:

- dependency-free bounded native scanner.
- UTF-16 source-position contract.
- strings/comments treated as opaque.
- bounded delimiter handling.
- malformed/incomplete source safety.
- no fake historical AST compatibility layer.
- native semantic Tree-sitter reachability = `0`.
- native active syntax parser reachability = `0`.
- named parser-backed native routes = `0`.
- parser-backed special-format semantic routes = `0`.

Completed native semantic migration includes the supported language and
special-format families established by the Phase 5F evidence ledger, including:

- TypeScript / TSX / JavaScript / JSX.
- Python / Go / Java.
- Rust / Kotlin / Scala.
- C / C++ / Objective-C / C#.
- Swift / ArkTS / Solidity.
- PHP / Ruby / Lua / Luau / R.
- Dart / Nix / Pascal / VB.NET.
- Erlang / Terraform / OpenTofu / COBOL.
- CFML / CFScript / CFQuery.
- Svelte / Vue / Astro embedded-script semantics.
- Razor / Blazor C# regions.

Completed production-contract closure boundaries:

- native semantic primitive closure.
- native resolution and conformance closure.
- native lexical receiver precision closure.
- frozen native extraction/framework-synthesis inventory closure.

Current verified gap metrics:

```text
route-level native semantic gaps:       0
lexical receiver/binding gaps:          0
frozen framework/extraction inventory: 15 -> 0
```

The former selected inventory result `22 -> 6` is **not** a global production
gap count. Six ranking/explore candidates remain in the frozen accounting, and
the broader campaign also exposed historical native differences outside that
selected inventory (for example RTK Query, Spring events, Vue store, and Java
anonymous-class behavior). Their v1 status must be decided by product value and
evidence rather than automatically reproduced.

Current physical/parser state intentionally remains transitional:

```text
default parser fallback:           ACTIVE
parser bootstrap:                  ACTIVE
tracked grammar WASM:              29
SyntaxNode/parser coupling:        34-file checkpoint
web-tree-sitter:                   PRESENT
tree-sitter-wasms:                 PRESENT
```

V1 contract decision gate:

**COMPLETE**

Decision checkpoint:

`3425348dcf4079bb35385a31a98ce54286ec9f0b`

The audit classified remaining behavioral differences into:

- `V1_REQUIRED`.
- `NATIVE_CORRECTION`.
- `LEGACY_COMPATIBILITY_ONLY`.
- `POST_V1`.
- `ENVIRONMENT_OR_TOOLING_NOISE`.

Authoritative behavior-family accounting:

```text
TOTAL ASSESSED DIFFERENCE FAMILIES = 14
SEMANTIC / PRODUCT DIFFERENCES     = 11

V1_REQUIRED                       = 5
NATIVE_CORRECTION                 = 1
LEGACY_COMPATIBILITY_ONLY         = 1
POST_V1                           = 4
ENVIRONMENT_OR_TOOLING_NOISE      = 3
```

The five v1 blockers are:

1. correct real-index context selection / expansion / budgeting;
2. spend explore reservation on relevant source without exceeding the hard cap;
3. prevent source-line re-delivery across explore calls;
4. reject ordinary non-store `actions` members;
5. preserve Java abstract definitions and anonymous override relationships.

Non-blocking decisions:

- retain the native deprioritization correction;
- do not tune floating scores without measured product impact;
- defer Expo Router attribution, RTK Query completeness, Spring Event
  enrichment, and Vuex mutation recall to post-v1;
- keep environment/tooling noise separate from semantic implementation.

Decision:

```text
V1_SEMANTIC_CONTRACT = IMPLEMENT_REQUIRED_GAPS
```

Current implementation boundary:

> **Afyx V1 Required Behavior Closure**

This must be one consolidated closure of the five required behavior families,
not five independent micro-phases.

Semantic closure rule:

```text
five V1-required behavior families
  -> one consolidated implementation closure
  -> focused + risk-proportional validation
  -> V1_REQUIRED = 0
  -> semantic contract freeze
```

After semantic freeze, the parser/runtime closure sequence is:

```text
A. Native Performance & Token-Efficiency Baseline
   Establish representative OLD/native measurements and large-repo context
   efficiency evidence without requiring an arbitrary percentage claim.

B. Global Default Fallback Closure
   Make Afyx-native semantic/syntax/guard routing unconditional in production.
   The historical parser may remain only as an explicitly isolated oracle if
   still justified for a short transition.

C. Parser Bootstrap & Worker-Protocol Closure
   Remove parser initialization, grammar reads/transfers/load messages, and
   parser caches while preserving the native worker pool.

D. Parser Adapter & Tree-Walk Source Closure
   Remove TreeSitterExtractor, parser adapters, AST/tree-walk helpers/types, and
   obsolete parser-backed syntax/guard paths.

E. Grammar & Packaging Closure
   Remove tracked/shipped grammar WASM, grammar staging/copy requirements, and
   package-resolved grammar use.

F. Runtime & Dev/Test Isolation
   Remove production web-tree-sitter/tree-sitter-wasms requirements and delete
   or strictly isolate any remaining parser-only tooling/oracles.
```

Performance/token principle:

> Afyx does not optimize by withholding resources required for quality. It
> optimizes by using graph/impact evidence to avoid irrelevant context, repeated
> discovery, unnecessary tool calls, and validation that cannot change the
> engineering decision.

Validation principle:

- local changes use focused positive/negative tests and the smallest affected
  regression set;
- shared semantic/core changes add representative cross-language/integration
  coverage;
- full production campaigns, packaging, and independence audits are reserved
  for architecture/release closure gates or when targeted evidence cannot
  resolve a real risk;
- every validation run must answer a specific unresolved risk;
- already-valid evidence is reused when the dependency/impact boundary proves it
  remains applicable.

Parser principle:

> Preserve or improve Afyx product meaning and quality, not historical parser
> implementation details.

No supported v1 language may be silently dropped to simplify independence.

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
- adaptive validation budget based on actual impact/risk.
- evidence reuse when prior evidence remains valid.
- failed-test classification.
- skipped-test classification.
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

Assurance rules:

```text
UNKNOWN FAILED TEST = 0
V1_REQUIRED correctness failure = 0
UNJUSTIFIED SKIP = 0
TEMPORARY SKIP = 0 before stable release
```

Expected platform/mode/optional-integration skips are allowed only when
explicitly classified and documented.

Validation levels:

```text
LEVEL 1 — local change
  focused contract + negative precision + relevant static/type check

LEVEL 2 — shared/core change
  Level 1 + affected regression + representative integration/build

LEVEL 3 — architecture/release closure
  full campaign + product surfaces + packaging + independence/release evidence
```

A broader level is used only when the smaller level cannot resolve the actual
risk.

## Phase 8 — Real-World Dogfood & Comparative Proof

Status: **PLANNED**

Contract items:

- real Odoo work.
- real engineering repositories.
- small, medium, large, and multi-module/workspace-scale repositories.
- correctness and output-quality measurement.
- context usefulness.
- files/symbols retrieved or inspected.
- irrelevant-context and duplicate-read evidence where measurable.
- tool-call count.
- validation work executed.
- latency.
- context/token volume.
- repeatable controlled tasks.
- same task/model/repository conditions where comparison is claimed.

Comparative campaign:

- CONTROL — no structural graph tool.
- BASELINE — frozen historical structural-graph implementation.
- TREATMENT — Afyx Graph.

Principle:

> Correctness and required output quality are hard gates; token efficiency comes
> from eliminating waste, not starving the agent.

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
- all remaining failed tests classified; unknown and v1-required correctness failures = 0.
- all skipped tests classified; unjustified/temporary skips = 0.
- minimum-sufficient context/validation behavior demonstrated on representative repositories.
- performance/token-efficiency evidence documented without unsupported percentage claims.
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

The frozen post-v1 track order is:

```text
TRACK A — AFYX FORGE
TRACK B — PLATFORM GENERALIZATION
TRACK C — ENGINEERING INTELLIGENCE EXPANSION
```

Tracks are ordered by the canonical product-development contract above. Track
letters must not be reassigned. Work may still be prioritized by measured value
once dependencies permit.

## Track A — Afyx Forge

Afyx Forge is post-v1. It must not become a blocker for the stable v1 release.

Goal:

> Convert the proven v1 engineering workflow into an adaptive Afyx-native
> directive system that allocates the minimum sufficient context, reasoning,
> tooling, and validation needed for the target quality.

Principle:

> Behavior reference, not source template. Architecture is chosen from
> benchmark evidence rather than pre-frozen around an existing prompt/skill.

Canonical phases:

- **A0 — Evaluation Freeze**
  - freeze benchmark tasks, scoring, and evidence format.
- **A1 — Capability Harvest**
  - harvest useful behavior from Efficient Coding, the independent master
    prompt, actual v1 workflows, and other legitimate behavioral references.
- **A2 — Capability Matrix**
  - map overlap, unique capabilities, cost, quality contribution, and failure
    modes.
- **A3 — Deduplication / Refinement**
  - remove redundant instructions and preserve only behavior with demonstrated
    value.
- **A4 — Candidate Construction**
  - B0: no directive.
  - B1: Efficient Coding 1.2.0.
  - B2: independent master prompt.
  - B3: Efficient Coding + independent master prompt.
  - B4: refined convergence candidate.
  - B5: Afyx Forge native candidate.
- **A5 — Benchmark Harness**
  - run controlled, repeatable engineering tasks with quality/resource evidence.
- **A6 — Quality Gate**
  - correctness and engineering quality first.
- **A7 — Efficiency Gate**
  - context, reasoning, token, tool, and validation efficiency after quality.
- **A8 — Data-Driven Architecture Decision**
  - choose the Forge architecture from evidence.
- **A9 — Forge Implementation**
  - implement only if A8 supports it.
- **A10 — Adaptive Engineering Directive**
  - dynamically allocate context/reasoning/tool/validation budgets by task risk
    and evidence.
- **A11 — Dogfood & Optimization**
  - use real engineering work and optimize measured bottlenecks.
- **A12 — Stable**
  - freeze the stable Forge contract.

Odoo Engineering remains a separate domain skill and is not folded into Forge
merely to reduce component count.

## Track B — Platform Generalization

Goal:

> Generalize the stable v1 architecture beyond the primary Codex provider without
> leaking provider-specific behavior into Afyx core ownership.

Canonical phases:

- **B0 — v1 Platform Contract Freeze**
- **B1 — Provider-Neutral Core Contracts**
- **B2 — Stable ProviderAdapter Contract**
- **B3 — Capability Discovery / Negotiation**
- **B4 — Provider-Neutral Task / Context / Evidence Contracts**
- **B5 — Additional Provider Integrations by Measured Demand**
- **B6 — Cross-Provider Validation / Hardening**
- **B7 — Stable Generalized Platform**

Preserve the stable Codex integration while generalizing the core.

## Track C — Engineering Intelligence Expansion

Goal:

> Expand from language-level code understanding toward repository, framework,
> data, API/schema, build, runtime, and infrastructure intelligence according to
> measured engineering value.

### C0 — Expansion Evaluation Freeze

Freeze prioritization evidence and avoid language-count driven scope.

### C1 — Repository & Runtime Intelligence

Planned candidates:

- Shell: `.sh`, `.bash`, `.zsh`.
- PowerShell: `.ps1`, `.psm1`, `.psd1`.
- Make / CMake.
- Dockerfile / Docker Compose.
- generic JSON / JSONC / TOML project manifests.

Target relationships include script -> command, build target -> source/output,
manifest -> dependency/workspace/entrypoint, and runtime/container -> component.

### C2 — Data & Infrastructure Intelligence

Planned candidates:

- PostgreSQL — high priority.
- MySQL / MariaDB.
- SQLite.
- SQL Server / T-SQL.
- Oracle / PL-SQL later.
- GitHub Actions and additional CI/CD by demand.
- Kubernetes.
- Ansible.
- Terraform/OpenTofu enrichment.
- Docker Compose enrichment.
- environment/config relationships.

### C3 — API & Schema Intelligence

Planned candidates:

- GraphQL.
- Protocol Buffers.
- OpenAPI YAML/JSON.
- AsyncAPI later.

Target relationships connect API/schema declarations to implementations,
services, persistence, and runtime components.

### C4 — Deep Framework Intelligence

Priority candidate:

- Odoo engineering relationships across Python models, `_inherit`, fields,
  compute/`@api.depends`, onchange, XML views, buttons/actions/menus,
  `ir.model.access.csv`, record rules, modules, database/migration, and runtime.

Other candidates are selected by measured demand, including Django, FastAPI,
Flask, Spring, Laravel, Rails, React/Next.js, Vue/Nuxt, SvelteKit, Flutter,
.NET/ASP.NET, and Android.

### C5 — Programming Language Expansion

Candidates include Groovy, Elixir, Zig, F#, Clojure, Haskell, OCaml, Julia,
Perl, and additional languages selected by:

```text
user demand
  x ecosystem value
  x repository prevalence
  / implementation complexity
```

Policy:

> Do not optimize for language-count marketing. Deep engineering-system
> understanding has higher value than low-demand parser breadth.

### C6 — Cross-Domain Relationship Expansion

Unify language, framework, config, database, API/schema, build, and deployment
relationships where evidence shows product value.

### C7 — Real-World Comparative Proof

Measure whether expanded intelligence improves engineering outcomes without
wasting context, tokens, or tool calls.

### C8 — Stable Intelligence Expansion

Freeze supported expansion contracts after evidence and hardening.

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

Tracks A, B, and C begin only after the stable v1 boundary unless maintenance of a
v1 guarantee requires otherwise. Their execution is prioritized by measured product value,
while the canonical track identities/order remain fixed.

## Progress rule

A merge is not sufficient evidence of roadmap completion.

Every substantial task or closure boundary must update the appropriate
source-of-truth document **during the task**, not only at the end:

- the phase-specific evidence document records detailed implementation and
  validation evidence;
- this master roadmap is updated whenever roadmap status, active checkpoint,
  next canonical boundary, contract, or release-relevant state changes;
- status updates must distinguish verified completion, partial completion,
  blocked work, and work merely planned;
- evidence already proven and unaffected by the current dependency/impact cone
  must be reused rather than rerun.

### Task progress contract

Each substantial task must leave a recoverable progress state containing:

- task / roadmap boundary.
- branch and starting HEAD.
- current/final HEAD when available.
- worktree state.
- completed implementation concerns.
- remaining concerns.
- validations completed with exact results.
- validations intentionally not rerun and why.
- failures/skips requiring classification.
- transitional dependencies/artifacts still present.
- exact next action / boundary.
- explicit stop conditions or blockers.

### Session continuity / handoff contract

When a chat/session approaches context or usage limits, is compacted, or is
intentionally continued in a new chat, do **not** restart the engineering task.

Create or preserve a concise handoff checkpoint containing:

```text
repository / branch
starting HEAD
current HEAD
dirty files, if any
completed decisions/implementation
validated evidence that must be reused
unresolved failures/risks
work that is still pending
do-not-repeat validations
exact next action
```

Continuation rules:

1. verify the saved branch/HEAD/worktree;
2. preserve intentional dirty work;
3. reuse valid evidence;
4. rerun only evidence invalidated by subsequent changes or needed to resolve an
   unresolved risk;
5. never reset/restart solely because the chat/session changed;
6. update the phase document and roadmap when the canonical state changes.

This contract exists specifically to prevent token, tool, compute, and human
time waste caused by repeated discovery or validation after session turnover.

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
- minimum-sufficient context/reasoning/tool/validation behavior is demonstrated.
- large-repository/workspace use does not depend on wasteful whole-repository context by default.
- token/resource efficiency improvements preserve required output quality.
- remaining failed/skipped tests satisfy the classification policy.
- private beta is complete.
- stable release gates pass.

Then, and only then:

> **Afyx Code Engineering Kit v1.0.0 — Stable**

After v1, expansion follows Track A / Track B without reopening the v1 feature
contract unless maintenance of an existing v1 guarantee requires it.
