# Phase 5F — Third-Party Source / Runtime Replacement

Task: `AFYX-91852`  
Inventory date: 2026-10-04  
Canonical baseline: `48b6078ed37349e405213258819fa5225bcdb3fb`  
Branch: `afyx/native-phase5f-third-party-replacement`  
Status: **IN PROGRESS — INVENTORY AND BEFORE-STATE FROZEN**

This document is the Phase 5F technical source of truth. The target is no
third-party product/runtime ownership in the shipped Afyx Graph boundary. It is
not a legal-closure document: historical notices stay intact for Phase 5H.

## Classification rules

| Classification | Meaning in this inventory |
| --- | --- |
| `SHIPPED_RUNTIME` | Executable/runtime redistributed in the release. |
| `SHIPPED_LIBRARY` | Package code installed or bundled for product execution. |
| `SHIPPED_SOURCE` | Third-party source retained in the active product tree. |
| `SHIPPED_ASSET` | Grammar, font, CSS, or other redistributed asset. |
| `EMBEDDED_BROWSER_RUNTIME` | Library/framework code compiled into the viewer. |
| `BUILD_ONLY` | Build dependency whose runtime is not intentionally shipped. |
| `TEST_ONLY` | Test dependency whose runtime is not intentionally shipped. |
| `TOOLCHAIN_EXTERNAL` | CI/build platform outside the product artifact. |
| `EXPLICIT_EXTERNAL_EXCEPTION` | Separately managed product boundary. |
| `HISTORICAL_LEGAL_ONLY` | Retained legal evidence; not evidence of active code by itself. |

Package metadata is not accepted as sole evidence. Classification uses import
sites, generated viewer output, tracked assets/source, and a staged release.

## Baseline product inventory

### Release runtime and Node libraries

The release builder downloads Node `v24.16.0`, copies `node.exe`/`node`, runs
`npm ci --omit=dev` inside staged `lib`, and requires staged `node_modules`.

| Component | Frozen version | Classification | Direct evidence / load site | Replacement requirement |
| --- | --- | --- | --- | --- |
| Node | v24.16.0 | `SHIPPED_RUNTIME` | `scripts/build-bundle.sh`, staged archive root | Host-runtime contract and launcher; no bundled executable. |
| `@clack/prompts` | 1.3.0 | `SHIPPED_LIBRARY` | CLI and installer dynamic imports | Afyx-owned bounded prompts/non-interactive behavior. |
| `commander` | 14.0.3 | `SHIPPED_LIBRARY` | `src/bin/afyx-graph.ts`, `cli-registry.ts` | Afyx CLI grammar preserving commands/options/help/errors. |
| `fast-string-width` | 3.0.2 | `SHIPPED_LIBRARY` | prompt dependency/runtime tree | Afyx terminal width primitive or eliminate the need. |
| `fast-wrap-ansi` | 0.2.0 | `SHIPPED_LIBRARY` | prompt dependency/runtime tree | Afyx output wrapping or eliminate the need. |
| `sisteransi` | 1.0.5 | `SHIPPED_LIBRARY` | prompt dependency/runtime tree | Afyx bounded ANSI helpers or eliminate the need. |
| `ignore` | 7.0.5 | `SHIPPED_LIBRARY` | `src/index.ts`, `src/extraction/index.ts` | Afyx matcher with parity corpus and path normalization. |
| `picomatch` | 4.0.7 | `SHIPPED_LIBRARY` | Cargo workspace resolution | Afyx implementation of only the observed glob subset. |
| `jsonc-parser` | 3.3.1 | `SHIPPED_LIBRARY` | installer targets and workspace resolution | Surgical Afyx JSONC parsing/editing preserving user files. |
| `tree-sitter-wasms` | 0.1.13 | `SHIPPED_LIBRARY` + `SHIPPED_ASSET` | `src/extraction/grammars.ts` | Afyx-owned semantic parser; no grammar package. |
| `web-tree-sitter` | 0.25.10 | `SHIPPED_RUNTIME` + `SHIPPED_LIBRARY` | extraction and branch-guard path | Afyx-owned parsing/fact boundary. |

The staged product contains two additional transitive utility packages:
`@clack/core@1.3.0` and `fast-string-truncated-width@3.0.3`. The actual staged
`node_modules` top-level set is 12 packages. The lockfile has 51 non-dev package
entries because the UI workspace/runtime closure is also represented there.

The root `package.json` and root lock entry currently declare the ten direct
runtime dependencies above. Phase 5F gates both files and the staged tree.

### Browser viewer

