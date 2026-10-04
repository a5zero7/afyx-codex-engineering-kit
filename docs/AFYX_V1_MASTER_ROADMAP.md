# Afyx Code Engineering Kit — Final Development Roadmap Contract

**Status:** CANONICAL DEVELOPMENT CONTRACT  
**Canonical since:** 2026-10-03  
**Contract revision:** 2026-10-04  
**v1 scope policy:** **FROZEN — Phase 1 through Phase 11**  
**Post-v1 policy:** **PLANNED EXPANSION — not a v1 release blocker**  

## Current execution position

- Current major phase: **Phase 5 — Afyx Native Full Independence**
- Current subphase: **Phase 5F — Third-Party Source / Runtime Replacement**
- Current task: `AFYX-91852`
- Canonical merged main baseline: `ebe34a2b3781c664713a362714ccb92bba2bc8e6`
- Active implementation branch: `afyx/native-phase5f-parser-grammar`
- Latest verified parser checkpoint at contract revision: `d9039bf784c33bb494fbc24c5eaa72a97b43c61e`
- Parser branch status: **ACTIVE / NOT YET MERGED**
- Last merged Phase 5F major checkpoint: PR #57 — Utility Runtime + UI Runtime
- Phase 5E merge baseline: `48b6078ed37349e405213258819fa5225bcdb3fb`

This document is the forward-looking execution contract for Afyx Code
Engineering Kit. Historical closure evidence remains in
`AFYX_INDEPENDENCE_PLAN.md`; it is evidence, not the authority for creating new
micro-phases after C07.11.

---

# 1. Product North Star

Afyx is a local-first **Engineering Intelligence & Assurance Platform** for
developers and AI coding agents.

Core objective:

> **Maximum engineering outcome with minimum agent effort.**

Afyx Graph objective:

> **Provide the smallest sufficient engineering context required to produce the
> highest-confidence correct result.**

Afyx should evolve from:

```text
CODE GRAPH
    ↓
REPOSITORY GRAPH
    ↓
ENGINEERING KNOWLEDGE GRAPH
```

The product is not defined by the number of parsers, tools, or tests. It is
defined by useful engineering understanding, correctness, bounded context,
reliable automation, and maintainable ownership.

---

# 2. Canonical Development Method

All remaining native/independence work follows:

```text
UNDERSTAND observable behavior
        ↓
SPECIFY the smallest Afyx contract
        ↓
ANALYZE redundancy / coupling / cost / risk
        ↓
DESIGN AFYX-NATIVE
        ↓
REIMPLEMENT independently
        ↓
MODIFY + OPTIMIZE
        ↓
REPLACE superseded implementation
        ↓
MINIMUM SUFFICIENT VALIDATION
        ↓
ERASE historical residue in scope
        ↓
ONE FINAL GLOBAL AUDIT
```

Canonical rule:

> **Behavior reference, not source template.**

Testing is a verification guardrail, not the objective of a task. Stronger
differential, mutation, performance, or provenance evidence is reserved for
genuine high-risk boundaries such as parser/extraction semantics, resolution,
security, concurrency, database integrity, data loss, and release safety.

---

# 3. V1 CONTRACT — FROZEN SCOPE

Phase 1 through Phase 11 are the fixed v1 contract. New product ideas do not
become v1 blockers unless they are required to satisfy an existing exit gate.

