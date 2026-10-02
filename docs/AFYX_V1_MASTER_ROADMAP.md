# Afyx v1 Master Roadmap

Status: Phase 5 active  
Canonical since: 2026-10-03  
Current work: Phase 5B — Native MCP/CLI Runtime Reimplementation (**REVIEW READY**)
Task: `AFYX-57384`  
Validated baseline: `2a82886d282c35756f9f17431ff473d14d83bcb7`  
Branch: `afyx/native-phase5b-mcp-cli-runtime`
Implementation HEAD: `e82e27f0f3ac0d92134d217e200f6213328df819`
Pull request: [#53](https://github.com/a5zero7/afyx-codex-engineering-kit/pull/53)

This document is the forward-looking execution contract for Afyx v1. Historical
closure evidence remains in `AFYX_INDEPENDENCE_PLAN.md`; it does not define new
implementation phases after C07.11.

## Roadmap

- Phase 1 — Engineering Kit Foundation: **COMPLETE**
- Phase 2 — Engineering Skills & Local Workflow: **CORE COMPLETE**
- Phase 3 — Evaluation & Evidence Foundation: **FOUNDATION COMPLETE**
- Phase 4 — Afyx Graph Functional Core: **FUNCTIONALLY COMPLETE**
- Phase 5 — Afyx Native Full Independence: **ACTIVE**
  - 5A — Behavior Harvest & Contract Knowledge
  - 5B — Native MCP/CLI Runtime Reimplementation: **REVIEW READY**
  - 5C — Native Domain Core Reimplementation
  - 5D — Native Product Surfaces
  - 5E — Native Optimization & Simplification
  - 5F — Third-Party Source / Runtime Replacement
  - 5G — CodeGraph / Historical Artifact Eradication
  - 5H — Historical License Closure
  - 5I — Final Independence Audit
- Phase 6 — Unified Kit & Provider Control Plane
- Phase 7 — Engineering Assurance
- Phase 8 — Real-World Dogfood & Comparative Proof
- Phase 9 — Product Hardening & Release Engineering
- Phase 10 — Afyx v0.1 / Private Beta
- Phase 11 — Stable Afyx v1.0

## Final independence contract

Phase 5I may pass only when the shipped product contains no historical
implementation or operational identity, no bundled third-party source/assets/
runtime, and no unwanted third-party runtime or license obligation. Prompt
Master and Headroom are the only allowed final external exceptions and remain
explicitly external.

Phase 5B does not claim final independence. Existing legal notices remain until
their underlying code, assets, runtime, and obligations are legitimately
eliminated in Phases 5F–5H.

## Phase 5B

The active implementation contract is documented in
`AFYX_PHASE5B_RUNTIME_DESIGN.md`. Completion requires an Afyx-owned session,
transport, shared-engine/project, bounded worker, and CLI-host architecture,
validated through focused public-contract, security, build, smoke, and
supported-platform CI gates.

### Implemented architecture

- `AfyxSessionContext` owns one connection's bounded, per-project Explore
  history and the serializable worker bridge.
- `MCPSession` owns JSON-RPC state and root negotiation; it gives every
  reconnect a new context.
- `ToolHandler` is shared and client-stateless. Its public path removes runtime
  metadata for CLI callers; its runtime path returns metadata only for the
  owning context to consume.
- Local proxy fallback uses its own context and the same tool-call contract; it
  does not merge history with a daemon session.
- Line transports remain framing-only, `MCPEngine` remains the shared
  project/writer/watcher owner, and the bounded native `worker_threads` pool
  remains the read-concurrency boundary. Analysis found no simpler safe
  replacement for these platform mechanisms.

### Intentional changes and cleanup

- Session prepare/record/strip helpers and the client-state parameter were
  removed from `ToolHandler`.
- Internal `_cgExploreEmission` / `_cgExploreSession` fields became
  `_afyxExploreEmission` / `_afyxExploreSession` atomically across direct,
  worker, proxy, and test paths.
- Local fallback now returns the same `InvalidParams` and `MethodNotFound`
  protocol errors as a direct MCP session.
- Internal transport request prefixes changed from `cg-*` to `afyx-*`.
- No dependency, bundled source, asset, or license obligation was added.

### Validation

- Native runtime, protocol, CLI, worker, and security selection: 216 passed,
  five declared platform skips, zero failures.
- Daemon lifecycle: 12/12 passed.
- TypeScript typecheck and clean production/UI build: passed.
- Semantic baseline: 6/6 passed.
- CLI/MCP smoke: passed.
- Supported-platform CI is required on the exact final PR head; PR #53 checks
  are the authoritative status and avoid a self-referential documentation
  commit.

Three Windows subprocess test files completed their behavioral assertions
locally but their fixture teardown hit `EPERM` while killed child processes
still held temporary directories. Production smoke and daemon tests passed;
the normal Windows CI job remains the acceptance gate for that platform.

### Remaining roadmap work

Phase 5C must reimplement the native domain core, followed by product surfaces,
optimization, third-party replacement, global historical-artifact eradication,
license closure, and the final independence audit in Phases 5D–5I. Existing
legal notices remain required until the underlying obligations are legitimately
removed. The next phase after Phase 5B review/merge is Phase 5C — Native Domain
Core Reimplementation.

