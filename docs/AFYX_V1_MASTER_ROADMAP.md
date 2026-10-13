# Afyx v1 Master Roadmap

Status: **Phase 5 complete**
Canonical since: **2026-10-03**  
Contract revision: **2026-10-11**
v1 scope policy: **FROZEN — Phase 1 through Phase 11**  
Post-v1 policy: **PLANNED EXPANSION — not a v1 release blocker**

Current work: **Repository knowledge catalog acceptance and scoped coverage refinement; AFYX-248 remains in progress**
Task: repository knowledge catalog acceptance; `AFYX-248` remains in progress
Canonical merged main baseline: `5349c4a184e539f0ac0752d895ff3262c6326e29`  
Active implementation branch: `afyx/native-phase5f-parser-grammar`  
Latest verified Phase 5F implementation checkpoint: `62621a0639f42db0eaac69ef087436d851cdba88`  
Latest verified Phase 5F semantic-freeze checkpoint: `6fd0296b22844eef62b86a395b861ebb51193dc5`  
Latest verified Phase 5F performance-baseline checkpoint: `1f671dabc8af5bf8f8088dc6e947e48834cafdc3`  
Latest verified Phase 5F fallback-closure checkpoint: `16c8e84ce7dc036141a680dbabbdd73e31f70f6c`  
Latest verified Phase 5F bootstrap/protocol checkpoint: `81695bb7659bd05a06f00e9fe0e36d5e6e933191`  
Latest verified Phase 5F grammar/packaging checkpoint: `a21d7b710f9c4e0c02f461096e9f39a47171a664`  
Latest verified Phase 5F parser-runtime isolation checkpoint: `080074f81f0cf5628f61e977a93abc1d75d00b6b`  
Native-kernel closure starting checkpoint: `89302e45c8222e64c18885499f8aa556ae103960`
Phase 5F final artifact/product viability audit: **PASS**
Next boundary: **Technical Alpha activation decision; Technical Alpha is not active**
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

Current physical/parser state after grammar and packaging closure:

```text
default parser fallback:           CLOSED
parser bootstrap:                  CLOSED
tracked grammar WASM:              0
shipped grammar WASM:              0
grammar staging/copy:              0
package-resolved grammar use:      0
SyntaxNode/parser coupling:        0
web-tree-sitter:                   0
tree-sitter-wasms:                 0
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

Authoritative decision-gate accounting:

```text
TOTAL ASSESSED DIFFERENCE FAMILIES = 14
SEMANTIC / PRODUCT DIFFERENCES     = 11

V1_REQUIRED                       = 5 -> 0
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

Implementation checkpoint:

`62621a0639f42db0eaac69ef087436d851cdba88`

Closure evidence:

- real-index context: `77/77 PASS`;
- qualifying explore allocation: `8/8 PASS`;
- cross-call source dedup: `27/27 PASS`;
- Vue-store positive/negative precision: `2/2 PASS`;
- Java abstract/anonymous contract: `1/1 PASS`;
- final native campaign: `5,622 PASS / 54 FAIL / 213 SKIP`, with zero
  remaining `V1_REQUIRED` or unknown product failures.

Decision:

```text
V1_SEMANTIC_CONTRACT = FROZEN
```

Completed implementation boundary:

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

Completed measurement boundary:

> **Native Performance & Token Efficiency Baseline**

Authoritative state:

```text
NATIVE_PERFORMANCE_BASELINE = FROZEN
```

The same-fixture default/native campaign froze cold indexing, sync, graph/query,
context/explore information density, MCP/daemon lifecycle, persistence, RSS,
and artifact-footprint evidence beside correctness digests. Native peak RSS
(+49.63 MB on the controlled 301-file fixture) is the primary measured
optimization candidate; it does not block the trustworthy baseline. Provider
tokens and a large real-repository agent campaign remain explicitly unmeasured.

The exact next boundary is:

> **Native Kernel Closure**

The remaining parser/runtime closure sequence is:

```text
A. Native Performance & Token-Efficiency Baseline [COMPLETE]
   Establish representative OLD/native measurements and large-repo context
   efficiency evidence without requiring an arbitrary percentage claim.

B. Global Default Fallback Closure [COMPLETE]
   Make Afyx-native semantic/syntax/guard routing unconditional in production.
   The historical parser may remain only as an explicitly isolated oracle if
   still justified for a short transition.

C. Parser Bootstrap & Worker-Protocol Closure [COMPLETE]
   Remove parser initialization, grammar reads/transfers/load messages, and
   parser caches while preserving the native worker pool.

D. Parser Adapter & Tree-Walk Source Closure [COMPLETE]
   Remove TreeSitterExtractor, parser adapters, AST/tree-walk helpers/types, and
   obsolete parser-backed syntax/guard paths.

E. Grammar & Packaging Closure [COMPLETE]
   Remove tracked/shipped grammar WASM, grammar staging/copy requirements, and
   package-resolved grammar use.

F. Runtime & Dev/Test Isolation [COMPLETE]
   Remove production web-tree-sitter/tree-sitter-wasms requirements and delete
   or strictly isolate any remaining parser-only tooling/oracles.
```

Canonical routing state:

```text
GLOBAL_DEFAULT_FALLBACK = CLOSED
PARSER_BOOTSTRAP = CLOSED
PARSER_WORKER_PROTOCOL = CLOSED
PARSER_ADAPTER_AND_TREE_WALK_SOURCE = CLOSED
GRAMMAR_AND_PACKAGING = CLOSED
PARSER_RUNTIME_AND_DEV_TEST_ISOLATION = CLOSED
TRACKED_GRAMMAR_WASM = 0
SHIPPED_GRAMMAR_WASM = 0
WEB_TREE_SITTER = 0
TREE_SITTER_WASMS = 0
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

Status: **COMPLETE**

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

Closure state:

```text
KERNEL_VALUE = NONE
third-party kernel ownership = 0
third-party native crates = 0
vendored/generated grammar source = 0
kernel runtime dependency = 0
NATIVE_KERNEL_CLOSURE = CLOSED
```

#### 5F.6 — Runtime / Distribution Closure

Status: **COMPLETE**

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

Closure state:

```text
Runtime = external Node.js >=22.5.0
bundled Node runtime = 0
shipped node_modules = 0
bundled general-purpose runtime = 0
RUNTIME_DISTRIBUTION_CLOSURE = CLOSED
```

#### 5F.7 — Final Phase 5F Artifact Audit

Status: **COMPLETE**

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
- fresh product install from the release/distribution boundary: PASS.
- first-run launcher/runtime detection: PASS.
- real repository/workspace initialization and first index: PASS.
- search/context/callers/callees/impact/affected query flow on that initialized repository: PASS.
- MCP initialize and real query from the installed artifact: PASS.
- clean shutdown, restart, reopen existing index, incremental file change/sync, and re-query: PASS.
- product viability smoke has zero install/init/index/startup/reopen/incremental-sync crash, zero unhandled exception, zero silent empty result for known-positive queries, zero corrupt index, and zero UNKNOWN product failure.

Hard product-viability gate:

```text
AFYX_PRODUCT_INSTALL_SMOKE        = PASS
AFYX_REPO_INIT_SMOKE              = PASS
AFYX_REAL_END_TO_END_PRODUCT_SMOKE = PASS
```

These gates must execute from the actual built/release artifact in a fresh
temporary installation location with only the documented external runtime
prerequisites. Running solely from the development repository or its existing
`node_modules` is insufficient evidence.

Historical legal evidence may still remain until Phase 5H.

Closure evidence from canonical starting HEAD
`57b48cef89d42002e7acb30085b5d58c84923e1d`:

```text
strict product runtime/dependency/parser/grammar/UI/kernel forbidden counts = 0
fresh Windows artifact install                                              PASS
real 795-file workspace init and 771-file index                             PASS
search/context/callers/callees/impact/affected known-positive flow          PASS
installed-artifact MCP initialize/list/query/shutdown                       PASS
restart/reopen existing index                                               PASS
one-file incremental rename/sync/re-query/restore                           PASS