```text
AFYX CODE ENGINEERING KIT
│
├────────────────────────────────────────────────────────────
│ FOUNDATION ERA
├────────────────────────────────────────────────────────────
│
├── Phase 1 — Engineering Kit Foundation                         ✅ COMPLETE
│   │
│   ├── Windows installer
│   ├── Linux/macOS installer
│   ├── updater
│   ├── verifier
│   ├── uninstaller
│   ├── safe staging
│   ├── backup / swap / rollback
│   ├── component inventory
│   └── non-destructive user configuration
│
│   EXIT:
│   Stable kit lifecycle foundation exists.
│
├── Phase 2 — Engineering Skills & Local Workflow                ✅ CORE COMPLETE
│   │
│   ├── Efficient Coding
│   ├── Odoo Engineering 10–20
│   ├── Prompt Master                              [EXTERNAL]
│   ├── Headroom                                   [EXTERNAL]
│   ├── project detection
│   ├── Afyx Doctor
│   └── Codex Usage Tracking
│
│   EXIT:
│   Daily local engineering workflow works independently of Afyx Graph.
│
├── Phase 3 — Evaluation & Evidence Foundation                   ✅ COMPLETE
│   │
│   ├── evaluation harness
│   ├── semantic fixtures
│   ├── correctness gates
│   ├── smoke tests
│   ├── benchmark methodology
│   ├── token / tool / time accounting
│   └── evidence discipline
│
│   PRINCIPLE:
│   Testing = guardrail, not the development goal.
│
├────────────────────────────────────────────────────────────
│ AFYX GRAPH FUNCTIONAL ERA
├────────────────────────────────────────────────────────────
│
├── Phase 4 — Afyx Graph Functional Core                         ✅ FUNCTIONAL COMPLETE
│   │
│   ├── Search
│   ├── Context
│   ├── Graph
│   ├── DB / WAL
│   ├── Impact / Affected
│   ├── Watcher
│   ├── Daemon
│   ├── MCP
│   ├── CLI
│   ├── Extraction
│   ├── Resolution
│   ├── Provider / Installer foundation
│   └── UI foundation
│
│   Historical implementation lineage:
│   ├── 3B.1  Search
│   ├── 3B.2  Context
│   ├── 3B.3  Graph Core
│   ├── 3B.4  Persistence / DB / WAL
│   ├── 3B.5  Impact
│   ├── 3B.6  Sync / Watcher
│   ├── 3B.7  Daemon / Proxy
│   ├── 3B.8  MCP
│   ├── 3B.9  CLI
│   ├── 3B.10 Extraction
│   ├── 3B.11 Resolution
│   ├── 3B.12 UI
│   └── Rust / kernel-related work
│
│   IMPORTANT:
│   Functional ≠ native-independent.
│
├────────────────────────────────────────────────────────────
│ NATIVE INDEPENDENCE ERA
├────────────────────────────────────────────────────────────
│
├── Phase 5 — AFYX NATIVE FULL INDEPENDENCE                     🔄 ACTIVE
│   │
│   ├── 5A — Behavior Harvest & Contract Knowledge               ✅ FROZEN KNOWLEDGE
│   │   │
│   │   ├── historical C07.1 → C07.11
│   │   ├── Search behavior
│   │   ├── Files behavior
│   │   ├── Relationships
│   │   ├── Impact
│   │   ├── Node
│   │   ├── Status
│   │   ├── Explore
│   │   └── C07.12 Session
│   │       └── NEVER STARTED / SUPERSEDED BY 5B
│   │
│   │   PRINCIPLE:
│   │   Behavior reference, not source template.
│   │
│   ├── 5B — Native MCP / CLI Runtime Reimplementation           ✅ MERGED / FROZEN
│   │   │
│   │   ├── AfyxSessionContext
│   │   ├── MCP session ownership
│   │   ├── transport
│   │   ├── engine / project selection
│   │   ├── worker / QueryPool boundary
│   │   └── CLI runtime
│   │
│   │   PR: #53
│   │   Merge: 3c5da1c148756ea47ecc31691f886307c6d38641
│   │
│   ├── 5C — Native Domain Core Reimplementation                 ✅ MERGED / FROZEN
│   │   │
│   │   ├── ExtractionAdmission
│   │   ├── ResolutionAdmission
│   │   ├── persistence ownership
│   │   ├── resolution edge ownership
│   │   └── recovery / cleanup semantics
│   │
│   │   PR: #54
│   │   Merge: ab991951e8a4874088032e24a0ff14609d48f551
│   │
│   ├── 5D — Native Product Surfaces                             ✅ MERGED / FROZEN
│   │   │
│   │   ├── provider
│   │   ├── installer
│   │   ├── inspect → plan → apply → verify
│   │   ├── release packaging foundation
│   │   └── UI product boundary
│   │
│   │   PR: #55
│   │   Merge: f683b0225ee8e805fcd7b9ea98bea88574cf61f4
│   │
│   ├── 5E — Native Optimization & Simplification                ✅ MERGED / FROZEN
│   │   │
│   │   ├── context observability
│   │   ├── bounded context
│   │   ├── benchmark lifecycle
│   │   ├── simplification
│   │   └── no speculative optimization retained
│   │
│   │   PR: #56
│   │   Merge: 48b6078ed37349e405213258819fa5225bcdb3fb
│   │
│   ├── 5F — Third-Party Source / Runtime Replacement            🔄 CURRENT
│   │   │
│   │   ├── Inventory / Before-State                             ✅ COMPLETE
│   │   │   └── checkpoint: bef1643f21d76182776a9528e4f3ab262785a737
│   │   │
│   │   ├── Utility Runtime Replacement                          ✅ MERGED / FROZEN
│   │   │   ├── Afyx CLI parser
│   │   │   ├── terminal runtime
│   │   │   ├── ignore matcher
│   │   │   ├── path/glob matcher
│   │   │   └── JSONC runtime
│   │   │
│   │   ├── UI Runtime Replacement                               ✅ MERGED / FROZEN
│   │   │   ├── Svelte runtime removed
│   │   │   ├── XYFlow removed
│   │   │   ├── D3 UI closure removed
│   │   │   ├── third-party fonts removed
│   │   │   └── Afyx DOM / SVG / CSS runtime active
│   │   │
│   │   │   PR #57 merge:
│   │   │   ebe34a2b3781c664713a362714ccb92bba2bc8e6
│   │   │
│   │   ├── Parser / Grammar Replacement                         🔄 ACTIVE NOW
│   │   │   │
│   │   │   ├── dependency-free bounded native scanner          ✅
│   │   │   ├── TypeScript facts                                ✅
│   │   │   ├── TSX facts                                       ✅
│   │   │   ├── JavaScript facts                                ✅
│   │   │   ├── JSX facts                                       ✅
│   │   │   ├── Python facts                                    ✅
│   │   │   ├── Go facts                                        ✅
│   │   │   ├── Java facts                                      ✅
│   │   │   ├── syntax tokens — seven native routes             ✅
│   │   │   ├── function references — seven native routes       ✅
│   │   │   ├── branch guards — TS/TSX/JS/JSX                  ✅
│   │   │   ├── branch guards — Python/Java/Go                  ✅
│   │   │   │
│   │   │   ├── ArkTS                                           ⏳
│   │   │   ├── Rust                                            ⏳
│   │   │   ├── Kotlin / Scala                                  ⏳
│   │   │   ├── C / C++ / Objective-C / C#                     ⏳
│   │   │   ├── PHP / Ruby / Swift / Dart                      ⏳
│   │   │   ├── Lua / Luau / R / Nix                           ⏳
│   │   │   ├── Solidity                                       ⏳
│   │   │   ├── Pascal / CFML / COBOL / VB.NET / Erlang        ⏳
│   │   │   ├── Terraform                                      ⏳
│   │   │   ├── parser-coupled SFC / special formats           ⏳
│   │   │   ├── remaining branch-guard language routes         ⏳
│   │   │   ├── parser bootstrap removal                       ⏳
│   │   │   ├── remove web-tree-sitter                         ⏳
│   │   │   ├── remove tree-sitter-wasms                       ⏳
│   │   │   ├── remove grammar WASM                            ⏳
│   │   │   ├── artifact audit                                 ⏳
│   │   │   └── parser major checkpoint PR                     ⏳
│   │   │
│   │   │   Current verified parser checkpoint:
│   │   │   d9039bf784c33bb494fbc24c5eaa72a97b43c61e
│   │   │
│   │   │   Current parser evidence:
│   │   │   ├── branch-guard focused: 68/68 PASS
│   │   │   ├── OLD/NEW branch-guard differential: 7/7 PASS
│   │   │   ├── native cross-cutting gate: 139/139 PASS
│   │   │   ├── native-enabled extraction: functional assertions PASS
│   │   │   ├── Windows residual failures: cleanup-only EPERM class
│   │   │   └── production parser dependencies still:
│   │   │       ├── web-tree-sitter
│   │   │       └── tree-sitter-wasms
│   │   │
│   │   ├── Native Kernel Closure                               ⏳
│   │   │   ├── third-party crates
│   │   │   ├── vendored grammars
│   │   │   └── optional kernel product path
│   │   │
│   │   ├── Runtime / Distribution Closure                      ⏳
│   │   │   ├── bundled Node → 0
│   │   │   ├── shipped node_modules → 0
│   │   │   └── final external-runtime contract
│   │   │
│   │   └── Final 5F Artifact Audit                             ⏳
│   │
│   ├── 5G — Legacy Product Identity / Historical Artifact Eradication ⏳
│   │   │
│   │   ├── CodeGraph identity = 0
│   │   ├── codegraph naming = 0
│   │   ├── CG-* historical residue = 0
│   │   ├── old config / env / paths = 0
│   │   └── historical implementation residue = 0
│   │
│   ├── 5H — Historical License Closure                         ⏳
│   │   │
│   │   ├── historical attribution review
│   │   ├── third-party notices
│   │   ├── grammar licenses
│   │   └── release notice payload
│   │
│   └── 5I — Final Independence Audit                           ⏳
│       │
│       ├── AFYX_NATIVE_IMPLEMENTATION_AUDIT
│       ├── AFYX_CODEGRAPH_ERADICATION
│       ├── AFYX_ZERO_THIRD_PARTY_LICENSE_AUDIT
│       ├── AFYX_RELEASE_ARTIFACT_AUDIT
│       ├── AFYX_FUNCTIONAL_REGRESSION
│       └── AFYX_CROSS_PLATFORM_BUILD
│
│       EXIT:
│       AFYX_FULLY_INDEPENDENT = TRUE
│
├────────────────────────────────────────────────────────────
│ PRODUCTIZATION ERA
├────────────────────────────────────────────────────────────
│
├── Phase 6 — Unified Kit & Provider Control Plane               ⏳
│   │
│   ├── immutable component plan
│   ├── desired state vs actual state
│   ├── provider / agent adapter registry
│   ├── Minimal / Recommended / Full / Custom presets
│   ├── drift detection
│   ├── repair
│   ├── ownership: AFYX / EXTERNAL / USER
│   └── installer / update / verify convergence
│
│   V1 PROVIDER POLICY:
│   Codex remains the primary provider target.
│
├── Phase 7 — Engineering Assurance                              ⏳
│   │
│   ├── Task Contract
│   ├── Baseline Guard
│   ├── Scope Guard
│   ├── Ground Truth
│   ├── risk-based regression selection
│   ├── Mutation Proof when justified
│   ├── Differential Proof when justified
│   ├── Performance Gate
│   ├── CI Evidence
│   ├── Documentation Evidence
│   └── Merge Readiness
│
│   STATE:
│   PLANNED
│      ↓
│   ANALYZED
│      ↓
│   IMPLEMENTED
│      ↓
│   VALIDATED
│      ↓
│   DOCUMENTED
│      ↓
│   MERGE_READY
│
├── Phase 8 — Real-World Dogfood & Comparative Proof             ⏳
│   │
│   ├── real Odoo work
│   ├── real engineering repositories
│   ├── correctness
│   ├── context usefulness
│   ├── tool calls
│   ├── latency
│   ├── context / token volume
│   └── controlled comparison
│       ├── CONTROL   → no structural graph tool
│       ├── BASELINE  → historical CodeGraph
│       └── TREATMENT → Afyx Graph
│
│   PRINCIPLE:
│   correctness > token reduction
│
├── Phase 9 — Product Hardening & Release Engineering            ⏳
│   │
│   ├── crash recovery
│   ├── corrupt / incomplete state recovery
│   ├── disk-full handling
│   ├── stale lock cleanup
│   ├── daemon recovery
│   ├── installer interruption recovery
│   ├── update rollback
│   ├── checksum / signature policy
│   ├── safe packaging
│   ├── Windows validation
│   ├── Linux validation
│   ├── macOS validation
│   ├── upgrade compatibility
│   └── failure diagnostics
│
├────────────────────────────────────────────────────────────
│ RELEASE ERA
├────────────────────────────────────────────────────────────
│
├── Phase 10 — Afyx v0.1 / Private Beta                          ⏳
│   │
│   ├── controlled private users
│   ├── installer / runtime feedback
│   ├── workflow ergonomics
│   ├── diagnostics feedback
│   ├── configuration stabilization
│   └── upgrade-contract stabilization
│
└── Phase 11 — Stable Afyx v1.0                                  🎯
    │
    ├── AFYX_FULLY_INDEPENDENT = TRUE
    ├── stable installer / update / uninstall
    ├── stable Afyx Graph runtime
    ├── stable Codex integration
    ├── stable project-state / migration policy
    ├── stable MCP contract
    ├── stable CLI contract
    ├── usable diagnostics and recovery path
    ├── representative dogfood PASS
    ├── supported-platform CI PASS
    ├── packaged artifact smoke PASS
    ├── known limitations documented
    └── no critical correctness / security issue open

    RELEASE:
    Afyx Code Engineering Kit v1.0.0
```