| Component | Frozen version | Classification | Actual artifact evidence | Decision |
| --- | --- | --- | --- | --- |
| Svelte | 5.56.10 | `EMBEDDED_BROWSER_RUNTIME` | Compiled viewer JS | Replace with native DOM/browser APIs. |
| `@xyflow/svelte` | 1.6.5 | `EMBEDDED_BROWSER_RUNTIME` | Four graph views and node/edge components | Afyx-owned SVG/DOM graph presentation. |
| `@xyflow/system` and D3-family transitives | lockfile versions | `EMBEDDED_BROWSER_RUNTIME` | Runtime closure bundled by Vite | Removed with XYFlow; no substitute library. |
| Archivo Variable | 5.3.0 | `SHIPPED_ASSET` | Three emitted WOFF2 files | Use platform font stack or Afyx-owned asset. |
| IBM Plex Mono | 5.3.0 | `SHIPPED_ASSET` | Forty emitted WOFF/WOFF2 files | Use platform monospace stack or Afyx-owned asset. |

The before-state viewer has 46 files / 1,077,326 bytes: one HTML file, one
506,225-byte JavaScript bundle, one 100,782-byte CSS bundle, and 43 font files.
Source maps are absent as required by the current distribution verifier. The
viewer must preserve GraphAdapter/wire contracts, Symbol/File/Flow/Map/Screens/
Steps views, navigation, search, and loading/error/empty behavior.

### Parser and grammar assets

`src/extraction/wasm/` contains 29 tracked grammar files totaling 68,192,092
bytes. The staged release contains 68 WASM files totaling 122,348,375 bytes:
the copied Afyx distribution grammar directory plus grammar/runtime WASM from
installed packages. `grammars.ts` loads `web-tree-sitter` and resolves grammar
bytes from the tracked directory or `tree-sitter-wasms`.

The native replacement contract is graph facts, not Tree-sitter AST identity:
definitions, containment, imports/exports, calls/references, type/inheritance
relationships, source ranges, unresolved references, framework facts,
malformed-source behavior, deterministic fresh/incremental convergence.

### Language coverage matrix

All current `LANGUAGES` values and extension/special routing must stay
accounted for. `unknown` is a routing state, not a parser family.

| Family | Languages / formats | Current path | Phase 5F status |
| --- | --- | --- | --- |
| JS/TS | TypeScript, TSX, JavaScript, JSX, ArkTS | Tree-sitter plus specialized extraction | Pending native facts/parser. |
| SFC/template | Svelte, Vue, Astro, Liquid, Razor, Twig | Delegation/format extractors; some TS/JS parsing | Pending native facts/parser; framework behavior frozen. |
| Python/Go/Rust | Python, Go, Rust | Tree-sitter specialized extractors | Pending native facts/parser. |
| JVM | Java, Kotlin, Scala | Tree-sitter specialized extractors | Pending native facts/parser. |
| C family | C, C++, Objective-C, C#, CUDA/Metal routed to C++, Solidity | Tree-sitter specialized extractors | Pending native facts/parser. |
| Dynamic | PHP, Ruby, Swift, Dart, Lua, Luau, R, Nix | Tree-sitter specialized extractors | Pending native facts/parser. |
| Enterprise | Pascal, CFML, CFScript, CFQuery, COBOL, VB.NET, Erlang | Vendored grammar WASM and specialized extraction | Pending native facts/parser. |
| Configuration | Terraform/OpenTofu, YAML, XML, properties | Grammar or file/framework routing | Pending native facts/parser where semantic facts are produced. |
| Special routes | Shopify JSON, Erlang `.app(.src)`, Play `conf/routes` | Filename/content routing | Must remain supported. |

Each family requires positive and malformed/negative fixtures, semantic graph
parity, real-file coverage where available, fresh/incremental convergence, and
a deterministic digest before its old grammar/runtime is removed.

### Optional native kernel

`afyx-graph-kernel` is an active optional product path. `Cargo.lock` contains
74 package entries. Direct dependencies include N-API, Tree-sitter and language
crates, SHA-2, regex, `libc`, `cc`, and `napi-build`. The tracked kernel tree is
52 files / 66,249,394 bytes. Its `grammars/{dart,kotlin,lua,scala}` subtree is
23 files / 65,228,661 bytes of vendored/generated source and licenses.

Classification: dependencies are `SHIPPED_LIBRARY` when the optional binary is
staged; vendored grammars are `SHIPPED_SOURCE`. The controlled Windows bundle
had no kernel binary, but release logic conditionally stages one. Phase 5F must
remove the active optional kernel or replace it without third-party crates,
grammar source, or runtime. Legal files are not removed here.

### Build/test/toolchain inventory