AFYX_PRODUCT_INSTALL_SMOKE           = PASS
AFYX_REPO_INIT_SMOKE                  = PASS
AFYX_REAL_END_TO_END_PRODUCT_SMOKE   = PASS
PHASE_5F_ARTIFACT_AUDIT              = PASS
PHASE_5F                             = COMPLETE
```

Windows was measured locally. Linux and macOS remain statically validated for
this audit because no matching branch CI run existed; native execution is not
fabricated. The next boundary is Phase 5G. Technical Alpha remains inactive and
still requires Phase 5G, Phase 5H, and Phase 5I PASS.

### Phase 5G — Legacy Product Identity / Historical Artifact Eradication

Status: **COMPLETE**

Canonical starting HEAD: `f7f3294bdbb4150a3e037622feda9ad6e1a164d8`.

The inventory classified every literal identity family before editing. Active
source held 91 historical ticket labels and the shipped explore benchmark held
one; all 92 were replaced with behavior-owned terminology without changing
executable code. The remaining ledger is deliberately non-active:

- `HISTORICAL_EVIDENCE`: 144 textual references (143 regression/evidence
  ticket references and one truthful ancestry reference);
- `LEGAL_PROVENANCE`: three retained attribution/license files;
- `EXTERNAL_EXCEPTION`: one ignored local developer-index directory;
- `FALSE_POSITIVE`: 145 ephemeral `cg-*` test-directory prefixes plus five
  uses of the generic domain phrase “code graph”.

The `cg-*` prefixes are arbitrary test isolation names: they are not shipped,
runtime-reachable, user-visible, configuration, compatibility aliases, or
product identity. Current Afyx compatibility surfaces (public installer
exports, provider migration cleanup, schema migration, CLI contracts, and
daemon upgrade safety) remain because they have current V1 value; none is a
historical-product compatibility dependency.

The identity audit now enforces active surfaces while classifying the exact
historical/legal evidence paths and ignored external index instead of erasing
truthful evidence. Its focused suite passes 10/10. Static identity metadata,
the repository evaluator, clean TypeScript/UI production build, 21-check
CLI/MCP smoke, distribution verifier, npm-pack inventory, and a verified
1,367-entry Windows bundle all pass. Package and bundle scans found zero active
historical identity, historical config/path residue, or obsolete compatibility
payload.

Closure counts:

```text
ACTIVE_PRODUCT_IDENTITY        = 0
ACTIVE_RUNTIME_CONFIG          = 0
ACTIVE_PATH_OR_ENV             = 0
ACTIVE_IMPLEMENTATION_RESIDUE  = 0
OBSOLETE_COMPATIBILITY         = 0
TEST_ONLY_OBSOLETE             = 0
UNCLASSIFIED_RESIDUE           = 0
V1_REQUIRED failure            = 0
UNKNOWN product failure        = 0
PHASE_5G                       = COMPLETE
```

Phase 5F product-viability evidence remains valid because Phase 5G changed no
runtime behavior, dependency, parser, grammar, kernel, config, path, or public
contract. Technical Alpha remains inactive. Phase 5H is the exact next
boundary and is not started here.

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

Status: **COMPLETE (2026-10-09)**

Starting HEAD: `81af1777297814ccc7603fd0552be496ef4209f3`

The legal/provenance ledger traced all three Phase 5G files to the previously
incorporated engine implementation:

| File | Historical coverage | Current/shipped corresponding material | Decision |
|---|---|---:|---|
| `afyx-graph/THIRD_PARTY_NOTICES.md` | prior engine implementation attribution | 0 / 0 | `REMOVE_OBSOLETE` |
| `afyx-graph/LICENSES/THIRD_PARTY_ENGINE_MIT.txt` | prior engine implementation license | 0 / 0 | `REMOVE_OBSOLETE` |
| `afyx-graph/engine/LICENSE` | prior engine implementation license copied into npm package | 0 / 0 | retain path, replace with current Afyx MIT license identical to root `LICENSE` |

The notice-to-material trace ends at the Phase 5F removals: no covered source,
asset, runtime, binary, generated material, grammar, parser, native kernel, or
library remains in the tracked product or release artifacts. Git history and
the Phase 5 evidence sections retain the truthful historical record; historical
evidence is not an active release notice.

| Artifact | Current Afyx license | Third-party license | Third-party notice | Historical-only legal material | Unexplained legal material |
|---|---:|---:|---:|---:|---:|
| npm pack (1,361 entries) | 1 | 0 | 0 | 0 | 0 |
| Windows archive | 1 | 0 | 0 | 0 | 0 |
| Linux archive | 1 | 0 | 0 | 0 | 0 |
| staged release tree | 1 | 0 | 0 | 0 | 0 |

`distribution-product.json`, both installers, the release workflow, bundle
builder, repository validator, and regression tests enforce a single root-level
current `LICENSE` and reject either obsolete historical legal filename.

Engine and UI production dependencies remain zero. Development tooling is not
bundled production material. Node.js >=22.5.0 is an externally supplied
platform runtime; no Node binary, source, or `node_modules` tree is
redistributed, so no Node notice is bundled. Prompt Master is fetched from its
separately managed upstream repository and is not shipped in Afyx Graph.
Headroom remains a detection-only external exception and is not shipped.

Validation: legal validator unit tests `18/18 PASS`; legacy identity audit,
repository validator, static evaluation validator, clean production/UI build,
21-check CLI/MCP smoke, distribution verifier, npm pack legal inventory,
Windows archive inventory, Linux archive inventory, and `git diff --check`
pass. Phase 5F product viability evidence remains valid because no runtime
behavior source changed.

```text
UNCLEAR_LEGAL_OBLIGATION                      = 0
unwanted third-party attribution requirement = 0
unwanted third-party release notice payload  = 0
unexplained shipped legal material           = 0
V1_REQUIRED failure                           = 0
LEGAL_CLOSURE_BLOCKER                         = 0
UNKNOWN product failure                       = 0
PHASE_5H                                      = COMPLETE
```

This is an engineering artifact/provenance determination, not broader legal
advice. It does not declare `AFYX_FULLY_INDEPENDENT = TRUE`; Technical Alpha
remains inactive pending Phase 5I.

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

Status: **COMPLETE (2026-10-10)**

Starting HEAD: `14c138024fef26cd303d9c0bcb16340830776652`.

The audit establishes the technical-ownership, historical-eradication, legal,
and release-composition assertions. Engine and UI production dependencies are
zero. The tracked production tree contains 371 files / 4,842,295 bytes and no
tracked WASM, native binary/library, vendor tree, historical license header, or
third-party runtime. Existing Phase 3/C01-C07 provenance campaigns plus the
Phase 5F-H replacement, identity, and notice-to-material evidence leave zero
unexplained retained private implementation or substantive upstream overlap.
Legacy identity, graph identity/legal, component, and static-evaluation
validators all pass.

The final release audit rebuilt and verified these artifacts:

| Artifact | Entries / files | Unpacked bytes | Artifact bytes | SHA-256 |
|---|---:|---:|---:|---|
| `dist` | 1,336 files | 9,002,544 | n/a | per-file manifest verified |
| npm pack | 1,361 files | 9,172,330 | 2,235,369 | `56f0c51dd5f6b4f3b71051f2ec93b754602fbc74e4206843e32bdc979cf7a28a` |
| Windows x64 archive | 1,365 entries / 1,340 files | 9,006,813 | 2,806,996 | `8e45a2b3b690dd09b1716330aec130ec3a4113f272ccd0cd4742d1aaea8f2d99` |
| Linux x64 archive | 1,366 entries / 1,340 files | 9,007,089 | 2,143,373 | `fc4f6b52b1f9729a049204632b0ab8a8ff7e22fff5e5464d0cbc403f2ae0bd1a` |

Each staged archive has one current Afyx `LICENSE`; no third-party notice or
license payload is present. Unwanted bundled source, assets, runtime,
`node_modules`, parser runtime/WASM, native kernel/library, and historical
identity counts are zero. The sole npm text scan match is the Afyx-owned
distribution verifier rejecting `web-tree-sitter`/`tree-sitter-wasms`, not a
bundled implementation. External Node.js >=22.5 remains a platform
prerequisite; Prompt Master and Headroom remain separately managed external
boundaries.

Three audit defects were corrected without broadening architecture: the
distribution test fixture now follows the one-license Phase 5H contract;
semantic score comparison preserves identities/order while accepting only
finite SQLite BM25 values across supported Node versions; and native extraction
restores Python inheritance, Python `self` calls, and Java field-type
references. The semantic comparator independently requires the correct Java
`testRender -> render` edge and `UpperFormatter` result before classifying them
as `NATIVE_CORRECTION`. Focused extractor/distribution tests pass 18/18, all six
semantic fixtures pass, CLI/MCP smoke passes 21/21, and clean production/UI
build plus artifact verification pass.

Technical Alpha is nevertheless blocked. Diagnostic Graph Build run
`37950282483` on the starting HEAD reported Linux 5,644 pass / 32 fail / 9
declared skips across 13 files. Eight failures were the corrected Phase 5H
distribution-fixture drift. The remaining 24 assertions across 12 files include
core extraction/resolution and UI/API behavior; they are not hidden as
environmental noise or normalized away. Windows and macOS reached the semantic
gate and failed only on the now-corrected raw-score portability issue, but a
final-head cross-platform run is still required after the audit commit.

Corrective continuation on 2026-10-10 grouped the 24 assertions by cause rather
than weakening them individually. The failure ledger closed as follows:

- native fact gaps: Go package variables/composite literals/conversions, Rust
  struct literals, TypeScript constructor and typed-return ownership, Java
  decorator stacks, C++ qualified receivers, and RTK Query endpoints/hooks;
- resolution/UI gaps: ArkTS `.ts` consumer through an `.ets` re-export barrel,
  response-chain status propagation, and Expo same-file screen attribution;
- invalid configuration acceptance: misspelled extension languages now fail the
  supported-language membership check;
- stale tests: native zero-config ranking, healthy C++ raw strings, and
  platform-normalized scan paths now assert the current independently verified
  contract instead of historical failure behavior.

The original 12-file regression group now has `1,070 PASS`, one declared skip,
and zero assertion failures. Windows-only temporary-directory cleanup can still
surface as `EPERM` after successful assertions and is not hidden as a product
pass. Additional regression isolation restored the TanStack `submit` attribution
while keeping Expo `via=[]`; TanStack `29/29` and Expo `69/69` pass. Clean
production/UI build, semantic `6/6`, CLI/MCP `21/21`, distribution verification,
identity/metadata validation, legacy-identity audit, and component contract pass.
The last five Linux assertions were isolated without repeating Phase 5F-H audits.
Environment leakage was disproved by unconditional production routing, matching
focused Node 24/26 behavior, and deterministic same-HEAD Linux reproduction.
Production HEAD `31ac39c394b5eb222117c2047e663f9ab1304a61` closed Go, Rust,
TypeScript-call, and C++ receiver defects. Final production HEAD
`54cc0786734be6c10fb9fe06d1316f0fa942e5f7` additionally rejects TypeScript
object-literal keys as function references and freezes the corrected qualified
Rust import expectation. The WAL concurrency assertion passed 5/5 in isolation,
so no unrelated WAL change was made.

Graph Build run [`38017609984`](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38017609984)
passes at `54cc0786734be6c10fb9fe06d1316f0fa942e5f7`: Linux unit tests,
semantic baseline, CLI/MCP smoke, and host-bundle smoke are green; Windows and
macOS build, semantic, and CLI/MCP jobs are green. The earlier runs
`37988190509` and `38015810450` remain the reproducible failure ledger rather
than being reclassified as environmental noise.

```text
historical runtime dependency                   = 0
historical build dependency                     = 0
historical operational dependency               = 0
retained historical implementation              = 0
unexplained substantive upstream source overlap = 0
historical active product identity              = 0
unexplained historical artifact                 = 0
unwanted third-party bundled source             = 0
unwanted third-party bundled assets             = 0
unwanted third-party bundled runtime            = 0
unwanted third-party attribution requirement    = 0
unwanted third-party release notice payload     = 0
UNCLEAR_PROVENANCE_OR_LEGAL_OBLIGATION          = 0
V1_REQUIRED failure                             = 0
UNKNOWN product failure                         = 0
UNJUSTIFIED_SKIP                                = 0