---

# 4. Final Independence Contract

Phase 5 may be classified complete only when all Phase 5I gates pass.

Minimum assertions:

```text
historical runtime dependency          = 0
historical build dependency            = 0
historical operational dependency      = 0
historical implementation retained     = 0
historical product identity             = 0
historical artifacts unexplained        = 0

third-party bundled source              = 0
third-party bundled assets              = 0
third-party bundled runtime             = 0
third-party attribution requirement     = 0
release artifact third-party notices    = 0
```

Prompt Master and Headroom remain explicit external exceptions. They must never
be silently reclassified as Afyx-owned source.

Legal notices may be removed only after the underlying implementation, asset,
runtime, and obligation are legitimately gone. Phase 5F is technical
replacement; Phase 5H owns historical/legal closure.

---

# 5. Phase 5F Parser Contract

The parser migration must preserve **graph meaning**, not Tree-sitter AST
identity.

Target:

```text
SOURCE CODE
    ↓
AFYX-OWNED LANGUAGE UNDERSTANDING
    ↓
GRAPH FACTS
```

Required outcome before parser/grammar closure:

- every supported language/format remains accounted for;
- no language is silently dropped to simplify independence;
- native extraction is deterministic and bounded;
- malformed/incomplete source does not crash or loop;
- fresh and incremental indexing converge;
- source ranges remain compatible with established graph contracts;
- syntax tokens, references, branch guards, and embedded/SFC routes are native;
- `web-tree-sitter` removed;
- `tree-sitter-wasms` removed;
- tracked/shipped parser grammar WASM removed;
- engine production parser dependency closure = zero;
- artifact audit and cross-platform CI pass.

