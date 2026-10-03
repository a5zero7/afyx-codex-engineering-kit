# Phase 5D — Afyx Native Product Surfaces

Task: `AFYX-73164`  
Canonical baseline: `ab991951e8a4874088032e24a0ff14609d48f551`  
Branch: `afyx/native-phase5d-product-surfaces`  
Status: implementation in progress

## Ownership inventory

This inventory was completed before implementation. Phase 5D changes ownership
only where a clearer Afyx boundary is materially useful; it does not rewrite a
working adapter for provenance or similarity reasons.

### Provider and installer

| Family | Classification | Decision |
| --- | --- | --- |
| `targets/types.ts`, `targets/registry.ts` | `AFYX_NATIVE_KEEP` | Keep the provider-specific contract and stable target registry. |
| Claude, Cursor, Codex, opencode, Hermes, Gemini, Antigravity, Kiro and Copilot adapters | `AFYX_NATIVE_KEEP` | Keep provider-native paths, formats and ownership rules. |
| `targets/shared.ts`, `targets/toml.ts` | `AFYX_NATIVE_KEEP` | Keep atomic writes and narrow JSON/TOML/marked-section helpers. |
| `installer/index.ts` interactive selection and direct mutation loop | `NATIVE_REFACTOR_NEEDED` | Make presentation produce a deterministic plan, then apply and verify it through a shared non-interactive contract. |
| `config-writer.ts` | `PUBLIC_COMPATIBILITY_KEEP` | Retain the deprecated Claude-only exports because tests and downstream imports still consume them; new code must use targets/planning. |
| `instructions-template.ts` | `AFYX_NATIVE_KEEP` | Keep the Afyx-owned marked instructions contract. |

The target adapters remain the owners of provider-specific configuration
semantics. Phase 5D will not invent a universal JSON/TOML model.

### UI server

| Family | Classification | Decision |
| --- | --- | --- |
| `ui-server/index.ts` HTTP host and request dispatch | `AFYX_NATIVE_KEEP` | Keep the loopback-only peer adapter and its bounded lifecycle. |
| `security.ts` | `AFYX_NATIVE_KEEP` | Keep Host, Origin, method, content-type, write-marker and containment checks unchanged. |
| `api/session.ts`, route/build modules and wire serializers | `AFYX_NATIVE_KEEP` | Keep one GraphSession and public AfyxGraph API boundary; no domain algorithm moves into HTTP. |
| trail storage | `AFYX_NATIVE_KEEP` | Keep the only UI-owned write under `.afyx-graph/ui/trails/`. |
| static assets, highlighting and browser opening | `AFYX_NATIVE_KEEP` | Keep narrow presentation/platform adapters. |
| touched active comments carrying `CG-*` task provenance | `HISTORICAL_RESIDUE_PHASE5G` | Remove only from materially touched UI files now; the global sweep remains Phase 5G. |

### Browser UI

| Family | Classification | Decision |
| --- | --- | --- |
| `GraphAdapter` and typed `Wire*` contracts | `AFYX_NATIVE_KEEP` | Preserve the single data boundary. |
| view models, router/navigation and Svelte views/components | `AFYX_NATIVE_KEEP` | Preserve presentation-only deterministic models and existing visual behavior. |
| HTTP adapter | `AFYX_NATIVE_KEEP` | Preserve server-owned path/source security and bounded payload parsing. |
| `CG-*` provenance comments in active UI files | `HISTORICAL_RESIDUE_PHASE5G` | Replace touched comments with present-tense architectural explanations; do not perform a repository-wide sweep. |

### Distribution and release

| Family | Classification | Decision |
| --- | --- | --- |
| bundle target/product/file knowledge split across shell, verifier and workflows | `NATIVE_REFACTOR_NEEDED` | Introduce one machine-readable Afyx artifact plan consumed by verification and staging. |
| `build-bundle.sh` platform download/stage/archive operations | `AFYX_NATIVE_KEEP` | Keep shell as the cross-platform release executor, driven by the artifact plan. |
| `distribution-contract.mjs` | `NATIVE_REFACTOR_NEEDED` | Make it the plan/verify/manifest command surface instead of duplicating constants. |
| `graph-build.yml`, `graph-release.yml` | `AFYX_NATIVE_KEEP` | Keep CI/publish orchestration, deriving the target list from the artifact plan where practical. No release is triggered. |
| bundled Node, production `node_modules`, WASM grammars and optional native kernel | `THIRD_PARTY_PHASE5F` | Retain and make explicit; replacement/removal is Phase 5F. |
| third-party notices and engine MIT attribution | `THIRD_PARTY_PHASE5F` / Phase 5H closure | Retain while the underlying material ships. |

No generated `dist/` or `release/` content is a source input. Builds always
derive them from tracked source, locked dependencies and the artifact plan.

## Product contracts

### Provider and installer

Detection and planning are side-effect free. A plan identifies the selected
target, location, owned paths and intended Afyx operation. Applying a plan is
the only mutation step; it delegates configuration shape to the target adapter.
Verification detects the resulting provider state. Install and uninstall must
remain idempotent and preserve sibling servers, permissions, comments where the
format supports them, and unrelated configuration.

Interactive prompts are presentation only. Interactive and non-interactive
flows use the same plan/apply/verify contract. Temporary isolated homes and
project roots are mandatory in tests.

### UI server

The server binds only to loopback, refuses untrusted Host and Origin values,
emits no CORS allowance, enforces method/write/content-type policy and keeps
filesystem access contained across traversal and symlinks. It is read-mostly;
saved trails are its sole intentional write. It remains a peer of CLI and MCP,
not a second graph engine.

### Browser UI

`GraphAdapter` plus the typed wire payloads remain the only data boundary.
Models and views may transform presentation state but may not implement search,
resolution, extraction, impact or graph semantics. Loading, empty, error and
bounded rendering behavior remain part of the product contract.

### Distribution and release

The artifact plan owns product identity, supported targets, archive naming,
required engine/viewer/grammar/legal files and bundled runtime version. Staging
and verification consume that plan; the platform shell owns download and
archive mechanics. Manifests remain sorted and content-hashed. No stable release
is created by Phase 5D.

## Security invariants

- UI network exposure remains loopback-only.
- Host, Origin, method and path-containment checks are not weakened.
- Installer inspection/plan operations do not write.
- Apply/uninstall mutate only target-declared Afyx-owned surfaces.
- Browser code has no direct SQLite or extraction/resolution access.
- Release verification requires current legal artifacts while third-party
  runtime/source remains bundled.

## Compatibility decisions

The deprecated Claude `config-writer.ts` facade is retained as
`PUBLIC_COMPATIBILITY_KEEP`; removing it would be a public compatibility change
without a Phase 5D benefit. It delegates to the current Claude target and is not
used by the new planning architecture.

## Deferred handoff

### Phase 5F

- bundled Node runtime and production dependency tree;
- Tree-sitter/WASM runtime and grammar assets;
- optional native Rust kernel;
- all attribution tied to those retained materials.

### Phase 5G

- repository-wide historical product/task marker eradication outside files
  materially touched by Phase 5D.

Phase 5H may close legal notices only after their underlying obligations are no
longer present.

## Validation evidence

To be completed on the final implementation head: provider planning/apply,
isolated provider matrix, UI security/API/model tests, distribution plan and
staging, production/UI builds, semantic baseline, CLI/MCP smoke and exact-head
supported-platform CI.