PHASE_5I = COMPLETE
AFYX_FULLY_INDEPENDENT = TRUE
TECHNICAL_ALPHA_ENTRY_GATE = READY_FOR_ACTIVATION
```

The next boundary is the separately authorized Technical Alpha activation
decision. This audit establishes readiness only; it does not activate Technical
Alpha and does not start Phase 6.

### AFYX-255 — Unified Technical Alpha lifecycle

Status: **IMPLEMENTED; Technical Alpha remains inactive**

AFYX-255 closes the installer/updater/verifier work package without changing
the Phase 5I independence result. The Windows and Linux/macOS entrypoints now
share a five-component state model and the prerequisite classes `REQUIRED`,
`COMPONENT_REQUIRED`, `BUILD_ONLY`, and `OPTIONAL`. Automatic update no longer
passes blanket force: Install/Update/Repair/Skip is selected from measured
state/version or an explicit deterministic component action.

Afyx Graph acquisition is release-first and validates checksum, product,
version, Technical Alpha channel, OS, and architecture. A missing or invalid
matching artifact falls back to a bounded clean build from a validated checkout;
Windows packages natively in PowerShell and does not require Bash. Staging,
ownership checks, backup/swap/rollback, and real CLI `--version`/`help`
verification protect an existing healthy runtime. Offline, no-fallback, dirty
source opt-in, validate-only, and dry-run behavior are explicit.

Local deterministic AFYX-255 evidence includes the focused lifecycle matrix,
component/metadata/legal validators, parser/shell syntax gates, no-mutation
dry-run, incompatible-Node refusal, unknown-owner refusal, and checksum-failure
preservation. Final-head Windows/Linux/macOS workflow results remain the
delivery evidence for AFYX-255 and the independent-install verification record
for AFYX-251; no public release or Technical Alpha activation is implied.

### AFYX-257 — Native parser reliability

Status: **DONE — IMPLEMENTED AND VALIDATED**

The reproduced JavaScript case is a 457,840-byte, single-line vendor bundle
with 181,296 native scanner tokens and 45,002 matched delimiter pairs. The
scanner itself completed in about 180 ms; V8 profiles isolated repeated
quadratic work in native fact extraction: delimiter-pair scans per semicolon
and member, whole-token export scans per declaration, typed-assertion pair
scans per call, and growing same-line prefix scans.

The bounded Afyx-native correction builds reusable nesting/semicolon indexes,
precomputes export and typed-assertion lookup data, and records same-line import
prefix state. Final-head Linux validation exposed that numeric delimiter depth
was not semantically equivalent when nested pairs shared an owner boundary.
The corrected index records the innermost containing pair and applies the
established strict interval rule for every language, retaining bounded lookup
without changing ArkTS, JavaScript, TypeScript, Vue/Pinia, Java, or downstream
context/UI semantics.
No parser runtime, grammar, timeout, dependency, fallback, or private source was
added. A generated one-line regression fixture covers nested initializers,
large class bodies, and invalid/incomplete input classification. Extraction
version 27 prompts existing projects to rebuild indexes that may have omitted
these files.

Read-only execution against the exact private SHA-256 case changed from no
result after 60 seconds to 1.86 seconds direct and 1.96 seconds through the real
parse worker, with identical direct/worker output counts: 1,686 nodes, 1,685
edges, 18,518 unresolved references, zero extraction errors. Private content and
paths are not stored in this repository.

Corrective validation after the Linux finding passed extraction `655/655`,
the eight affected downstream suites `214` with one skip, and the synthetic
long-line plus native-ArkTS guards `7/7`. TypeScript typecheck, clean
production/UI build, semantic baseline, and CLI/MCP smoke also passed locally.
Implementation-head CI `38063648783` and Afyx Graph Build `38063647999`
passed on Windows, Linux, and macOS. AFYX-257 is resolved; AFYX-258 remains
open for its explicitly deferred freshness/watcher UX scope.

### AFYX-260 — Exact-file Explore and retrieval correctness

Status: **DONE — IMPLEMENTED AND VALIDATED**

Baseline `386199301855091f6114eb5512386111ae4331a1`; implementation commit
`5b6fc45326474d59cada52be55054f315f349029`. The reproduced defect was limited
to explicitly named unsupported source: Explore resolved path spans only
against the indexed file catalog, so named PowerShell files were invisible and
installer vocabulary could rank an indexed TypeScript decoy instead.

The bounded correction preserves graph-backed retrieval for indexed files and
adds an Afyx-owned direct-source path for explicit `.ps1`, `.psm1`, and `.psd1`
targets only. Exact/basename ambiguity, missing files, project ignore policy,
lexical traversal, symlink escape, binary content, file count, walk count, and
source length are all enforced before rendering. Direct source is labeled as
non-graph evidence and never fabricates nodes, edges, calls, or semantic
certainty. Open-ended Explore remains graph-backed. CLI and MCP use the same
result path.

Synthetic evidence: before the fix, both CLI and MCP returned only
`src/lib/installer-decoy.ts` and reported no indexed match for
`scripts/install-afyx-graph.ps1`; after the fix, both returned the requested
`install.ps1` and `scripts/install-afyx-graph.ps1` source, returned no decoy,
and had identical normalized 43-line result text. Focused path-pinning passed
16 with one POSIX-only symlink check deferred to Linux CI; adjacent
retrieval/MCP tests passed 43; UI/browser tests passed 53 with three
platform skips; semantic baseline passed six fixtures; CLI/MCP smoke passed
21 checks; TypeScript typecheck and clean production/UI build passed.
Implementation/evidence-head CI `38075108668` and Afyx Graph Build
`38075110506` passed on Windows, Linux, and macOS.

Bounded Windows diagnosis found direct Node MCP startup already uses hidden
child processes and does not traverse the `.cmd` launcher. `ui --no-open`
does not launch a browser. The one relevant `cmd /c start` path was UI browser
auto-launch; it now passes `windowsHide: true`, with spawn-option and UI
lifecycle regression coverage. This is evidence of closing that source of
console creation, not a claim that every third-party console flash was
interactively reproduced.

AFYX-260 does not add PowerShell parsing, change extraction version 27, alter
MCP registration, or complete AFYX-205/AFYX-241. AFYX-248 remains in progress;
AFYX-258 and the remaining lifecycle/observability work remain separate.

### AFYX-258 — Prior extraction-diagnostics checkpoint

Status: **HISTORICAL PARTIAL CHECKPOINT — superseded by Batch 3 below**

The last full-index accounting now persists and is exposed by human and JSON
status output: visible files discovered, eligible/supported files, indexed,
symbol-empty skipped, unsupported, failed, and per-file retry outcomes. Index
completion state, pending references, and pending file changes remain separate
signals. Ignored paths are deliberately not enumerated and are reported as an
unknown count rather than silently conflated with skipped files.

Remaining AFYX-258 work includes broader Git `FRESH/STALE/UNKNOWN` UX, watcher
presentation, and any future opt-in ignored-path inventory. AFYX-251 and
AFYX-255 remain complete; AFYX-248 remains in progress. This batch does not
activate Technical Alpha, Phase 6, formal Alpha, or unrelated post-v1 work.

### Technical Alpha Batch 3 — AFYX-259 / AFYX-256 / AFYX-258

Status: **ACCEPTANCE GATES PASSED; AFYX-248 remains IN PROGRESS**

AFYX-259 adds one revision-aware artifact identity across packaging and
installation. Product version, channel, target, source/build revision, checksum,
installed provenance, requested checkout revision, and extraction version are
kept distinct. Matching cache, stale same-semver cache, explicit unknown-revision
archive, fallback, rollback, and compiled extraction-version checks pass in
isolated lifecycle fixtures. Implementation commit:
`8e74ccdb526ddbe1a055ae3377e343e62ea3ab92`.

AFYX-256 integrates the installed runtime with Codex through native `codex mcp`
commands. It uses absolute Node plus installed JS entry point, preserves
unrelated configuration, skips conflicting/unproven ownership, supports an
explicit no-MCP path, backs up controlled changes, and verifies a real
initialize/tools-list handshake. Missing Codex remains nonfatal to a healthy
Graph runtime. Implementation commit:
`1701688d9872e195c12c2c80f75f385859f106b1`.

AFYX-258 now uses one read-only Index Health contract in CLI JSON/text, MCP, and
the viewer. Git freshness, filesystem/content pending state, extraction
completeness, extraction-version compatibility, pending references, watcher
state, and full-index accounting remain independent. A non-Git project reports
Git freshness `UNKNOWN` without implying extraction failure. Full indexing
persists bounded aggregate skip reasons (including `size_exceeded`), bounded
unsupported-extension evidence, completion timestamp, and measured scan,
parse/store, resolution/link, maintenance, and end-to-end durations. No status
surface rescans solely to obtain skip detail; `ignored` remains `null` / NOT
ENUMERATED. The six previously observed >1 MiB JavaScript skips remain accepted
guard behavior, not extraction failures.

Batch 3 does not enumerate ignored paths, increase the 1 MiB guard, modify
ranking/search semantics, or reactivate formal Odoo/IJP indexing. AFYX-248
remains in progress and Technical Alpha is not activated until mandatory
integrated and cross-platform gates pass.

Final CI closure: AFYX-259 (`8e74ccd`), AFYX-256 (`1701688`), and AFYX-258
(`1656a08`) were validated together after the bounded CI correction
`d0bf81f52186798d82a95caf63ca2a761d809087`. The correction retained the
disabled unrelated MCP-server fixture without embedding an audited legacy
identity token, and made Graph `--validate-only` tolerate an absent runtime
metadata file without creating installation roots. Required focused identity,
component, MCP integration, artifact identity, and lifecycle tests passed.
Final correction-head [CI run 38079830273](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38079830273)
and [Afyx Graph Build run 38079831486](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38079831486)
both passed on Windows, Linux, and macOS. This closes the Batch 3 acceptance
evidence for AFYX-259, AFYX-256, and AFYX-258; it does not close AFYX-248 or
activate Technical Alpha.

### Technical Alpha Batch 4A — AFYX-263

Status: **ACCEPTANCE GATES PASSED; AFYX-248 remains IN PROGRESS**

AFYX-263 menutup residual lifecycle dan supply-chain yang terverifikasi setelah Batch 3. Skill lifecycle sekarang memakai marker ownership dan content digest, canonical containment/reparse guard, transaksi stage/backup/swap/verify/rollback, recovery path untuk swap yang terputus, serta backup di `~/.afyx/backups` dengan batas yang gagal aman tanpa menghapus riwayat. Modified, foreign, malformed, dan unsafe targets dipertahankan secara default dan uninstaller menolaknya.

Prompt Master tetap upstream-owned pada tier yang sama dan kini diambil reproducibly dari commit `2bd92518e26bf659e21e3d9ab90573fcf3ddeccb`; staged `HEAD`, remote, manifest skill, dan clean state diverifikasi sebelum promosi. Release trust kini membedakan checksum integrity, commit-bound release manifest, publisher authenticity, dan build provenance. GitHub release workflow menghasilkan `RELEASE-MANIFEST.json`, menargetkan commit workflow eksplisit, dan menerbitkan GitHub artifact attestations; installer tidak lagi menyebut checksum sebagai authentication.

Final implementation checkpoint `ed40278e80c6bc644de70ae2ed10b3eb30e2d18e`: lifecycle baseline 8/8 PASS; ownership/fault-injection 6/6 PASS; artifact identity/provenance 4/4 PASS; component contract 8/8 PASS (1 host-only skip); MCP integration 4/4 PASS; project detection 14/14 PASS; doctor 10/10 PASS; component/identity/legacy validators PASS; Index Health 3/3 PASS; semantic baseline 6/6 PASS; CLI/MCP smoke 21/21 PASS; clean production/UI build PASS. [CI run 38083699363](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38083699363) dan [Afyx Graph Build run 38083702037](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38083702037) keduanya PASS pada Windows, Linux, dan macOS. macOS menjalankan lifecycle Bash pada system Bash 3.2; Windows menjalankan jalur PowerShell yang didukung workflow. AFYX-263 memenuhi acceptance Batch 4A; ini tidak mengaktifkan Technical Alpha dan tidak menutup AFYX-248.

### Technical Alpha Batch 4B — AFYX-264

Status: **IMPLEMENTED; FINAL-HEAD CI PENDING; AFYX-248 remains IN PROGRESS**

AFYX-264 menambahkan adoption opt-in untuk instalasi Efficient Coding 1.1.0, Odoo Engineering 1.1.0, dan Prompt Master 1.8.0 yang berasal dari era sebelum `.afyx-install.json`. Dua skill Afyx harus cocok dengan digest distribusi historis pada baseline `b0b4d88eb7c42627598de71d6b0bf26317b9a694`. Prompt Master tidak dipercaya berdasarkan version saja: adoption memerlukan origin resmi, checkout bersih, dan HEAD tepat `2bd92518e26bf659e21e3d9ab90573fcf3ddeccb`. Classification `MODIFIED`, `FOREIGN`, atau `UNKNOWN` ditolak.

Action `component=adopt` memverifikasi provenance, containment, path safety, membuat dan memverifikasi backup durable, lalu hanya menambahkan ownership marker; isi skill tidak diganti atau di-upgrade. Dry-run tidak bermutasi dan repeated adoption idempotent. Implementasi migration tersedia, tetapi tidak ada adoption yang dijalankan terhadap instalasi user selama development.

Evidence lokal: focused adoption 4/4 PASS; lifecycle security 6/6 PASS; lifecycle contract 8/8 PASS; component contract 8/8 PASS dengan satu cross-shell host-only skip; PowerShell/Bash syntax PASS; component, identity/legal, dan legacy-independence validators PASS. Final-head cross-platform CI tetap diperlukan sebelum AFYX-264 dipindah ke Done.

### Technical Alpha Batch 4B.1 — AFYX-261

Status: **IMPLEMENTED; ACCEPTANCE REQUIRES FINAL-HEAD CI; AFYX-248 remains IN PROGRESS**

Efficient Coding 1.2.0 mempertahankan correctness-first dan progressive disclosure sambil menambahkan loop `GROUND → LOCATE → REPRODUCE → CHANGE → VALIDATE → REPORT`, reliable bug baseline, cost lens kondisional, approval boundary eksplisit, serta pelaporan proporsional. Direct inspection tetap default untuk target sederhana; Afyx Graph hanya untuk relasi struktural yang material; saat Graph tidak tersedia fallback adalah direct-source search dan CodeGraph dilarang. Headroom tetap selektif dan exact original evidence harus tersedia.

Matriks sintetis enam skenario yang sama memberi baseline 1.1.0 `2/6 FULL` dan kandidat 1.2.0 `6/6 FULL`: known-file grounding, unknown-defect reproduction/stopping, cross-module Graph routing, unavailable-Graph fallback, authorization boundary, dan proportional reporting/noisy evidence. Ini bukti kontrak deterministik, bukan model-quality atau token-savings benchmark; tidak ada klaim penghematan token tanpa pengukuran. Usulan rigid three-search limit, mandatory six-line report, dan major-version 2.0.0 ditolak.

Adoption provenance 1.1.0 tetap dibekukan pada digest historis AFYX-264 dan kini diuji memakai fixture historis terpisah; instalasi pengguna tidak dimutasi. Acceptance memerlukan focused matrix, routing/component/doctor/adoption regressions, validators, dan final-head CI lintas platform.

Evidence lokal: refinement matrix 3/3 PASS (`2/6 → 6/6 FULL`); routing intent 20/20 PASS; routing mutation guard 11/11 PASS; component 8/8 PASS dengan satu host-only cross-shell skip; doctor 10/10 PASS; legacy adoption 4/4 PASS; component, graph identity, dan independence validators PASS; Python syntax dan `git diff --check` PASS. Corpus empat dokumen bertambah dari 751 menjadi 956 kata untuk kontrak baru; provider token usage dan outcome model tidak diukur, sehingga tidak ada klaim penghematan token atau superioritas model.

### Technical Alpha Batch 4B.2 — AFYX-262

Status: **IMPLEMENTED; ACCEPTANCE REQUIRES FINAL-HEAD CI; AFYX-248 remains IN PROGRESS**

Odoo Engineering 1.2.0 mempertahankan version isolation dan sebelas reference Odoo 10–20 tanpa blanket rewrite. Refinement menambahkan corroboration dua supporting signal independen ketika strong version evidence tidak tersedia, unresolved handling untuk konflik, pemeriksaan override/`super`, multi-record/batching/prefetch/N+1, serta batas eksplisit group implication dan `sudo`. Pertanyaan penjelasan sederhana tetap ringan. Kontrak XML inheritance, persisted identifier, Odoo 20 exact-evidence safeguard, dan source/target migration isolation yang sudah benar dipertahankan.

Matriks sintetis enam skenario yang sama memberi baseline 1.1.0 `3/6 FULL` dan kandidat 1.2.0 `6/6 FULL`: Odoo 10 legacy compatibility, Odoo 17 multi-record ORM, Odoo 19 security, Odoo 20 exact evidence, conflicting migration evidence, serta XML/authorization negative behavior. Ini evaluasi kontrak instruksi deterministik, bukan eksekusi Odoo, model-quality benchmark, atau klaim token savings. Major version 2.0.0 dan rewrite sebelas version references ditolak karena tidak dibenarkan oleh perubahan semantik.

Provenance adoption 1.1.0 tetap dibekukan pada digest AFYX-264 melalui fixture historis terpisah; instalasi user, CODEX_HOME, MCP, database, dan IJP tidak disentuh. Synthetic skill evaluation tidak menyelesaikan formal Technical Alpha/IJP testing.

Evidence lokal: refinement matrix 3/3 PASS (`3/6 → 6/6 FULL`); routing guard 11/11 PASS; component contract 8/8 PASS dengan satu host-only cross-shell skip; doctor 10/10 PASS; legacy adoption 4/4 PASS; historical fixture 15/15 blob MATCH; component, graph identity/legal, dan legacy-independence validators PASS; Python syntax dan `git diff --check` PASS. Provider token usage dan outcome model tidak diukur, sehingga tidak ada klaim token savings atau superioritas model.

### AFYX-265 — Windows Git subprocess console closure

Status: **IMPLEMENTED; FINAL-HEAD CI PASS; DEPLOYMENT VALIDATION PENDING; AFYX-248 remains IN PROGRESS**

Baseline `61f041b15cdb2d6f4c29e8eeba4a9ea01f6f1d0f`. Three production
`execFileSync('git', ...)` sites that still used the default
`windowsHide: false` now set `windowsHide: true`:
`readGitExcludeExtraPatterns()`, `listGitIgnoredDirectories()`, and
`gitUserName()`. Arguments, cwd, stdio, timeout, maxBuffer, result handling,
and fallback behavior are unchanged; no caching or lifecycle refactor was made.

The Windows `mcp-initialize.test.ts` teardown previously requested `SIGKILL`
and immediately removed the child's temporary cwd. Because `child.kill()` does
not wait for process handles to close, all assertions could finish before
cleanup failed with `EPERM`. Teardown now awaits the child `close` event before
`rmSync`, without delay or failure suppression. Focused extraction/ignore/Trails,
MCP initialize and catch-up, negative Git cases, TypeScript typecheck,
production/UI build, and the 19-call production Git console-visibility audit
pass on the source candidate. Windows visible-window observation recorded no
visible or foreground console window during repeated ignore/scope Git paths.
The installed runtime and active MCP configuration remain unchanged.

Implementation commit `940b772a6be6e8dac09397726f27da7130382f02` passed
[CI run 38127465410](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38127465410)
on Windows, Linux, and macOS. Controlled deployment and actual installed Codex
MCP Windows validation remain required. AFYX-265 must not move to Done until
those deployment gates pass.

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

## V1 Maturity / Test Milestones

These milestones define when Afyx may move from internal engineering into
progressively broader real-use testing. They do not replace the numbered phases;
they are release-maturity gates layered on top of them.

```text
CURRENT DEVELOPMENT
  |
  +-- Phase 5 complete / Phase 5I PASS
  |     |
  |     +--> TECHNICAL ALPHA
  |
  +-- Phase 6 + Phase 7 complete
  |     |
  |     +--> ALPHA
  |
  +-- Phase 8 + Phase 9 complete
  |     |
  |     +--> PRIVATE BETA READINESS
  |              |
  |              +--> Phase 10 — Private Beta
  |
  +-- Phase 10 exit gates PASS
        |
        +--> Phase 11 — STABLE AFYX v1.0