The current product supports a broad multi-language matrix; Phase 5F must retain
that coverage while replacing the parser implementation.

---

# 6. V1 Release Contract

Phase 11 is reached only after:

1. Phase 5 independence completes.
2. Phase 6 lifecycle/control plane is stable.
3. Phase 7 assurance is usable.
4. Phase 8 real-world dogfood and comparative proof are complete enough to
   support product claims.
5. Phase 9 hardening passes supported-platform release gates.
6. Phase 10 private beta has produced and resolved release-blocking feedback.
7. No critical correctness/security issue remains open.

Version path:

```text
internal development
        ↓
0.x alpha / internal bundle
        ↓
v0.1 Private Beta
        ↓
0.x stabilization / RC
        ↓
v1.0.0 Stable
```

Do not publish stable `v1.0.0` solely because package metadata already contains
that number.

---

# 7. POST-v1 EXPANSION PROGRAM

This section is part of the long-term development contract but is **not a v1
release blocker**.

Post-v1 work is organized as parallel tracks rather than one mandatory serial
chain. Platform generalization must not block intelligence expansion, and
intelligence expansion must not require every provider integration to finish.

```text
Afyx v1.0
   │
   ├────────────────────────────────┐
   │                                │
   ▼                                ▼
TRACK A                         TRACK B
PLATFORM GENERALIZATION        ENGINEERING INTELLIGENCE EXPANSION
```