| Component | Classification | Notes |
| --- | --- | --- |
| TypeScript, `@types/*` | `BUILD_ONLY` | Compiler/types; no intended product runtime. |
| Vitest, jsdom | `TEST_ONLY` | Test runner and DOM test environment. |
| Vite/Rollup/esbuild, Svelte compiler/plugin/package | `BUILD_ONLY` today | Build tools, but their emitted browser runtime is product scope and audited separately. |
| Fontsource packages | `BUILD_ONLY` package plus `SHIPPED_ASSET` output | Emitted font files make them Phase 5F product scope. |
| GitHub Actions checkout/setup-node | `TOOLCHAIN_EXTERNAL` | CI orchestration, not copied into release. |
| Prompt Master, Headroom | `EXPLICIT_EXTERNAL_EXCEPTION` | Separately managed and outside Afyx Graph release. |

### Historical legal evidence

These files are intentionally retained and are not to be rewritten or deleted
in Phase 5F:

- `afyx-graph/THIRD_PARTY_NOTICES.md`
- `afyx-graph/LICENSES/THIRD_PARTY_ENGINE_MIT.txt`
- `afyx-graph/engine/LICENSE`

The first two are copied into current bundles. The Colby Mchenry attribution is
retained pending technical replacement evidence and Phase 5H provenance/legal
review. The repository root `LICENSE` remains the project license. No legal
obligation conclusion is made in this phase.

## Controlled release before-state

Command: `scripts/build-bundle.sh win32-x64` using its default Node version.
The archive was created locally and was not published.

| Measure | Before-state |
| --- | ---: |
| Target | `win32-x64` |
| Archive SHA-256 | `f90524e7df219ea3d60786d70a329cd5a0c2426ba9207ef30cf7379195db5bbe` |
| Compressed bytes | 49,828,770 |
| Files | 1,628 |
| Uncompressed bytes | 229,341,184 |
| Bundled Node | 1 file / 92,279,112 bytes |
| `node_modules` | 194 files / 58,527,055 bytes |
| WASM | 68 files / 122,348,375 bytes |
| Viewer | 46 files / 1,077,326 bytes |
| Optional kernel | absent for this controlled target |
| Historical legal files | 2 |
| Distribution verification | PASS: 2 viewer asset references, 29 copied grammars, 338 engine source maps, 2 legal files |

A sorted per-file manifest was generated with the repository's
`distribution-contract.mjs manifest` command at:

`%TEMP%\afyx-phase5f-before-20261004\artifact-manifest.json`

Manifest SHA-256:
`108fabf29713286d579e9d97ff9e119ceae06beaa85725e080bf666748b0a3c0`
(336,352 bytes). This scratch artifact is evidence only and is not committed.
The committed machine-readable summary is
`docs/evidence/phase5f-before-inventory.json`.

## Replacement decisions and execution order

1. Replace product utility dependencies behind narrow Afyx contracts: CLI and
   prompts, ignore matching, observed glob subset, and surgical JSONC editing.
2. Replace Svelte/XYFlow/fonts with Afyx-owned native browser presentation,
   preserving the existing adapter and wire boundaries.
3. Establish clean-room Afyx fact extraction family by family. Do not translate
   grammar/parser sources; remove old WASM only after semantic gates pass.
4. Remove or independently reimplement the optional kernel only after parser
   correctness and performance evidence is available.
5. Change distribution to a documented host-Node boundary; remove staged Node,
   `node_modules`, grammar WASM, optional kernel, and third-party browser assets.
6. Audit a real after-state artifact and run full supported-platform CI.

No third-party implementation will be copied or translated, no replacement
dependency will be introduced, and behavior tests will not be weakened.

## Target after-state gates

- production npm runtime dependency tree: zero
- bundled Node and shipped `node_modules`: zero
- tracked/shipped third-party grammar WASM: zero
- third-party parser runtime and vendored grammar source: zero
- shipped third-party browser runtime/assets: zero
- shipped third-party native kernel: zero
- new third-party dependencies: zero
- language semantic contract, core regression, release audit, and cross-platform
  CI: pass
- historical legal evidence: retained for Phase 5H

## Validation ledger

| Boundary | Evidence | Status |
| --- | --- | --- |
| Precondition | branch and `main` at canonical baseline; clean worktree | PASS |
| Inventory | package/lock imports, UI artifact, Cargo/lock, grammar assets, scripts/workflows/legal files | PASS |
| Before-state release | local `win32-x64` build plus distribution verifier and manifest | PASS |
| Utility replacement | Not started | PENDING |
| UI replacement | Not started | PENDING |
| Parser/grammar replacement | Not started | PENDING |
| Kernel closure | Not started | PENDING |
| Runtime/distribution after-state | Not started | PENDING |
| Full regression and CI | Not started | PENDING |

Phase 5F is not complete at this checkpoint.