```

### Technical Alpha

Entry gate:

- Phase 5F product viability and final artifact audit: PASS.
- Phase 5G identity/artifact eradication: PASS.
- Phase 5H license closure: PASS.
- Phase 5I final independence audit: PASS.
- `AFYX_FULLY_INDEPENDENT = TRUE`.
- install -> first run -> init real workspace -> index -> query -> MCP ->
  restart/reopen -> incremental sync has proven PASS from the actual product
  artifact.

Purpose:

- daily internal use by the developer on real projects.
- discover product-flow, installer, init/index, runtime, persistence, MCP, and
  workflow defects as early as possible.
- bugs and rough ergonomics are expected; release stability is not yet claimed.

### Alpha

Entry gate:

- Technical Alpha has no unresolved blocker preventing normal daily use.
- Phase 6 Unified Kit & Provider Control Plane: PASS.
- Phase 7 Engineering Assurance: PASS.
- installer/update/verify lifecycle and evidence-based engineering safeguards are
  usable enough for repeated real work.

Purpose:

- sustained real-project use by the developer and selected technical testers.
- validate daily workflow, lifecycle/control-plane behavior, diagnostics, and
  assurance before broader beta exposure.
- product may still contain known non-release-blocking defects.

### Private Beta

Readiness gate:

- Alpha evidence is sufficient to continue.
- Phase 8 real-world dogfood/comparative proof: PASS.
- Phase 9 product hardening/release engineering: PASS.
- no unresolved release-blocking install/init/runtime/data-integrity defect.

Execution:

- Phase 10 is the canonical Private Beta phase.
- use controlled private users and real environments.
- stabilize installer/runtime/configuration/upgrade behavior and triage
  release-blocking defects.

### Stable v1

Entry gate:

- Phase 10 Private Beta exit criteria: PASS.
- all Phase 11 stable-release gates: PASS.
- no unresolved critical correctness/security or release-blocking defect.

Release:

> **Afyx Code Engineering Kit v1.0.0 — Stable**

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

Release maturity:

> Completion of Phase 6 and Phase 7, with Technical Alpha free of blocking
> daily-use defects, opens the **Alpha** testing milestone.

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

Release maturity:

> Completion of Phase 8 and Phase 9 opens **Private Beta readiness**. Phase 10
> is the canonical execution phase for that Private Beta.

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

Version / maturity path:

```text
internal development
  -> Technical Alpha   (after Phase 5I)
  -> Alpha             (after Phase 6 + Phase 7)
  -> Private Beta      (Phase 10, after Phase 8 + Phase 9)
  -> stabilization / release candidate
  -> v1.0.0 Stable     (Phase 11)