## Track A — Platform Generalization & Provider Expansion

```text
Track A
│
├── provider-neutral core contracts
├── stable ProviderAdapter contract
├── provider / agent capability discovery
├── feature negotiation
├── provider-neutral task/context contract
├── provider-neutral evidence contract
└── integrations
    ├── Codex
    ├── additional coding agents
    └── future providers based on demand
```

Goal: generalize the stable v1 architecture without weakening Afyx ownership or
making provider-specific behavior leak into the core.

## Track B — Engineering Intelligence Expansion

```text
Track B
│
├── B1 — Repository & Runtime Intelligence
│   │
│   ├── Shell
│   │   ├── .sh
│   │   ├── .bash
│   │   └── .zsh
│   │
│   ├── PowerShell
│   │   ├── .ps1
│   │   ├── .psm1
│   │   └── .psd1
│   │
│   ├── Build systems
│   │   ├── Makefile
│   │   ├── *.mk
│   │   ├── CMakeLists.txt
│   │   └── *.cmake
│   │
│   ├── Runtime / deployment
│   │   ├── Dockerfile
│   │   └── Docker Compose
│   │
│   └── Project manifests
│       ├── generic JSON / JSONC
│       └── TOML
│
├── B2 — Data & Infrastructure Intelligence
│   │
│   ├── SQL
│   │   ├── PostgreSQL                     HIGH PRIORITY
│   │   ├── MySQL / MariaDB
│   │   ├── SQLite
│   │   ├── SQL Server / T-SQL
│   │   └── Oracle / PL-SQL later
│   │
│   ├── CI/CD
│   │   └── GitHub Actions
│   │
│   ├── Infrastructure
│   │   ├── Kubernetes
│   │   ├── Ansible
│   │   └── Terraform enrichment
│   │
│   └── environment / config relationships
│
├── B3 — API & Schema Intelligence
│   │
│   ├── GraphQL
│   │   ├── .graphql
│   │   └── .gql
│   │
│   ├── Protocol Buffers
│   │   └── .proto
│   │
│   ├── OpenAPI
│   │   ├── YAML
│   │   └── JSON
│   │
│   ├── AsyncAPI later
│   └── database / schema relationships
│
├── B4 — Deep Framework Intelligence
│   │
│   ├── Odoo                               PRIORITY CANDIDATE
│   │   ├── Python model
│   │   ├── _inherit
│   │   ├── fields
│   │   ├── compute / depends / onchange
│   │   ├── XML views
│   │   ├── buttons
│   │   ├── actions
│   │   ├── menus
│   │   ├── ir.model.access.csv
│   │   └── record rules
│   │
│   ├── Django / FastAPI / Flask
│   ├── Spring
│   ├── Laravel
│   ├── Rails
│   ├── React / Next.js
│   ├── Vue / Nuxt
│   ├── SvelteKit
│   ├── Flutter
│   ├── .NET / ASP.NET
│   └── Android
│
└── B5 — Programming Language Expansion
    │
    ├── Groovy                             HIGH ROI
    ├── Elixir
    ├── Zig
    ├── F#
    ├── Clojure
    ├── Haskell
    ├── OCaml
    ├── Julia
    ├── Perl
    └── future languages chosen by measured demand
```

