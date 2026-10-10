# Afyx v1 Master Roadmap

Status: **Phase 5 complete**
Canonical since: **2026-10-03**  
Contract revision: **2026-10-10**
v1 scope policy: **FROZEN — Phase 1 through Phase 11**  
Post-v1 policy: **PLANNED EXPANSION — not a v1 release blocker**

Current work: **Phase 5I — Final Independence Audit (COMPLETE)**
Task: `AFYX-91852`  
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