```

# Post-v1 expansion program

Status: **PLANNED — NOT A V1 RELEASE BLOCKER**

The frozen post-v1 track order is:

```text
TRACK A — AFYX FORGE
TRACK B — PLATFORM GENERALIZATION
TRACK C — ENGINEERING INTELLIGENCE EXPANSION
TRACK D — AFYX NATIVE ENGINE OPTIMIZATION
```

Tracks are ordered by the canonical product-development contract above. Track
letters must not be reassigned. Work may still be prioritized by measured value
once dependencies permit.

The optimization sequence is intentionally two-generation:

```text
Generation 1 — Independence
  behavior harvest
  -> independent Afyx-native reimplementation
  -> stable v1 product

Generation 2 — Native optimization
  mature Afyx-native workloads
  -> profile / measure
  -> evidence-driven redesign
  -> optimized Afyx-native engine
```

Track D does not postpone obvious optimization until post-v1. V1 must still fix
clear waste, pathological complexity, correctness-affecting inefficiency,
duplicate context, unnecessary I/O, and material regressions when evidence
justifies the change. Track D is the later deep systematic optimization program
that operates after Forge, provider generalization, and broader intelligence
support have created a more representative production workload.

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

## Track D — Afyx Native Engine Optimization

Status: **PLANNED — POST-v1**

Goal:

> Evolve Afyx Graph from an independently reimplemented native engine into an
> evidence-driven, deeply optimized native engine using real production
> workloads rather than historical implementation constraints.

Track D is not a second rewrite of CodeGraph. It starts from Afyx-owned behavior,
architecture, and workload evidence.

Canonical optimization rule:

```text
measure
  -> profile
  -> identify the real bottleneck
  -> redesign/optimize the Afyx-native layer
  -> re-benchmark
  -> retain only quality-safe, material improvements
```

Hard constraints:

- correctness and precision remain hard gates;
- do not optimize by starving context required for a correct result;
- do not reproduce historical architecture merely for parity;
- do not retain benchmark-only complexity whose gain is within noise;
- optimize actual Afyx workloads, including Forge/provider/intelligence usage;
- prefer algorithmic/work-avoidance gains over cosmetic micro-optimization;
- large-repository and workspace scaling is a first-class target;
- token efficiency means maximizing useful information per unit of context and
  eliminating repeated/irrelevant work.

Canonical phases:

- **D0 — Optimization Baseline Freeze**
  - freeze representative post-v1 workloads and reproducible benchmark methods;
  - preserve correctness/output digests and environment metadata.
- **D1 — Production Workload Harvest**
  - collect representative Forge, provider, language, framework, large-repo, and
    monorepo workload shapes.
- **D2 — CPU / Memory / I/O Profiling**
  - identify actual hotspots, allocation pressure, persistence cost,
    serialization cost, worker contention, and I/O waste before deep code
    changes.
- **D3 — Indexing & Incremental Sync Optimization**
  - reduce unnecessary scanning, reads, hashing, extraction, normalization,
    resolution, persistence, and incremental dirty-set work.
- **D4 — Graph Storage & Query Optimization**
  - optimize storage/query/index strategy only where profiling proves material
    product cost.
- **D5 — Search / Resolution / Traversal Optimization**
  - reduce unnecessary graph work while preserving or improving relevant-result
    recall, precision, and relationship correctness.
- **D6 — Context & Explore Efficiency Optimization**
  - maximize relevant information density;
  - minimize irrelevant source, duplicate bytes, unused budget, fallback Reads,
    and avoidable context expansion.
- **D7 — MCP / Daemon / Concurrency Optimization**
  - optimize startup, steady-state dispatch, worker/daemon coordination, and
    concurrent-client behavior based on real contention evidence.
- **D8 — Memory & Artifact Footprint Optimization**
  - reduce peak memory, retained state, serialization overhead, package size,
    and runtime footprint where the change is materially useful.
- **D9 — Large Repository / Monorepo Optimization**
  - evaluate scaling behavior across increasing repository/workspace sizes and
    remove poor-complexity paths or whole-repository work where avoidable.
- **D10 — Token & Tool-Efficiency Optimization**
  - optimize successful-task cost across context tokens, tool calls, file reads,
    duplicate reads, validation executions, and rework;
  - quality/output correctness must remain equal or better.
- **D11 — Integrated Performance Campaign**
  - compare the optimized engine against frozen Afyx-native pre-optimization
    baselines on identical tasks, environments, and correctness gates.
- **D12 — Native Optimized Stable**
  - freeze the optimized engine contract after measurable gains and diminishing
    returns justify stopping.

Track D stopping rule:

> Stop when correctness/precision are stable, material bottlenecks have been
> addressed, repeated optimization iterations produce only noise/non-material
> gains, or the next gain would impose disproportionate complexity or
> maintenance cost.

Track D is where Afyx moves beyond **native replacement** into **native
architectural optimization** based primarily on Afyx's own data.

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

Tracks A, B, C, and D begin only after the stable v1 boundary unless
maintenance of a v1 guarantee requires otherwise. Their execution is
prioritized by measured product value while the canonical track identities/order
remain fixed.

Canonical dependency intent:

```text
A — Forge
  -> exposes adaptive engineering workloads