Expansion priority is determined by:

```text
user demand
    ×
ecosystem value
    ×
repository prevalence
    ÷
implementation complexity
```

Do not optimize for language-count marketing. Deep understanding of build,
runtime, database, schema, configuration, and framework relationships has
higher priority than adding low-value parser breadth.

---

# 8. Post-v1 Intelligence Goal

The desired long-term graph is:

```text
LANGUAGE GRAPH
      +
FRAMEWORK GRAPH
      +
CONFIG GRAPH
      +
DATABASE GRAPH
      +
API / SCHEMA GRAPH
      +
BUILD GRAPH
      +
DEPLOYMENT / INFRA GRAPH
      ↓
ENGINEERING KNOWLEDGE GRAPH
```

Example target relationship:

```text
Odoo Python model
      ↓
XML view
      ↓
button / action
      ↓
security
      ↓
related model
      ↓
database / migration
      ↓
deployment/runtime context
```

Afyx should understand how the engineering system fits together, not merely
recognize more file extensions.

---

# 9. Contract Governance

## V1 frozen-scope rule

Phase 1–11 are frozen as the v1 contract.

A new idea may enter Phase 1–11 only if all are true:

1. it is required to satisfy an already-defined v1 exit gate;
2. excluding it would make an existing v1 claim false or unsafe;
3. it is not merely desirable expansion;
4. scope and validation impact are explicitly documented.

Otherwise it belongs to the post-v1 program.

## Post-v1 rule

Track A and Track B may progress independently after v1. They are not required
to complete in numeric order and should be prioritized by measured product
value.

## Progress rule

Do not claim progress because a PR merged. Progress requires a real roadmap
outcome.

Every substantial task should report:

- roadmap phase/sub-boundary;
- baseline SHA;
- branch;
- implementation scope;
- what became genuinely Afyx-native;
- what remains transitional;
- historical implementation removed;
- third-party dependency/license state;
- validation performed;
- regressions/limitations;
- final PR/head when applicable;
- exact next roadmap step.

## Independence vocabulary

Use:

- `OPERATIONALLY_AFYX`
- `IMPLEMENTATION_TRANSITIONAL`
- `NATIVE_BUT_ARTIFACT_CLEANUP_PENDING`
- `LICENSE_CLOSURE_PENDING`
- `AFYX_FULLY_INDEPENDENT`

Only Phase 5I may authorize `AFYX_FULLY_INDEPENDENT`.

---

# 10. Final Definition of Success

The v1 contract is satisfied only when:

```text
Afyx implementation                  = native
Historical implementation retained   = 0
CodeGraph historical artifacts       = 0
Third-party product source/assets     = 0 under agreed strict scope
Third-party bundled runtime           = 0 under agreed strict scope
Third-party attribution obligation    = 0 under agreed strict scope

Prompt Master                        = external
Headroom                             = external

Codex integration                    = stable
Engineering workflow                 = stable
Afyx Graph                           = usable and hardened
Engineering Assurance                = usable
Comparative proof                    = evidence-based
Private beta                         = completed
Stable release gates                 = PASS
```

Then, and only then:

> **Afyx Code Engineering Kit v1.0.0 — Stable**

After v1, expansion follows Track A / Track B without reopening the v1 contract
unless a critical defect requires maintenance.