B — Platform Generalization
  -> exposes provider-neutral and cross-provider workloads

C — Engineering Intelligence Expansion
  -> broadens language/framework/data/build/runtime workloads

D — Native Engine Optimization
  -> profiles and optimizes the mature Afyx-native engine against those broader
     representative workloads
```

Tracks A/B/C may have limited overlap where dependencies permit; Track D should
consume their mature workload evidence rather than optimize against a narrow,
historical-only fixture set.

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

### AFYX-268 — Git global-excludes catch-up correctness

Status: **ENGINEERING AND ISOLATED ARTIFACT ACCEPTANCE PASS; AFYX-248 IN PROGRESS**

The retained AFYX-265 fixture proved Git's ground truth for `.gitignore`, `.git/info/exclude`, and `core.excludesFile`; it also self-healed the suspect global-excludes row on a later reconciliation. A fresh absolute-path source reproduction and a pre-opened QueryPool both stayed correct, so the AFYX-265 console fix and query-worker visibility were not changed. Focused negative regressions then isolated two deterministic incremental-scope defects: repository-relative `core.excludesFile` paths were tested against the process cwd instead of the repository cwd, and the scoped-sync matcher cache omitted the effective global-excludes path/content state. A newly created ignored directory could therefore be admitted after the matcher was warmed, or after the external excludes file changed.

The bounded fix resolves relative paths from the repository root while preserving `~`/absolute handling, and includes the effective excludes path plus mtime/size in scoped matcher invalidation. Existing Git arguments, `windowsHide`, timeouts, stdio, error handling, full-index discovery, MCP lifecycle, and AFYX-265 console-suppression behavior remain unchanged.

Focused evidence: the new global-excludes lifecycle matrix passes 4/4 after failing 2/2 before the fix; it covers initial/full indexing, scoped create/modify/rename/delete, restart/persistence, `.gitignore`, `.git/info/exclude`, absolute/relative `core.excludesFile`, unset/missing/non-file configuration, positive files, and supported stale-row reconciliation. Existing extraction ignore checks pass 3/3, watcher info/exclude 1/1, scoped-sync exclusion 1/1, MCP catch-up gate 7/7, and the frozen sync/watcher contract 87/87. TypeScript typecheck, clean production/UI build, semantic baseline 6/6, CLI/MCP smoke 21/21, Afyx identity validation, and legacy-identity audit pass locally. Implementation commit `1c9a9c4dac8b75a3e384509d6f038c2de3720e25` passed [Afyx Graph Build 38130937586](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38130937586) on Windows, Linux, and macOS. An official-bundle-format Windows runtime installed under a disposable `%TEMP%` root reported revision `MATCH`, passed Git-grounded scope/reconciliation/restart acceptance, and passed installed CLI/MCP smoke 21/21. The active installed runtime and MCP configuration were not changed. AFYX-268 engineering acceptance is complete; AFYX-248 remains in progress.

### AFYX-266 — Scoped dependency security remediation

The immutable accepted Alpha candidate remains
`a431ba9ad5fae7bd06329f1fc6e42f1ba503f6dd`; this remediation is confined to
the development branch and requires review before any Alpha promotion.

The authoritative pre-change npm audit reported **10 affected development/build
package records: 2 critical, 5 high, 3 moderate** and **zero production-scope
findings**. The records were Vitest (`GHSA-5xrq-8626-4rwp`,
`GHSA-82fw-gwwq-j7x9`), `@vitest/mocker` (`GHSA-82fw-gwwq-j7x9`), Tinypool
(`GHSA-5gmw-xhrv-c9v3`, `GHSA-85c8-ppgw-ccpr`), Vite
(`GHSA-4w7w-66w2-5vf9`, `GHSA-v6wh-96g9-6wx3`,
`GHSA-fx2h-pf6j-xcff`), esbuild (`GHSA-67mh-4wv8-2f99`), PostCSS
(`GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`,
`GHSA-fxqj-rqcc-2cmp`, `GHSA-r28c-9q8g-f849`), Nanoid
(`GHSA-28wg-ghj8-5hjv`, `GHSA-2v37-7h3g-55p8`,
`GHSA-xwg4-73v4-xw9w`), Rollup (`GHSA-mw96-cpmx-2vgc`), and
source-map-js (`GHSA-68fv-2mgg-jv7q`).

The smallest compatible dependency closure moves Vitest `2.1.9 -> 4.1.11`,
adds its fixed direct Vite peer at `6.4.3`, and resolves PostCSS
`8.5.6 -> 8.5.29`, Nanoid `3.3.11 -> 3.3.20`, Rollup
`4.57.1 -> 4.64.5`, source-map-js `1.2.1 -> 1.2.2`, and esbuild
`0.21.5 -> 0.25.12`. The vulnerable Tinypool and vite-node records leave the
tree. UI Vite remains `7.3.6` with UI esbuild `0.28.2`; no override is used.
Post-change full and production-only npm audits both report **0 findings**.

Vitest 4 no longer auto-discovers `vitest.workspace.mts`; the equivalent
engine/node and UI/jsdom split now uses `test.projects` in the root config.
The engine keeps its existing isolation and receives a 10-second test budget
for the upgraded runner. Two failure-injection assertions now mutate the
existing mocked functions rather than spying on ESM namespace properties,
preserving their original observable contract under Vitest 4.

Runtime support remains Node `>=22.5.0`. Release builds effectively require
Node `>=22.12.0` because the intentionally retained UI Vite `7.3.6` has that
build-time floor; CI uses Node 24. npm 11 reports the esbuild `0.25.12` and
`0.28.2` install scripts as not approved by `allowScripts`. No script policy or
global npm policy was changed: clean install and clean production/UI build
succeed through the package's optional platform binaries.

Release-critical Actions are pinned to reviewed immutable revisions:
`actions/checkout@11d5960a326750d5838078e36cf38b85af677262` (`v4.4.0`),
`actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020` (`v4.4.0`), and
`actions/attest-build-provenance@e8998f949152b193b063cb0ec769d69d929409be`
(`v2.4.0`). Alpha promotion must also retain its already-reviewed
`actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02`
(`v4.6.2`) pin.

Local evidence on the supported contract includes clean install, typecheck and
clean production/UI build PASS; focused Vitest 4 UI **21/21** and git-currency
**13/13** PASS; semantic baseline **6/6** PASS; CLI/MCP smoke **21/21** PASS;
artifact identity/legal **12/12** PASS; component, independence, identity and
legal validators PASS. A full local run on unsupported Node 26 completed
**5647 PASS / 34 FAIL / 31 SKIP**: failures were Windows open-handle cleanup,
load-sensitive timeouts/performance assertions, and one Windows `which`
fixture, while supported final-head Node 24 CI remains the acceptance authority.
Implementation commit `5989661b1444c4f30d37fb1fafddd5ae3023379c`
passed [engineering-kit CI 38155025673](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38155025673)
and [Afyx Graph Build 38155028757](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38155028757)
on Windows, Linux, and macOS. The exact-revision Windows candidate archive
(`win32-x64`, SHA-256
`a55083939d4fa04824133b7fabaa0117e2a8027a2561491e48c76a9077853d01`)
passed bundle/manifest verification and isolated installation: source revision
`MATCH`, release manifest `VERIFIED`, build provenance
`COMMIT_BOUND_MANIFEST`, CLI `1.0.0`, state `HEALTHY`. Publisher authenticity
remains **UNVERIFIED**. AFYX-266 engineering closure is ready for review; it
does not mutate or promote the frozen Alpha candidate and does not replace the
active installed runtime.

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

After v1, evolution follows Track A / Track B / Track C / Track D without
reopening the v1 feature contract unless maintenance of an existing v1
guarantee requires it.

### AFYX-280 — Graph discovery coverage and completeness

Status: **ENGINEERING CLOSURE PASS; AFYX-272 MAC.4 REMAINS SEPARATE; AFYX-248 IN PROGRESS**

The AFYX-272 report of four Graph-assisted files versus nine direct-source
declarations is not reproducible as a comparable measurement because the
original query, tool response, result limit, indexed revision, and execution
environment were not recorded. A disposable Git-backed Python fixture at
development baseline `908e56d63ba2e5b38bb557a28e2b88325204f101` established
nine direct `_inherit = 'sale.order'` declarations, multiline syntax, negative
comment/string/unrelated-model cases, and a Git-ignored declaration. Initial
indexing was complete (10 eligible/indexed Python files, 0 failed), and all nine
target files were present in ranked discovery while the ignored file remained
excluded. Literal `sale.order` search also admitted negative metadata matches,
confirming that this command is ranked symbol-metadata discovery rather than an
exhaustive source-declaration query.

The controlled `limit: 4` MCP case confirmed a separate generic presentation
defect: MCP requested exactly four rows and labelled them `4 found`, unlike the
CLI's existing one-extra-row truncation detection. The MCP adapter now fetches
one extra ranked result, renders `N shown`, reports truncation and the supported
limit widening path, and explicitly says ranked symbol search is not an
exhaustive source-declaration inventory. Ranking, extraction, indexing, CLI
JSON shape, and Odoo-specific semantics were not changed. Focused Search/MCP
contract tests, clean typecheck/UI build, semantic baseline, and CLI/MCP smoke
provide the engineering acceptance evidence. No active runtime, MCP
configuration, Alpha branch/candidate, Adit environment, or IJP repository was
modified. Formal AFYX-272 MAC.4 remains unverified and must not be marked PASS
from this investigation.

### AFYX-282 — Native Graph source-intelligence refinement

Status: **IMPLEMENTED; FINAL-HEAD GRAPH BUILD REQUIRED; AFYX-248 IN PROGRESS**

Root cause was layered: the native Python extractor indexed classes and methods but omitted direct class assignments, the Node contract had no structural fact for `_inherit`, ranked FTS search could only return bounded metadata candidates, and default MCP instructions incorrectly encouraged treating ranked exploration as universally exhaustive. The SQLite schema itself was sufficient: source-located `property` nodes with exact class ownership and literal signatures fit the existing node/persistence contract, so no schema migration was introduced. Extraction version advances to 28 so older indexes explicitly request re-indexing.

The new generic Python class-assignment fact supports scalar and multiline list/tuple string literals. Dynamic/aliased expressions remain unresolved and are never converted into invented values. `afyx_graph_inventory` and `afyx-graph inventory` provide exact value matching, project-relative scope, stable source locations, exact totals across declarations/files/modules, bounded pagination, and explicit extraction/failure/skipped/unsupported/ignored/stale coverage. A limited page is labelled incomplete. Existing ranked search/explore behavior remains available for navigation and relationships; default MCP now exposes inventory plus explore and routes hybrid requests to enumerate first.

Owned Odoo-like ground truth covers nine Odoo-17-style declarations and forty-five Odoo-20-style declarations (44 scalar plus one list-form), duplicate class names, multiple declarations per file, multiline values, `_name`, `sale.order.line`, comments/strings, dynamic expressions, ignored and sibling paths, catch-up, create/modify/delete/rename, restart, path refusal, pagination, worker dispatch, and existing ranked-search/explore regressions. These synthetic fixtures validate the product contract only; they are not real IJP/Odoo acceptance, do not establish runtime registry behavior, and do not change AFYX-272 MAC.4.

### AFYX-281 + AFYX-282 — Final engineering acceptance closure

Status: **ENGINEERING ACCEPTANCE PASS; AFYX-248 AND MAC.4 REMAIN IN PROGRESS**

AFYX-281 Linux Graph Build failures (`112.72 ms` and `100.96 ms` against a `100 ms` assertion) retained every functional contract: 500+ true callers, 300 shown, truncation, count parity, uniqueness, and blast-radius parity. Bounded focused reproduction did not demonstrate a product slowdown. The assertion measured loopback HTTP wall time under shared-runner load, which cannot distinguish a batched implementation from N+1 reads. The regression contract now observes the database access shape directly: one focal lookup, one 500-caller batch, and fan-in batches for the 300 displayed rows. Product behavior and thresholds are unchanged.

AFYX-282 had incorrectly incorporated extraction-v28 `_inherit` property facts into the pre-independence semantic snapshot. The historical file is restored byte-for-byte to the digest recorded by `semantic-baseline.meta.json`, with repository attributes pinning its checkout to LF so the same byte identity is enforced on Windows, Linux, and macOS. A separate deterministic additive contract verifies the exact two property facts and two class-containment edges, removes only those additions, and then compares all six fixtures with the unchanged historical oracle. A controlled unrelated TypeScript file-count mutation still fails the historical gate. Canonical `--write` is refused; disposable snapshots require an explicit alternate path.

AFYX-280 boundary validation confirmed `limit + 1` over-fetch and handwritten-before-generated composition. It also reproduced a presentation defect near the shared output bound: a tail-positioned completeness notice could be trimmed. The notice now precedes result rows, so bounded output retains both the ranked-search incompleteness warning and the generic character-truncation marker. Ranking and result composition are unchanged.

Focused regressions, typecheck, clean production/UI build, the six-fixture semantic baseline, 21-check CLI/MCP smoke, identity/component/independence validation, and artifact-identity tests passed. Exact-source-head [Afyx Graph Build 38324265023](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38324265023) passed on Windows, Linux, and macOS. AFYX-281 and AFYX-282 engineering acceptance is complete; this does not activate Technical Alpha or complete AFYX-248 or AFYX-272 MAC.4.

### Repository knowledge catalog acceptance

Status: **ENGINEERING ACCEPTANCE PASS; AFYX-248 IN PROGRESS**

Read-only Odoo 17 evidence confirmed the full-index accounting contract:
93,003 discovered, 42,130 eligible, 42,123 indexed, 6 size-skipped, 50,873
unsupported, and one parser-timeout failure. The previously reported 807
records are not 807 failed files: they contain 901 diagnostics, comprising 800
warning-only `native_incomplete_source` files, six warning-only
`size_exceeded` files, and one error-severity `parse_error` file. Independent
Python AST ground truth found the same nine scoped literal
`_inherit = 'sale.order'` declarations, paths, classes, and lines as Graph.

Inventory coverage now distinguishes scoped Python diagnostics from global
file-record diagnostics and separates error-severity files from warning-only
files. A localized failure outside the requested scope no longer makes a clean
scope look incomplete; any Python extraction diagnostic inside the scope, an
unlocated full-index failure, partial/failed index state, stale extraction, or
bounded page still preserves the conservative limited/partial verdict. Exact
inventory remains static supported-literal evidence rather than the Odoo
runtime registry.

The Odoo 17 dependency file `winerror.py` completed in an isolated one-file
index (7,250 nodes, 7,266 edges, 56.7 seconds), so the prior 60-second timeout
is a load-sensitive large-file limitation rather than a deterministic parser
failure. No timeout or dependency-exclusion policy changed. Its full-index
completion timestamp and a later freshness/sync timestamp remain distinct.

Odoo 17 has an empty/non-functional `.git` directory, so null Git-head
freshness is correctly `UNKNOWN`, not silently fresh. A bounded locking fixture
confirmed WAL readers proceed during an active WAL writer, while an exclusive
MEMORY-journal writer makes a concurrent open fail with `database is locked`;
this is the fresh-build isolation boundary. The Odoo 19 log preserves that
initial open failure and shows successful retry, watcher startup, catch-up,
subsequent syncs, complete index state, zero pending references, and WAL mode.
No writer coordination, daemon lifecycle, schema, parser, ranking, or timeout
change was justified by this acceptance slice.

Implementation commit `8837ea98aa63a4c93a2c15c599f82148ad3320b0`
passed exact-source-head [Afyx Graph Build 38357255978](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38357255978)
on Windows, Linux, and macOS, including clean build, unit tests, semantic
baseline, CLI/MCP smoke, installer verification, identity, attribution, and
operational-independence gates. This closes only the repository-knowledge
engineering acceptance boundary; it does not promote Alpha or complete
AFYX-248.

### Afyx Engineering Expert v0.1.0 — native Kit integration

Status: **IMPLEMENTED; FINAL-HEAD CI REQUIRED; AFYX-248 IN PROGRESS**

The first-party source package
`afyx-engineering-expert-kit-ready-v0.1.0.zip` was accepted only after its
SHA-256 matched
`fe762234d8d21819b53a9963fa37e682635e142d6d4735066f9d692cbeaf0350`.
All 22 safe relative members are strict UTF-8 and the normalized source-tree
digest is
`9ebefe30bf9c7f73b101a53542b3cb09c993cfe9a4d565d15afc5834465569b7`.
The unchanged source tree is bundled as the optional Afyx-owned
`afyx-engineering-expert` 0.1.0 component: one adaptive orchestrator, thirteen
domain references, six workflows, and one result template. No legacy-adoption
claim was created.

PowerShell and Bash lifecycle paths now support explicit install, update,
repair, skip, dry-run/WhatIf, ValidateOnly, verified ownership, transactional
backup/rollback, read-only verifier/doctor reporting, and independently scoped
uninstall. A missing optional Expert installation does not affect core
readiness. Deterministic routing keeps ordinary coding with Efficient Coding,
version-specific Odoo implementation details with Odoo Engineering, and prompt
authoring with Prompt Master; substantive product/architecture, security,
incident/reliability, AI/data, and ERP process advisory can route to Expert.
Simple questions do not route to Expert.

Bundle, component, lifecycle, security, legacy-adoption, doctor, routing,
Graph validator, identity, and evaluation-harness checks pass locally. An
isolated advisory-only Odoo agent run exited successfully, preserved its
fixture, and produced an advisory response. It attempted to read both Expert
and Odoo skill manifests, but the read commands were rejected by the isolated
sandbox before either manifest was loaded; therefore actual functional skill
activation remains **NOT VERIFIED** and is not inferred from response quality
or static routing.

No active skill installation, `CODEX_HOME`, MCP configuration, Graph runtime,
Alpha branch/candidate, PR #59, Adit environment, or IJP repository was
modified. Final-head cross-platform engineering CI remains required before
this integration can be reported complete.

### 2026-10-13 correction — Expert integration, activation evidence, and AFYX-283

Status: **AFYX-284 DONE; AFYX-283 HARNESS REPAIRED / PILOT BLOCKED; AFYX-248 IN PROGRESS**

AFYX-284 native Kit integration is DONE. The implementation and documentation
head `7fab789af6e0e1c122a2744210ca0f13cbfbac01` passed exact-head
[Engineering/Graph Build 38357724286](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38357724286)
on Windows, Linux, and macOS. This correction supersedes only the earlier
pending-CI wording; it does not alter the accepted 22-file Expert v0.1.0 source.

Functional Activation Smoke Test v2 produced observable host evidence. Case A
successfully read Expert `SKILL.md` but loaded seven domain references and zero
workflows, violating the intended progressive-disclosure boundary; it remains
**FAIL/open**. Case B passed Expert + Odoo Engineering composition. Case C
passed negative routing for a simple Python question. Case D was unnecessary.
Two experimental v0.1.1 refinements still loaded six references and zero
workflows, so they were rejected and reverted; no Expert source optimization is
accepted from those experiments.

AFYX-283 extends the existing Phase 3A JSON harness rather than creating a
parallel evaluator. Historical `environment.json` and result evidence remain
unchanged. The active Expert fingerprint records Efficient Coding 1.2.0, Odoo
Engineering 1.2.0, Expert 0.1.0, verified Prompt Master checkout identity,
Codex 0.156.1, and explicit runtime/permission flags. All four installed Afyx
skills are disabled per session before only the selected frozen configuration
is copied to an external disposable workspace. `X`/`CORE_X` and formal
`A0=N`, `A1=CORE`, `B0=X`, `B1=CORE_X` aliases are defined. Successful
activation now requires observed `SKILL.md` content from a completed host event;
mentions, failed reads, and unavailable events are not treated as activation.

Deterministic isolation/configuration/fingerprint tests and static preflight
pass. The required actual-session evaluator canary timed out twice (180 seconds
and 120 seconds) without any command/read event. It therefore records
**BLOCKED**, not PASS. No development pilot or formal A1/B1 comparison was run.
Until a canary proves evaluator ground truth inaccessible and the bounded pilot
is calibrated, formal comparative acceptance is **BLOCKED**. AFYX-249's formal
Alpha gate is unchanged, and neither AFYX-248 nor Technical Alpha is complete.

### 2026-10-13 AFYX-283B — child diagnostics and actual isolation checkpoint

Status: **HARNESS DIAGNOSTICS REPAIRED / ACTUAL ISOLATION BLOCKED / PILOT NOT RUN**

The original 120–180 second canary timeouts were not evidence of filesystem
denial. A minimal no-skill child showed that the process started, emitted
`thread.started` and `turn.started`, then could not reach the provider inside
the parent network sandbox. The same bounded command with provider access
completed successfully using the frozen `gpt-5.6-sol` / OpenAI / medium
fingerprint. This separates startup and provider health from isolation.

The harness now uses bounded `Popen` execution, preserves redacted partial
JSONL/stderr, classifies startup/authentication/model/network/timeout failures,
and terminates only its owned process tree. The reproduced Windows timeout used
a kill-on-close Job Object and left no owned child running. Pilot mode defaults
to one repetition; benchmark mode retains its three-repetition minimum.

The actual isolation control remains **BLOCKED**. The child runtime rejected
all `exec_command` operations before process creation, including the positive
read of a disposable file inside the authorized repository. Four external
attempts were requested; sandbox-router denial was observed for canary,
manifest and rubric, while the final private-holdout attempt did not complete
before the 45-second bound. No external read succeeded and the randomized
canary value was not exposed, but negative denial without a successful positive
control cannot prove the intended trust boundary. Cleanup completed through the
Windows Job Object. The five DEVELOPMENT pilot scenarios and formal A1/B1 were
not run. The remaining prerequisite is a genuinely restricted execution
boundary (restricted OS account, isolated container, or filesystem ACL) that
allows the evaluated workspace and denies evaluator-only files; Expert v0.1.0
is unchanged.

### 2026-10-13 AFYX-283C.1 — canary/workload parity correction

Status: **DETERMINISTIC CORRECTION IMPLEMENTED / HOST ISOLATION NOT VERIFIED / PILOT NOT RUN**

The AFYX-283B canary and evaluation cells did not use the same workspace
construction: cells ran from `%TEMP%/afyx-eval-*/work`, while the canary ran
under repository-local `evals/results/.isolation-work-*`. The earlier nested
result therefore diagnosed command-policy interference but could not establish
the filesystem boundary used by real evaluation workloads.

AFYX-283C.1 gives cells and canary one shared external disposable-workspace
constructor. The positive attempt flag now derives only from its own observed
tool event. Confirmed evaluator-only read success or canary exposure has `FAIL`
precedence over missing positive evidence, timeout, or other `BLOCKED`
conditions. Bounded execution, redacted evidence, and owned process-tree
cleanup remain unchanged. Deterministic regressions cover workspace parity,
allowed reads, unrelated tool activity, unauthorized reads, marker exposure,
and result precedence.

No direct-host control or DEVELOPMENT pilot was executed from the developer
sandbox. Actual isolation remains **NOT VERIFIED** until the corrected procedure
runs from a trusted PowerShell host and supplies sanitized evidence. Expert
v0.1.0, formal A1/B1, installed components, CODEX_HOME, Graph runtime, PR #59,
the frozen Alpha candidate, and private evaluation material remain unchanged.

### 2026-10-14 AFYX-283C.5 — Windows child launcher and runtime fingerprint repair

Status: **ENGINEERING PASS / DIRECT-HOST ACCEPTANCE PENDING / PILOT NOT RUN**

Independent Windows Terminal evidence identified two concrete defects. Host
Codex was authenticated at 0.162.1, while the frozen fingerprint still declared
0.156.1 and preflight did not verify the installed version. Python resolved the
npm launcher to `codex.CMD` and passed it directly to `Popen(shell=False)`,
producing `WinError 2`; the child never started and the displayed isolation JSON
belonged to an older run.

The runner now dispatches a Windows npm `.CMD` launcher through its sibling
`codex.ps1` using PowerShell `-File` and a discrete argv. No shell command is
constructed, argument boundaries are preserved, and missing safe shim support
fails closed. Direct executable behavior on Linux/macOS is unchanged. Bounded
timeouts and owned process-tree cleanup remain intact.

Codex CLI 0.162.1 passed non-model compatibility checks for the exact harness
flags and command options. A new explicit 0.162.1 runtime fingerprint is active;
the historical 0.156.1 fingerprint and all Expert/skill hashes are preserved.
Frozen preflight now checks the installed CLI version and command contract
before model execution. Child-health and isolation records carry one
`control_run_id`; blocked health overwrites current isolation as
`NOT_EXECUTED`, preventing stale evidence reuse.

No canary or DEVELOPMENT pilot was executed inside the developer sandbox.
Direct-host isolation remains **NOT VERIFIED** until the corrected PowerShell
procedure is run by the user. Expert v0.1.0, installed components, CODEX_HOME,
Graph, PR #59, the frozen Alpha candidate, and customer repositories remain
unchanged.

### 2026-10-14 — AFYX-283C.8 execution boundary correction

Status: **EXECUTION BOUNDARY PASS / DEVELOPMENT PILOT GO (NOT RUN)**.
Independent-host evidence reproduced command-router rejection under legacy
`--sandbox workspace-write`; the positive command never reached CreateProcess,
so generic router denials did not prove filesystem isolation. Codex CLI 0.162.1
passed the official one-command MXC compatibility probe (`MXC_OK`). A disposable
default-deny permission-profile proof established workspace read exit `0` and
evaluator-only sibling read exit `1` (`Access is denied`), with no private marker
exposure, including when both paths were under OS temp.

The harness now selects an explicit root-deny, minimal-runtime-read,
workspace-write, temp-deny, network-disabled permission profile and native MXC
on Windows. Legacy `--sandbox` is removed because it disables permission-profile
mode. Historical fingerprints and Expert v0.1.0 hashes remain unchanged.

The exact host harness then passed child/provider health, a completed command
event, the workspace read, and all four evaluator-only denials. No unauthorized
read, canary exposure, timeout, or orphan cleanup occurred. A direct MXC write
control also created a workspace file while evaluator-only write failed and
created nothing. The positive read uses its absolute workspace path because
the first corrected run proved the permission boundary but also showed that
the child command's relative working-directory assumption was false.

The accepted architecture uses a trusted host-side evaluator controller and
two disjoint MXC roots: one disposable root for the evaluated agent and one
development root for any developer agent. The private holdout/rubric root is
outside both and denied by the same root-deny profile. The controller alone
retains ground truth. A1 and B1 must use the identical profile and permissions.
No real holdout, DEVELOPMENT pilot, or formal A1/B1 was run in this checkpoint.
Focused regression and exact-head CI remain engineering closure gates.
