# Phase 5F — Third-Party Source / Runtime Replacement

Task: `AFYX-91852`
Inventory date: 2026-10-04
Canonical baseline: `ebe34a2b3781c664713a362714ccb92bba2bc8e6`
Branch: `afyx/native-phase5f-parser-grammar`
Status: **IN PROGRESS — PARSER / GRAMMAR REPLACEMENT ACTIVE**

PR #57 (inventory, utility runtime, and UI runtime) is **MERGED / FROZEN** at
`ebe34a2b3781c664713a362714ccb92bba2bc8e6`.

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
| Vite/Rollup/esbuild | `BUILD_ONLY` | Native TypeScript/CSS bundling only; not present in the viewer artifact. |
| System UI/monospace stacks | `PLATFORM_RUNTIME` | No font package or emitted font asset. |
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

## Utility / product runtime checkpoint

Checkpoint date: 2026-10-04. The utility boundary is complete; UI, parser,
kernel, and final distribution/runtime replacement remain pending.

### Usage map and Afyx-owned replacements

| Removed dependency | Previous use | Preserved product contract | Afyx owner | Risk / focused evidence |
| --- | --- | --- | --- | --- |
| `commander` | `src/bin/afyx-graph.ts`, `src/bin/cli-registry.ts` | Fixed command grammar, aliases, positional/variadic arguments, flags, help/version, parse errors, exit behavior | `src/bin/cli-parser.ts` | High; CLI semantic, version, context, node, UI, and color suites |
| `@clack/prompts` | CLI installer flow in `src/installer/index.ts` | Select/multiselect/confirm, cancellation, `--yes`, redirected-input safety | `src/runtime/terminal.ts` | High; terminal contract and installer matrix |
| `fast-string-width`, `fast-wrap-ansi`, `sisteransi` | Transitive prompt presentation | Predictable readable terminal output without decorative framework behavior | Eliminated with the prompt stack | Low; terminal and CLI presentation suites |
| `ignore` | `src/index.ts`, `src/extraction/index.ts` | Ordered ignore rules, negation/re-inclusion, rooted/directory patterns, separators, traversal refusal | `src/runtime/ignore-matcher.ts` | High; matcher corpus, config suites, and OLD/NEW real scope parity |
| `picomatch` | Cargo/workspace path matching | Only the observed `*`, `**`, `?`, class, and normalized-path subset; unsupported syntax is rejected | `src/runtime/path-pattern.ts` | Medium; matcher corpus and framework/workspace suites |
| `jsonc-parser` | provider installers and workspace/package configuration | Comments, trailing commas, surgical nested set/remove, formatting and line-ending preservation, malformed-input refusal | `src/runtime/jsonc.ts` | Very high; JSONC golden corpus and 242-case installer/provider matrix |

No replacement package was added. Direct production dependencies are now
only `tree-sitter-wasms` and `web-tree-sitter`, which belong to the later
parser boundary. The non-dev lock closure, excluding the UI workspace root
record itself, fell from 51 entries to 41. `@clack/core` and
`fast-string-truncated-width` disappeared with their owning runtime.

### Final behavior and scope evidence

- Clean lockfile install: PASS (`npm ci`).
- Focused final candidate: 517 passed, 4 declared skips, 0 failed.
- CLI semantic contract: root and query help digests unchanged; missing option
  values and the `--` terminator are covered.
- JSONC golden corpus: 7/7 PASS.
- Matcher corpus: 14/14 PASS.
- Installer/provider matrix: 242 passed, 3 declared skips.
- OLD/NEW engine-root scope on the same final worktree: 981 files each;
  sorted relative-path SHA-256
  `1f1e836b3a28e4e0ced2d710412a886b5ecf26a429903f4c16ea8f32143ea8c1`;
  no OLD-only or NEW-only paths. This final rerun supersedes the earlier
  provisional 979-file capture.
- TypeScript typecheck, clean production/UI build, six semantic fixtures,
  21-check CLI/MCP smoke, and repository validator: PASS.
- Full high-parallel Windows run: 5,503 passed, 213 skipped, 35 failures in
  13 files. Isolated reruns cleared all timeout/contention cases. Six files
  completed functional assertions and then failed only while deleting Windows
  temporary directories (`EPERM`). `extraction-old-git.test.ts` retains its
  baseline-local Windows separator assertion (`dir_b\\b.ts` versus the
  established normalized `dir_b/b.ts`); the exact OLD checkpoint fails the
  same assertion. No utility product regression remains unexplained.

### Controlled utility artifact

The controlled `win32-x64` bundle was built with Node v24.16.0 and passed the
distribution verifier (2 viewer references, 29 copied grammars, 343 engine
source maps, 2 historical legal files).

| Measure | Before | Utility checkpoint |
| --- | ---: | ---: |
| Archive bytes | 49,828,770 | 49,566,958 |
| Archive SHA-256 | `f90524e7df219ea3d60786d70a329cd5a0c2426ba9207ef30cf7379195db5bbe` | `db56aa351284ecd56645724fe2635bde3d6e3ce1c0a9c2da8cf33083be503efb` |
| Bundle files | 1,628 | 1,560 |
| Uncompressed bytes | 229,341,184 | 228,429,183 |
| `node_modules` files | 194 | 106 |
| `node_modules` bytes | 58,527,055 | 57,543,696 |

The staged production package set is exactly `tree-sitter-wasms` and
`web-tree-sitter`; all removed utility packages and prompt transitives are
absent. Bundled Node, `node_modules`, parser WASM, viewer runtime, and historical
legal files are intentionally still present for later Phase 5F boundaries.

No third-party implementation will be copied or translated, no replacement
dependency will be introduced, and behavior tests will not be weakened.

## UI runtime checkpoint

Checkpoint date: 2026-10-04. The browser presentation boundary is now Afyx-owned;
parser/grammar, native-kernel, and bundled-runtime work remain pending.

### Ownership map and architecture

| Classification | Modules / responsibility |
| --- | --- |
| `PURE_ADAPTER_KEEP` | `ui/src/lib/adapter.ts`, `api.ts`, `wire.ts`, `navigation.ts` |
| `PURE_MODEL_KEEP` | symbol/file/file-code/flow/map/screens/steps/search/entry/dead-code/trail/export models |
| `NATIVE_DOM_REWRITE` | `native/app.ts`, `native/search.ts`, `native/components.ts`, `native/views.ts`, `native/dom.ts` |
| `NATIVE_SVG_REWRITE` | `native/graph.ts`, `native/viewport.ts`; consumes existing deterministic layout output |
| `STYLING_KEEP_OR_ADAPT` | `theme.css` tokens plus native `app.css`; system font stacks |
| `THIRD_PARTY_RUNTIME_REMOVE` | Svelte component/runtime/compiler integration and XYFlow/D3 presentation closure |
| `THIRD_PARTY_ASSET_REMOVE` | Archivo and IBM Plex packages and emitted font files |
| `DEAD_AFTER_REWRITE` | all active `.svelte`, rune-state `.svelte.ts`, and Svelte build configuration |

The browser remains presentation-only: `GraphAdapter` and the typed wire
contract are unchanged data boundaries. Native views use explicit mount/dispose
lifecycles. Hash routing, deep links, search, trail state, live EventSource
updates, keyboard navigation, loading/error/empty states, and all major views
remain available. Flow, Map, Screens, and Steps use bounded native SVG pan/zoom
over the existing Afyx layout models; extraction, traversal, ranking, impact,
indexing, and database semantics remain in the core.

### Dependency and artifact closure

- UI production dependencies and peer dependencies: zero.
- Active `.svelte` / `.svelte.ts` product source: zero.
- Removed packages: Svelte, Svelte compiler/plugin/package/check tooling,
  `@xyflow/svelte`, `@xyflow/system`, their D3 transitives, and both fontsource
  packages.
- Retained build-only tools: TypeScript and Vite/Rollup/esbuild. The generated
  viewer contains one HTML file, one Afyx JavaScript asset, and one Afyx CSS
  asset; it contains no build-tool runtime.
- Viewer before: 46 files / 1,077,326 bytes; 506,225 JS bytes; 100,782 CSS bytes;
  43 font files / 469,752 font bytes.
- Viewer checkpoint: 3 files / 85,615 bytes; 77,003 JS bytes; 8,045 CSS bytes;
  zero font files and zero source maps.
- Controlled `win32-x64` archive: 48,932,591 bytes; SHA-256
  `a422fe665596a1fbfcecef77092401e3440d193b0bed0f6f316c2b821dbd2517`;
  1,517 files / 227,437,426 uncompressed bytes. Distribution verification
  passed with 2 viewer asset references, 29 grammars, 343 engine source maps,
  and 2 historical legal files.
- Viewer byte scan found no Svelte, XYFlow, D3, fontsource, bundled font-name,
  third-party banner, package URL, or `node_modules` signature.

### Validation

- Clean lockfile install: PASS (`npm ci`; the local Node 26 engine-range warning
  is environmental—the controlled bundle uses Node 24.16.0).
- Native/package/UI model/API/security campaign: 687 passed, 4 declared skips.
- Native package-specific tests: 20 passed, including loading/error, routing,
  search, required views, deterministic SVG structure, viewport bounds, and
  cleanup/dispose behavior.
- Clean TypeScript/UI/production build: PASS.
- Semantic baseline: PASS (6 fixtures).
- CLI/MCP smoke: PASS (21 checks).
- Repository static validator: PASS.
- Real-browser automation was not added because none exists in the repository;
  jsdom DOM/SVG tests, live HTTP server/security tests, built-asset fetches, and
  CLI UI serving are the supported smoke evidence.

Historical legal files were not modified. This checkpoint makes no legal
conclusion; it records only that third-party UI runtime/source/assets were not
detected in the shipped viewer.

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
| Utility replacement | Afyx CLI/terminal/matchers/JSONC; clean dependency closure; scope parity; controlled bundle | PASS |
| UI replacement | Native DOM/SVG runtime, zero production UI dependencies, controlled viewer artifact audit | PASS |
| Parser/grammar replacement | Ownership frozen; native scanner plus initial TypeScript/JavaScript, Python, Go, and Java fact routes validated behind the opt-in gate | ACTIVE |
| Kernel closure | Not started | PENDING |
| Runtime/distribution after-state | Not started | PENDING |
| Full regression and CI | Not started | PENDING |

Phase 5F is not complete at this checkpoint.

## Parser / grammar ownership freeze

The parser boundary started from 29 tracked grammar WASM files totaling
68,192,092 bytes and two production packages (`web-tree-sitter` and
`tree-sitter-wasms`). Forty-eight active TypeScript modules reference the old
runtime, its syntax-node model, parser loading, or shared traversal helpers.

| Ownership | Current modules | Migration rule |
| --- | --- | --- |
| `PARSER_RUNTIME_REMOVE` | `grammars.ts`, `web-tree-sitter.d.ts`, parser bootstrap/cache, grammar WASM | Remove after native semantic gates pass. |
| `SYNTAX_COUPLED_REWRITE` | `tree-sitter.ts`, `tree-sitter-types.ts`, `function-ref.ts`, `syntax-tokens.ts`, `cfml-extractor.ts`, language configs, branch guards/policy | Replace traversal mechanics with Afyx-native scanners and fact recognizers; retain semantic policy. |
| `GRAPH_FACT_LOGIC_KEEP` | graph node/edge/reference schemas, resolution, reconciliation, extraction admission | Preserve public graph meaning and ordering. |
| `FORMAT_EXTRACTOR_KEEP` | Liquid, Razor, MyBatis XML, DFM/FMX, YAML/Twig/properties file-level paths | Keep independently owned format parsing; remove only actual old-parser coupling. |
| `ROUTING_KEEP` | extension/content detection, extractor registry, worker/store boundaries | Preserve supported-language and orchestration contracts while simplifying grammar bootstrap. |
| `FRAMEWORK_LOGIC_KEEP` | framework resolvers and SFC source-offset mapping | Preserve framework facts; embedded JS/TS moves to the native recognizer. |
| `TEST_ORACLE_REWRITE` | kernel parity and grammar/bootstrap tests | Compare semantic facts against native output; do not retain the old runtime as a committed oracle. |
| `DEAD_AFTER_NATIVE_PARSER` | grammar loaders/copy checks and add-language AST/WASM diagnostics | Remove only after all language routes are accounted for. |
| `DEFER_KERNEL` | Rust kernel sources, Cargo dependencies, vendored kernel grammars | Remain a later Phase 5F boundary. |

The first native foundation is a dependency-free bounded lexical scanner. It
uses UTF-16 offsets/columns, treats strings and comments as opaque, records
balanced delimiters without constructing a Tree-sitter-compatible AST, and
reports incomplete strings/comments/delimiters without throwing or looping.

### Native semantic convergence checkpoints

- `a904901` converges the initial TypeScript/JavaScript, Python, and Go fact
  routes. The native unit/differential suites pass, and the native-enabled
  extraction campaign has 651/655 passing assertions; the four remaining
  failures are the established Windows temporary-directory cleanup `EPERM`
  class rather than semantic assertions.
- `7f409dc` adds the Java route with package containment, imports, methods,
  fields, anonymous classes, inheritance, instantiation, annotation, and
  static-member references. Java focused contracts pass 12/12 and the
  representative OLD/NEW Java semantic fixture is identical. The subsequent
  full campaign exposed one static-member assertion, which was corrected and
  revalidated directly; the native unit/differential suite passes 10/10.

`AFYX_GRAPH_NATIVE_PARSER=1` remains required. This is an active convergence
checkpoint, not parser-boundary completion: other language families, syntax
tokens, function references, branch guards, bootstrap/package removal, and
grammar-WASM removal remain pending.

### Cross-cutting native convergence after `11a2922`

- `e3e200f` migrates syntax-token classification for TypeScript, TSX,
  JavaScript, JSX, Python, Go, and Java. Embedded SFC JavaScript/TypeScript
  regions reuse the native classifier under the opt-in gate; the public
  highlight payload remains compatible.
- `9dbf892` migrates function-reference candidates for those native routes,
  including scoped `this` references, Java method references, Python
  class-as-value references, and import/same-file ownership filtering.
- `9d0101e` adds an Afyx-owned token/source branch-guard reader for TypeScript,
  TSX, JavaScript, and JSX.
- `c3fe36b3823bbcb1f28ed49f0a9a760cbe0565f7` extends that reader to Python,
  Java, and Go. Python uses bounded token/line/indentation recognition; Java
  and Go reuse the bounded delimiter reader. The established forms are
  preserved: if/else/elif, early exits, conditional/logical expressions,
  match/switch cases, catch/except, Go init conditions and terminal calls,
  plus named function/lambda boundaries. Java switch rules retain the OLD
  oracle's behavior (no case guard) rather than adding new semantics here.
  Call-site arguments, triggers, loops, pending languages, and the fallback
  policy remain on the established route.

The authoritative focused branch-guard suite is now 68/68 PASS (correcting
the earlier 59/59 note; the prior checkpoint actually ran 63 tests). OLD/NEW
differential coverage is 7/7 PASS with no intentional output differences:

| Language | OLD SHA-256 | NEW SHA-256 |
| --- | --- | --- |
| TypeScript / TSX / JavaScript / JSX (each) | `ac44b990fdd504bf44fed0e10f5954b86f0c84aaa8dd0dc848742eb8dc9a3583` | identical |
| Python | `fbd070d81c4a246faa62576f849b07a6cfda1461e513384f1f7b1696edc19282` | identical |
| Java | `6f2330a123d82d36b7a6457440dd769988ba994f6f9e95ec5b7740ef0ad01c2d` | identical |
| Go | `9ad182f55ed0c1bbf04e061fe8f6fe6f28715fa834ff17548906c6fb4154dcf5` | identical |

The combined native cross-cutting gate passes 139/139 and typecheck/build
pass. Native-enabled extraction completes all 651 functional assertions; its
four reported failures remain Windows temporary-directory `fs.rmSync` EPERM
after assertions. CLI/MCP smoke passes 21/21. The semantic gate's graph
structure is unchanged, but native-enabled runs differ from the frozen file
only in two floating search scores; the same build without the native gate
passes all six fixtures, so no search/baseline change was made in this parser
sub-boundary.

The native-complete fact and syntax-token set is TypeScript, TSX, JavaScript,
JSX, Python, Go, and Java. Branch guards are native for all seven routes.
Swift, Kotlin, C#, C, C++, and Objective-C guard profiles remain on the safe
fallback because their fact routes are not native-complete. ArkTS and the
remaining systems, JVM, dynamic, enterprise, and
parser-coupled special-format routes remain pending. Afyx-owned file-level or
special format routes remain unchanged.

The active `web-tree-sitter`/`SyntaxNode` source coupling count is still 34
files (baseline 34). This checkpoint introduces no new coupling, but does not
remove the fallback modules yet. Production dependencies remain
`web-tree-sitter` and `tree-sitter-wasms`; grammar WASM, bootstrap removal,
artifact audit, and the parser PR remain deferred until every real route is
native and validated.

### Rust, Kotlin, and Scala native semantic checkpoint

The parser branch incorporated canonical `main` at
`5349c4a184e539f0ac0752d895ff3262c6326e29` through merge commit
`01fb8153e3bab4dcac0ce6463a8ed3513c9b769c`; the earlier parser checkpoint
`d9039bf784c33bb494fbc24c5eaa72a97b43c61e` remains in its ancestry. Commit
`b321ca7` adds dependency-free Rust, Kotlin, and Scala fact recognition and
extends the native syntax route to all three languages. Kotlin also joins the
native branch-guard route.

The native scanner now treats Rust lifetimes, raw strings, and nested block
comments deterministically; Kotlin backtick identifiers and Kotlin/Scala
triple-quoted strings remain opaque to declaration scanning. The recognizers
preserve the Afyx-required graph surface:

- Rust types, enum variants, traits, associated/impl methods, implementing-type
  ownership, trait relations, use roots, const/static initializers, qualified
  calls, Rocket handler macros, declared return types, and function values.
- Kotlin package/import ownership, classes/interfaces/objects/companions/enums,
  `fun interface`, methods/functions, `expect`/`actual`, field versus shared
  property ownership, initializer/accessor calls, destructuring RHS calls,
  inheritance/type refs, nullable return types, callable refs, and established
  `if`/`when`/catch/early-exit branch guards.
- Scala classes/objects/traits/enums/cases, top-level and owned definitions,
  field versus object/top-level val/var ownership, type aliases and annotation
  refs, extension methods, imports, visibility, calls/function values, and
  declared return types, including bounded Scala 3 indentation bodies.

The native route set is now ten languages: TypeScript, TSX, JavaScript, JSX,
Python, Go, Java, Rust, Kotlin, and Scala. The final affected focused candidate
passed 92/92 cross-cutting tests and 61/61 selected extraction/resolution tests;
the function-reference campaign passed 20/20. Typecheck, clean production/UI
build, and the 21-check CLI/MCP smoke passed. The native extraction campaign
reached all 655 functional assertions: 647 tests completed normally, seven
completed their assertions and then hit the established Windows temporary-dir
cleanup `EPERM`, and the remaining Kotlin backtick-identifier assertion was
corrected and passed on its focused rerun.

The normal six-fixture semantic baseline passes. The native-gated structural
graph remains unchanged; its only frozen-baseline differences are still the
same two TypeScript floating search scores recorded above, so the limitation is
`SAME`, not expanded.

No package, lockfile, grammar WASM, old language adapter, generated parser
artifact, or legal record is removed by this checkpoint. The safe fallback is
still needed for languages not yet migrated and when the opt-in gate is off.
Active `web-tree-sitter`/`SyntaxNode` source coupling remains 34 files and the
two production parser dependencies remain `web-tree-sitter` and
`tree-sitter-wasms`. Removing those dependencies, their grammar assets, and the
bootstrap belongs to final parser closure after every parser-coupled route is
native.

Remaining parser work includes ArkTS; C, C++, Objective-C, C#, and Solidity;
PHP, Ruby, Swift, Dart, Lua/Luau, R, and Nix; Pascal, CFML/CFScript/CFQuery,
COBOL, VB.NET, and Erlang; Terraform/OpenTofu parser-backed semantics; and
parser-coupled SFC/template/special-format internals. Established branch guards
still pending native migration are Swift, C#, C, C++, and Objective-C. Kernel,
bootstrap/dependency/WASM removal, after-state artifact audit, and the parser
major PR remain later Phase 5F work.

### C-family native semantic and branch-guard checkpoint

Commit `ef66aff` adds an Afyx-owned, dependency-free semantic fact route for
C, C++, Objective-C, and C# behind `AFYX_GRAPH_NATIVE_PARSER=1`. Successful
gated extraction for these languages now enters `c-family-facts.ts` directly;
it does not invoke their Tree-sitter language adapters. Normal ungated routing
is intentionally unchanged until the full parser migration is complete.

The bounded product contracts covered by this route are:

- C functions and calls, aggregate and typedef ownership, includes, type
  dependencies, function-pointer aliases, and function-value references.
- C++ namespaces, aggregates and enums, inheritance, owned and out-of-line
  methods, constructors/destructors, required template/type relationships,
  qualified/chained/operator calls, stack/heap construction, and member
  references.
- Objective-C protocols, interfaces/implementations, properties, instance and
  class methods, imports, inheritance/protocol conformance, message sends, and
  nested factory-message calls. Interface declarations and implementation
  bodies converge on one owned method fact.
- C# namespaces, classes/structs/interfaces/records/enums, properties, fields,
  methods, inheritance/interface relationships, nullable/generic type
  dependencies, qualified/factory calls, and callable references.

The shared scanner now handles bounded C++ raw strings and C# verbatim and
interpolated string forms, including deterministic incomplete-string
reporting. Native syntax classification includes all four languages. Their
established `if`/`else`, switch/case, loop, catch, logical-condition, and
early-exit branch guards now use the Afyx-native token view, with C-family
function/method boundaries and Objective-C message syntax kept distinct.

Validation for this checkpoint passed 155/155 shared native, syntax,
function-reference, and branch-guard tests in both gated and normal modes. The
focused scanner/C-family contracts passed 15/15. The selected C-family
extraction/resolution campaign completed 153 semantic assertions; its two
reported failures occurred only in post-assertion Windows temporary-directory
`fs.rmSync` cleanup with the established `EPERM` behavior. Typecheck, clean
production/UI build, the normal six-fixture semantic baseline, and all 21
CLI/MCP smoke checks passed.

The native semantic route set is now fourteen languages: TypeScript, TSX,
JavaScript, JSX, Python, Go, Java, Rust, Kotlin, Scala, C, C++, Objective-C,
and C#. Active `web-tree-sitter`/`SyntaxNode` source coupling remains 34 files
(baseline 34): the superseded C-family adapters cannot yet be deleted because
ungated mode and pending parser-coupled paths still use the shared fallback
registry. No package, lockfile, grammar WASM, legal record, or runtime
dependency was removed. `web-tree-sitter` and `tree-sitter-wasms` remain
required until all remaining production routes converge.

Remaining parser work includes ArkTS and Solidity; PHP, Ruby, Swift, Dart,
Lua/Luau, R, and Nix; Pascal, CFML/CFScript/CFQuery, COBOL, VB.NET, and Erlang;
Terraform/OpenTofu parser-backed semantics; and parser-coupled
SFC/template/special-format internals. The established Swift branch guards
remain pending. Kernel, bootstrap/dependency/WASM removal, after-state artifact
audit, and the parser major PR remain later Phase 5F boundaries.

### Swift native semantic and branch-guard checkpoint

Commit `54eae35` adds the fifteenth feature-gated native semantic route. With
`AFYX_GRAPH_NATIVE_PARSER=1`, Swift now enters the Afyx-owned
`swift-facts.ts` recognizer directly and no longer executes the Swift
Tree-sitter semantic adapter. Ungated extraction remains on the established
fallback until the complete parser migration is ready for cutover.

The bounded Swift contract includes module imports; classes, structs,
protocols, enums, actors, extensions, type aliases and associated types;
owned functions, methods, initializers, properties, fields and enum cases;
inheritance/protocol conformance and extension-target references; generic,
optional, return and property-wrapper/metatype dependencies; calls, qualified
and factory-chain calls; and scoped callable values. Computed-property calls
remain owned by the property, while locals remain outside the definition
graph.

The scanner now consumes Swift raw and multiline strings and nested block
comments as bounded opaque regions, reporting incomplete strings without
hanging or throwing. Swift syntax highlighting uses the native classifier.
Native branch guards preserve `guard` continuation versus exit-arm polarity,
`if`/`else`, ternary, switch/case/default, catch, logical and early-exit
semantics. Function, assigned-closure, parameterized-closure and trailing-
closure boundaries prevent conditions from leaking between execution scopes.

The focused native Swift suite passes 6/6 and the expanded scanner suite
passes 7/7. The frozen Swift semantic/guard oracle passes 21/21 under the
native gate; the broader Swift extraction/resolution selection passes 19/19.
Shared native, syntax, function-reference and branch-guard regression coverage
passes 164/164 in native mode and 164/164 in normal mode. Typecheck, clean
production/UI build, the normal six-fixture semantic baseline and all 21
CLI/MCP smoke checks pass. No semantic failure or cleanup-only Windows
`EPERM` occurred in this boundary.

The native semantic set is now fifteen languages: TypeScript, TSX,
JavaScript, JSX, Python, Go, Java, Rust, Kotlin, Scala, C, C++, Objective-C,
C#, and Swift. The previously identified established native branch-guard
backlog is now closed. Active `web-tree-sitter`/`SyntaxNode` source coupling
remains 34 files (34 → 34), because normal ungated mode and the remaining
parser-backed languages still share the fallback registry and adapters. No
Swift grammar asset, package, lockfile entry, runtime dependency, legal record,
or attribution file is removed at this checkpoint.

Remaining parser boundaries include ArkTS and Solidity; PHP, Ruby, Dart,
Lua/Luau, R, and Nix; Pascal, CFML/CFScript/CFQuery, COBOL, VB.NET, and Erlang;
Terraform/OpenTofu semantics; and parser-coupled SFC/template/special-format
internals. `web-tree-sitter`, `tree-sitter-wasms`, grammar WASM and parser
bootstrap removal remain blocked until those production routes converge. The
next dependency-safe language boundary is ArkTS, reusing the proven native
TypeScript-family scanner/fact surface without starting that work here.

### ArkTS native semantic checkpoint

Commit `3a73108` adds ArkTS as the sixteenth feature-gated native semantic
route. With `AFYX_GRAPH_NATIVE_PARSER=1`, `.ets` files now enter the shared
Afyx-native TypeScript-family fact recognizer directly; the ArkTS Tree-sitter
adapter and grammar are not invoked for successful native fact extraction.
Ungated extraction remains unchanged.

ArkTS reuses the native TypeScript-family scanner, modules/imports, classes,
interfaces, enums, type aliases, members, inheritance/implementation, type
references, constructors, calls, instantiations, callable references, and
ownership. The bounded ArkTS specialization adds decorated `struct`
components and members, decorator metadata, ArkUI dot-prefixed attribute
calls, and `.onXxx(this.handler)` bindings. Native syntax classification reuses
the TypeScript vocabulary with the ArkTS `struct` keyword, and ArkTS now uses
the existing native TypeScript-family branch-guard implementation.

The focused native ArkTS suite passes 4/4. The established ArkTS extraction
contract passes 17/17 in native mode, and its normal-mode extraction plus
syntax counterpart passes 18/18. Seven end-to-end ArkTS resolution cases
completed their semantic assertions before the established Windows
temporary-directory cleanup `EPERM`. Shared fact, syntax, function-reference,
and branch-guard regression coverage passes 107/107. Typecheck, clean
production/UI build, the six-fixture semantic baseline, all 21 CLI/MCP smoke
checks, and `git diff --check` pass. The broad native extraction campaign has
642/655 normal completions, seven post-assertion cleanup `EPERM` results, and
six pre-existing C/CUDA native semantic gaps outside this boundary.

The native semantic set is now sixteen languages: TypeScript, TSX,
JavaScript, JSX, Python, Go, Java, Rust, Kotlin, Scala, C, C++, Objective-C,
C#, Swift, and ArkTS. Active `web-tree-sitter`/`SyntaxNode` source coupling
remains 34 files (34 → 34). The ArkTS adapter and
`tree-sitter-arkts.wasm` remain required by ungated/default execution,
packaging, and the shared fallback bootstrap; no parser package, lockfile,
grammar asset, legal record, or attribution file is removed.

Remaining parser boundaries include Solidity; PHP, Ruby, Dart, Lua/Luau, R,
and Nix; Pascal, CFML/CFScript/CFQuery, COBOL, VB.NET, and Erlang;
Terraform/OpenTofu semantics; and parser-coupled SFC/template/special-format
internals. `web-tree-sitter`, `tree-sitter-wasms`, grammar WASM, and parser
bootstrap removal remain blocked. The next dependency-safe language boundary
is Solidity; it is not started by this checkpoint.

### Solidity native semantic checkpoint

Commit `c029b49` adds Solidity as the seventeenth feature-gated native semantic
route. With `AFYX_GRAPH_NATIVE_PARSER=1`, `.sol` files now enter the bounded
Afyx-owned `solidity-facts.ts` recognizer directly. Successful native semantic
extraction does not load the Solidity Tree-sitter adapter, grammar, or WASM;
ungated/default extraction remains unchanged.

The native contract covers imports and aliases; contracts, interfaces,
libraries, structs, enums, value-type aliases, functions, constructors,
modifiers, fallback/receive functions, state variables, constants, events and
custom errors; containment; Solidity `is` inheritance; user-defined, mapping,
array, parameter and return-type references; `using` library references;
internal/member calls; base-constructor and modifier invocations; event emits,
custom-error reverts; and `new` instantiations. Events and custom errors retain
the established field-shaped definitions, while their uses remain call facts.
Inline assembly is delimiter-bounded but intentionally not parsed as Yul.

The existing native scanner required no change. Native syntax classification
adds Solidity keywords and elementary-width types. No Solidity-specific branch
machinery was added: the required semantic ownership is bounded by declaration
and brace scopes, and the established Solidity contract has no parser-backed
branch-guard surface.

The focused native Solidity suite passes 4/4. The established Solidity
extraction contract passes 12/12 under the native gate and 12/12 in normal
mode. Shared scanner/fact/syntax and already-native language coverage passes
50/50. Typecheck, clean production/UI build, the six-fixture semantic baseline,
all 21 CLI/MCP smoke checks, and `git diff --check` pass. No semantic failure
or Windows cleanup `EPERM` occurred in this boundary. There is no separately
maintained Solidity resolution fixture; the focused suite validates the exact
unresolved inheritance, type, modifier, event/error, call, and instantiation
facts consumed by the shared resolver.

The native semantic set is now seventeen languages: TypeScript, TSX,
JavaScript, JSX, Python, Go, Java, Rust, Kotlin, Scala, C, C++, Objective-C,
C#, Swift, ArkTS, and Solidity. Active `web-tree-sitter`/`SyntaxNode` source
coupling remains 34 files (34 → 34). The existing Solidity adapter and
`tree-sitter-solidity.wasm` remain required production fallback assets for
ungated/default execution, packaging, and shared parser bootstrap. No parser
package, lockfile, grammar asset, legal record, or attribution file is removed.

Remaining parser boundaries include PHP, Ruby, Dart, Lua/Luau, R, and Nix;
Pascal, CFML/CFScript/CFQuery, COBOL, VB.NET, and Erlang; Terraform/OpenTofu
semantics; and parser-coupled SFC/template/special-format internals.
`web-tree-sitter`, `tree-sitter-wasms`, grammar WASM, and parser bootstrap
removal remain blocked. The next dependency-safe task is a separate audit of
the remaining dynamic-language group; no such language is started here.

### PHP, Ruby, Lua/Luau, and R native semantic checkpoint

Commit `3662726` adds five feature-gated native semantic routes, increasing
the native set from seventeen to twenty-two languages. With
`AFYX_GRAPH_NATIVE_PARSER=1`, PHP, Ruby, Lua, Luau, and R now enter bounded
Afyx-owned fact recognizers directly; successful semantic extraction and
syntax classification do not invoke their Tree-sitter adapters or grammar
WASM. Ungated/default extraction remains on the established fallback.

The implementation keeps language-specific contracts separate behind a small
shared fact/result builder. PHP covers namespaces and `use` imports, class-like
containers, members, inheritance/composition, typed references, calls,
construction, includes, closures/arrow functions, and established HOF callable
forms. Ruby covers nested modules/classes, methods and singleton methods,
inheritance/mixins, require paths, receiver/bare calls, Rails callback symbols,
and assignment-bound lambda scope. Lua and Luau share one scanner/fact core for
functions, table/module methods, `require`, calls, callable values, and
function-valued assignment ownership; Luau adds exported type aliases, typed
signatures, return types, and type references. R covers assignment-bound and
nested functions, file variables/constants, package/source dependencies,
namespaced/member calls, callable values, and the established S4/R5/R6/ggproto
class and method idioms.

Scanner changes are deliberately narrow: Lua line/long-bracket comments and
long strings, plus the R assignment/namespace operators. Native syntax
vocabularies now cover all five routes. No separate branch-guard subsystem was
added because these languages do not have an established parser-backed guard
API in the current product contract; callable and closure ownership is instead
bounded directly by function, brace, `end`, and assignment scopes.

Validation passed the new focused family suite 13/13, the selected established
extraction/resolution contracts 45/45 in native mode and 45/45 in normal mode,
the complete function-reference campaign 20/20, and the selected shared-native
campaign 61/61. Typecheck, clean production and UI builds, the six-fixture
semantic baseline, all 21 CLI/MCP smoke checks, and `git diff --check` pass.
The optional native-kernel parity suites were unavailable and skipped 23/23.
The one broad 655-test native extraction campaign recorded 642 normal passes,
six previously documented C/CUDA native semantic gaps outside this boundary,
and seven post-assertion Windows cleanup `EPERM` results. Its initial Lua
doc-comment mismatch was corrected; the focused rerun passed the Lua assertions
and then stopped at the existing C doc-comment gap.

Active `web-tree-sitter`/`SyntaxNode` source coupling remains 34 files
(34 → 34). The PHP, Ruby, Lua, Luau, and R adapters and grammar assets remain
required production fallback and release assets while ungated mode is
supported; the clean build still stages all 29 grammar WASM files. No parser
package, lockfile, grammar asset, bootstrap code, legal record, or attribution
file is removed. `web-tree-sitter` and `tree-sitter-wasms` therefore remain
production dependencies.

The native semantic set is now TypeScript, TSX, JavaScript, JSX, Python, Go,
Java, Rust, Kotlin, Scala, C, C++, Objective-C, C#, Swift, ArkTS, Solidity,
PHP, Ruby, Lua, Luau, and R. Remaining parser boundaries include Dart and Nix;
Pascal, CFML/CFScript/CFQuery, COBOL, VB.NET, and Erlang; Terraform/OpenTofu;
and parser-coupled SFC/template/special-format internals. Parser bootstrap,
dependency, grammar-WASM, and fallback removal remain blocked. The recommended
next Phase 5F boundary is a separate evidence-first Dart/Nix contract audit;
that work is not started by this checkpoint.

### Dart and Nix native semantic checkpoint

Commit `26d4e71` adds Dart and Nix as the twenty-third and twenty-fourth
feature-gated native semantic routes. The languages remain one valid delivery
checkpoint because both reuse the bounded scanner, delimiter map, dynamic fact
schema, and syntax classifier, while their high-level fact recognizers remain
separate. No Dart analyzer, Nix evaluator, generic AST, or new parser
architecture was introduced. With `AFYX_GRAPH_NATIVE_PARSER=1`, successful
Dart and Nix semantic extraction and syntax classification no longer invoke
their Tree-sitter language adapters or grammar WASM. Ungated/default behavior
continues to use the established fallback.

The Dart recognizer preserves imports, exports, and parts; class-shaped class,
mixin, and extension definitions; enums, aliases, functions, methods, named
constructors, fields, and shared constants; containment and visibility;
extends/implements/mixin and declared-type references; construction, calls,
factory/constructor chains, callable values, and same-file constant reads.
Constant reads remain direct graph edges and fail closed for a locally shadowed
name. Function and arrow bodies provide bounded call ownership; there was no
separate established Dart branch-guard contract to migrate.

The Nix recognizer is deliberately lexical. It preserves attribute and
`let` bindings, curried functions and attribute-set arguments, exported result
sets, `inherit`, static relative `import`/`builtins.import`, module/import lists,
`callPackage` dependencies, function application, attribute selections, and
same-file callable values. Dynamic imports and interpolation text do not become
static file dependencies. It performs no evaluation, derivation execution,
nixpkgs resolution, or module-system interpretation.

Scanner changes are limited to Dart raw/triple-quoted strings and Nix indented
strings. Native syntax vocabularies and routing now cover both languages; Nix
hash comments and lambda colons are classified without borrowing type syntax.
The dynamic fact builder gained only the metadata fields already present in the
public node contract and a direct-target reference path needed to retain
shadow-safe value-read edges.

Validation passed the focused Dart/Nix suite 6/6, selected native-gated
extraction/resolution/value-reference contracts 37/37, scanner/fact/syntax/
differential/function-reference regression 41/41, and the selected normal-mode
counterpart 51/51. Default UI highlighting passed 33/33. The full native-gated
UI matrix passed 32/33 and retained one pre-existing Ruby definition-token gap
(`class Store` is still an identifier), while all Dart/Nix syntax assertions
passed. Typecheck,
the clean production/UI build, UI artifact verification, the six-fixture
semantic baseline, all 21 CLI/MCP smoke checks, and `git diff --check` pass. A
first semantic-baseline process ended with a transient Windows `0xC0000005`
before assertions; the isolated rerun passed all six fixtures.

The one broad 655-test native extraction campaign recorded 642 assertion
passes, the same six pre-existing C/CUDA semantic gaps, and seven post-assertion
Windows cleanup failures classified `CLEANUP_ONLY_EPERM`. No Dart or Nix
regression was present. These C/CUDA gaps remain explicit closure work rather
than accepted behavior.

Active `web-tree-sitter`/`SyntaxNode` source coupling remains 34 files
(34 → 34). The existing Dart and Nix adapters remain required by normal-mode
fallback, and `tree-sitter-dart.wasm` (984,666 bytes) plus
`tree-sitter-nix.wasm` (80,876 bytes) remain production/release assets. The
clean build still stages all 29 grammar WASM files. No parser package,
lockfile, bootstrap path, grammar asset, attribution, or legal record is
removed, so `web-tree-sitter` and `tree-sitter-wasms` remain production
dependencies.

The native semantic set is now TypeScript, TSX, JavaScript, JSX, Python, Go,
Java, Rust, Kotlin, Scala, C, C++, Objective-C, C#, Swift, ArkTS, Solidity,
PHP, Ruby, Lua, Luau, R, Dart, and Nix. Remaining parser-backed groups are
Pascal, CFML/CFScript/CFQuery, COBOL, VB.NET, and Erlang;
Terraform/OpenTofu; and parser-coupled SFC/template/special-format internals.
Parser bootstrap, default fallback, dependency, and grammar-WASM elimination
remain blocked. Before expanding to another language family, the recommended
next Phase 5F boundary is an evidence-first closure of the six known C/CUDA
native semantic gaps; that work is not started here.

### Native residual contract closure: C/CUDA and Ruby

Commit `ccdca86` closes the seven residuals recorded by the Dart/Nix
checkpoint without adding a language route or changing the normal fallback.
All seven fixtures describe product facts or token classes, not historical
Tree-sitter topology.

The six C/CUDA deltas and their corrections are:

1. A C block comment immediately before a function was not copied into the
   native node's `docstring`. The C-family declaration start also included the
   comment token, leaving no preceding token to inspect. This was a
   `C_FAMILY_NATIVE_REGRESSION`; native declarations now start after leading
   comments and normalize the adjacent documentation token.
2. `__launch_bounds__(...)` was selected as the function name instead of the
   following kernel declarator. This was a `CUDA_EXTENSION_OF_C_CONTRACT`;
   declaration attributes and their balanced argument ranges are excluded from
   callable candidates.
3. A macro-defined kernel indexed the macro parameter (`kernelName`) rather
   than the invocation's concrete first argument (`fwd_kernel`). This was a
   `CUDA_EXTENSION_OF_C_CONTRACT`; continued preprocessor directives are kept
   outside declaration discovery and a structurally proven CUDA definition
   macro names its body from that first invocation argument.
4. A launch through a local function-pointer alias produced no concrete kernel
   calls. This was a `CUDA_EXTENSION_OF_C_CONTRACT`; bounded alias assignments
   now map a launch to every distinct assigned kernel target.
5. A templated CUDA launch in an extension-less header produced no call fact.
   This was a `CUDA_EXTENSION_OF_C_CONTRACT`; the native C++ recognizer now
   captures the bounded `callee<...><<<...>>>(...)` surface directly, so the
   behavior is content-based rather than filename-specific.
6. GNU `__attribute__((section(...)))` was indexed first as `__attribute__`
   and then as `section`, swallowing the actual `RawAttr` function. This was a
   `C_FAMILY_NATIVE_REGRESSION`; attribute call/range candidates are excluded,
   leaving the following real declarator authoritative.

The Ruby UI gap came from incomplete editor input. `class Store` without an
`end` produced no native class fact because container recognition required a
matched terminator; consequently syntax classification had no definition
offset and rendered `Store` as an identifier. The bounded native recognizer now
uses the final available token as the provisional container end. Complete Ruby
ownership remains unchanged, while the native-gated UI matrix moves from
32/33 to 33/33.

Focused validation passed all seven former residuals. The selected C/CUDA
fixture group passed 11/11, native C-family 9/9, dynamic-language coverage
including Ruby and Lua/Luau 13/13, native syntax 8/8, function references
20/20, and the C function-pointer synthesizer 18/18. Two optional real-kernel
sweep tests remained unavailable and skipped. Representative completed-route
coverage for Rust/Kotlin/Scala and Dart/Nix passed 12/12. The equivalent
normal-mode C/CUDA selection passed 11/11 and default UI highlighting passed
33/33.

The repeated broad native extraction campaign recorded 648 normal completions
and seven post-assertion Windows teardown failures, all classified
`CLEANUP_ONLY_EPERM`; no semantic assertion residual remains. The full
native-gated UI matrix passed 33/33. Typecheck, clean production/UI build,
viewer and 29-grammar artifact validation, the six-fixture semantic baseline,
all 21 CLI/MCP smoke checks, and `git diff --check` pass.

Active `web-tree-sitter`/`SyntaxNode` source coupling remains 34 files
(34 → 34). `web-tree-sitter`, `tree-sitter-wasms`, all 29 grammar WASM files,
parser adapters, bootstrap paths, lockfiles, attribution, and legal records are
retained because ungated fallback and remaining parser-backed routes still
require them.

The native semantic language count remains 24. Known legitimate native
C/CUDA and Ruby token residuals are now zero. Parser-backed production groups
still include Pascal, CFML/CFScript/CFQuery, COBOL, VB.NET, Erlang, and
Terraform/OpenTofu, plus parser-coupled SFC/template/special-format internals.
Default fallback and parser bootstrap elimination remain blocked. The next
recommended Phase 5F boundary is a separate evidence-first inventory of the
remaining enterprise routes and dependency-safe slice selection; no such
migration is started by this checkpoint.

### Remaining-route inventory and Pascal native checkpoint

Starting checkpoint `4798089` retained eight named parser-backed production
routes plus parser-coupled special formats. The inventory below records the
actual product contract rather than language-spec completeness. Complexity,
reuse, and coupling describe the pre-change route.

| Route | Runtime/parser path and Afyx contract | Convergence evidence | Classification |
| --- | --- | --- | --- |
| Pascal/Delphi source | Extension registration selected the Pascal WASM and generic `TreeSitterExtractor`, augmented by Pascal-only type/uses/constant/procedure/body walkers and function/value-reference capture. Required facts are unit/program identity, uses dependencies, classes/records/interfaces/enums/aliases, members and visibility, inheritance, calls (including paren-less and typed factory chains), callable values, shared constants, and DFM code-behind resolution. | Complexity MEDIUM; native reuse HIGH; coupling LOCAL; scanner delta SMALL; resolution impact MEDIUM; special-format risk LOW for source and explicitly separated for DFM/FMX; independence MODERATE. Existing coverage: 29 extraction assertions plus function/value-reference, resolution, and DFM pairing gates. | `READY_FOR_NATIVE_REPLACEMENT`; selected and completed here. |
| CFML tags | `CfmlExtractor` loads the CFML grammar, walks tag nodes, and delegates nested script/query bodies to two more parsers. Required facts include components, tag functions/arguments/properties, includes, inheritance/implements, nested calls and typed receiver inference. | Complexity HIGH; reuse MEDIUM; coupling DEEP across three grammars; scanner delta MATERIAL; resolution HIGH; special-format risk HIGH; independence HARD. Twenty-two extraction tests plus dedicated inheritance and receiver suites cover the retained behavior. | `SPECIAL_FORMAT_BOUNDARY`; defer to one dedicated CFML-family design. |
| CFScript | Standalone `.cfs` and bare-script `.cfc/.cfm` files use `TreeSitterExtractor('cfscript')`; tag-based files also delegate `<cfscript>` regions to it. Required facts include anonymous components, functions/methods, properties/variables, imports/includes, construction, calls, inheritance, and typed arguments. | Complexity HIGH in the combined route; reuse MEDIUM; coupling SHARED with `CfmlExtractor`; scanner delta MATERIAL; resolution HIGH; special-format risk HIGH; independence HARD when separated from tag CFML. | `READY_WITH_SHARED_FAMILY`, specifically the CFML/CFScript/CFQuery family; not safe as an isolated checkpoint. |
| CFQuery | The grammar is not a file-extension route; `CfmlExtractor` delegates `<cfquery>` SQL bodies and retains CFML expressions/calls embedded there. | Complexity LOW alone but boundary coupling DEEP; reuse LOW; scanner delta MATERIAL for mixed SQL/CFML; resolution MEDIUM; special-format risk HIGH; independence HARD. | `SPECIAL_FORMAT_BOUNDARY`; close only with CFML family. |
| COBOL | Patched fixed-format COBOL WASM plus a large custom `visitNode` reconstructs flat PROGRAM-ID, section/paragraph extents, PERFORM/THRU, GO TO, literal CALL, CICS LINK/XCTL, SQL INCLUDE, COPY, and hierarchical data/condition entries. Copybook resolution and CICS synthesis consume the facts. | Complexity HIGH; reuse LOW; coupling DEEP; scanner delta MATERIAL (fixed/free format and copybooks); resolution HIGH; special-format risk MEDIUM; independence HARD. Twelve focused extraction assertions exist, but the custom semantic surface and resolver bridges require a standalone campaign. | `REQUIRES_SPECIALIZED_NATIVE_DELTA`. |
| VB.NET | VB.NET WASM and the generic extractor plus language hook cover namespaces, classes/modules/interfaces/structures/enums/delegates, members/events, Imports, Inherits/Implements, calls/index-shaped invocations, construction, and types. XML literals, multi-line LINQ, abstract members, nullable declarators, and case-insensitive syntax are required editor-safe behavior. | Complexity MEDIUM-HIGH; reuse MEDIUM; coupling SHARED; scanner delta MATERIAL; resolution MEDIUM; special-format risk MEDIUM (XML literals); independence MODERATE/HARD. Thirteen focused extraction assertions establish the current contract. | `REQUIRES_SPECIALIZED_NATIVE_DELTA`; it does not share a safe lexical/semantic boundary with Pascal. |
| Erlang | Erlang WASM and custom hooks merge multi-clause functions by name/arity, own modules/records/types/callbacks/specs/macros/includes, and classify local/remote calls, `fun` refs, dynamic MFA, and record uses. Arity matching and behaviour dispatch add dedicated resolver/synthesizer paths. | Complexity HIGH; reuse LOW; coupling DEEP; scanner delta MATERIAL; resolution HIGH; special-format risk MEDIUM for `.app`/`.app.src`; independence HARD. Thirty-four extraction assertions plus arity and behaviour suites cover the current contract. | `REQUIRES_SPECIALIZED_NATIVE_DELTA`; requires a form/arity-specific recognizer, not a generic parser layer. |
| Terraform/OpenTofu | Terraform/HCL WASM and a large custom hook interpret labelled blocks and traversals into resources, data sources, modules, variables, outputs, locals, providers and moved/import relationships. The Terraform framework resolver supplies module-boundary, remote-state and provider-alias behavior. | Complexity HIGH; reuse MEDIUM; coupling DEEP; scanner delta MATERIAL (heredocs/templates/traversals); resolution HIGH; special-format risk HIGH; independence HARD. Twenty-six extraction assertions plus framework integration cover the retained contract. | `REQUIRES_SPECIALIZED_NATIVE_DELTA`; standalone domain checkpoint required. |

The selected slice was Pascal source semantics and syntax classification. It
removed a complete named route, reused the existing scanner, delimiter map,
dynamic fact builder, resolver contracts, and syntax classifier, and needed no
new parser abstraction. Its six-file implementation commit is `8717546`.
VB.NET was not bundled merely because both languages are case-insensitive and
use end-delimited blocks: VB XML literals, LINQ clauses, invocation/index
ambiguity, and statement grammar form a materially different risk boundary.
CFML, COBOL, Erlang, and Terraform each retain dedicated domain semantics that
would make a combined slice neither cohesive nor independently reversible.

The Afyx-native Pascal recognizer consumes scanner tokens directly and emits
the public fact schema. It covers unit/program/library fallback identity;
dotted uses imports; class, record, interface, enum, alias, member and constant
facts; visibility, static methods, signatures and return types; extends and
implements; implementation-only functions; ordinary, paren-less and typed
factory-chain calls; callable values; and shadow-safe same-file constant reads.
The scanner delta is limited to brace and paren-star comments, doubled-quote
strings, and `:=`/`<>`. Incomplete comments produce a bounded warning while
preserving prefix facts. Native syntax classification uses the same facts for
definition offsets plus Pascal keyword/builtin vocabularies.

`AFYX_GRAPH_NATIVE_PARSER=1` routes `.pas`, `.dpr`, `.dpk`, and `.lpr` source
to this recognizer without requesting `getParser()`. `.dfm` and `.fmx` remain
on their existing parser-free `DfmExtractor`; the explicit route exclusion is
covered by the broad native campaign. Ungated/default Pascal remains on the
Tree-sitter fallback.

#### Special-format inventory

| Format/route | Current dependency and semantic purpose | Future closure |
| --- | --- | --- |
| Svelte | Regex locates `<script>` regions; semantic extraction delegates JS/TS to `TreeSitterExtractor`. Native-gated viewer syntax already tokenizes those regions natively. | Route semantic delegation through the established native JS/TS fact entry point while preserving source offsets and Svelte template facts. |
| Vue | Same direct JS/TS parser delegation pattern for script blocks, plus Vue template/store facts and router synthesis. Native-gated syntax regions are already native. | Dedicated offset/ownership adapter around native JS/TS facts; retain Vue template semantics. |
| Astro | Frontmatter and script regions delegate directly to the TypeScript parser while markup facts remain custom. Native-gated syntax regions are already native. | Dedicated region-offset adapter using native TypeScript facts. |
| Razor/Blazor | Custom markup extraction delegates `@code`/C# regions directly to `TreeSitterExtractor('csharp')` for component logic and types. | Dedicated C# region adapter preserving markup-to-code ownership and `_Imports.razor` behavior. |
| CFML/CFScript/CFQuery | Three parser grammars cooperate inside one mixed tag/script/query semantic route. | A dedicated family-native design; do not emulate the three ASTs. |
| DFM/FMX | `DfmExtractor` is already parser-free and emits component hierarchy/event refs; sibling Pascal code-behind is now native-gated. | No parser replacement needed; keep the format boundary and pairing regression. |
| Liquid | Custom lexical/template extractor; no `web-tree-sitter`/`SyntaxNode` dependency. | No parser replacement needed. |
| MyBatis XML | Custom XML mapper extractor; no Tree-sitter dependency. | No parser replacement needed. |
| YAML, Twig, properties | File-level-only routes at this stage; no symbol parser is invoked. Framework resolvers may add bounded file facts. | No grammar migration until a new product contract requires symbol semantics. |

#### Validation and independence state

- Focused Pascal native contract and differential: 51/51 PASS (including the
  new 4/4 direct seam suite); normal-mode Pascal counterpart: 47/47 PASS.
- Shared scanner/fact/syntax/differential/function-reference/branch-guard/UI
  campaign: 137/137 PASS; native UI remains 33/33 PASS.
- The broad native extraction campaign completed 648 semantic assertions and
  recorded the same seven post-assertion Windows temp-directory cleanup
  failures, classified `CLEANUP_ONLY_EPERM`; semantic residuals are zero.
- TypeScript typecheck, clean production/UI build, viewer and 29-grammar
  artifact validation, six-fixture semantic baseline, all 21 CLI/MCP smoke
  checks, and `git diff --check` pass.

Native semantic languages increase from 24 to 25. Named parser-backed routes
decrease from eight to seven: CFML, CFScript, CFQuery, COBOL, VB.NET, Erlang,
and Terraform/OpenTofu remain. Active `web-tree-sitter`/`SyntaxNode` source
coupling remains 34 files (34 → 34), and staged grammar WASM remains 29
(29 → 29). The Pascal adapter and `tree-sitter-pascal.wasm` remain active
default production fallback and release assets; they are neither obsolete nor
test-only. Default fallback and parser bootstrap remain ACTIVE, so parser
packages, lockfiles, grammar assets, legal records, and attribution stay in
place.

The next dependency-safe Phase 5F boundary is VB.NET native semantic and syntax
convergence. It has a bounded single-language route and meaningful native
scanner/fact reuse, while avoiding the deeper multi-grammar/domain resolver
boundaries of CFML, COBOL, Erlang, and Terraform. That boundary is not started
by this checkpoint.

### VB.NET native semantic and syntax checkpoint

Starting checkpoint `7e02e85c096b0b19d696b5304d9d024c0ef255d2` retained
VB.NET as one of seven named parser-backed routes. Commit `a95b50a` adds a
feature-gated, dependency-free VB.NET recognizer and native syntax route. With
`AFYX_GRAPH_NATIVE_PARSER=1`, `.vb` semantic extraction and highlighting use
scanner tokens and emit Afyx facts directly; a structural seam test proves
that supported extraction does not request `getParser()`. Ungated/default mode
still uses the established VB.NET Tree-sitter adapter.

The required product contract is deliberately smaller than the language
specification. It includes namespaces; classes, modules, structures,
interfaces, enums and delegates; methods, constructors, properties, fields,
constants-as-established-members and events; Imports; Inherits/Implements;
user return/header types; calls, index-shaped invocation candidates and
construction; ownership; mixed-case keywords; and bounded incomplete editor
input. Operators, Roslyn binding, full default-property inference, LINQ query
evaluation, XML DOM semantics, and a complete Visual Basic grammar are outside
the observed contract. The existing resolver performs exact symbol-name
lookup, so this slice does not globally case-fold identifiers. It preserves
original identifier spelling while all VB keyword/modifier/type comparisons
inside the native boundary are case-insensitive; the controlled OLD/NEW
differential includes a differently-cased call reference and remains
identical.

XML literals are opaque scanner tokens because Afyx requires the surrounding
VB routine and sibling facts, not XML internals. A complete root or self-closing
literal is consumed as one bounded region; malformed editor input is limited
to the current line and produces the standard native incomplete-source
warning. LINQ remains ordinary routine-owned token flow, preserving calls such
as `big.Sum()` without representing query-clause topology. Parenthesized
`foo(...)` remains a call candidate, matching the previous adapter's deliberate
invocation/index ambiguity policy; unresolved index-shaped candidates simply
do not become graph edges. Multiline lambdas are range-balanced so calls stay
owned by the enclosing named routine, but lambdas do not become new public
nodes. No public parser-backed VB.NET branch-guard contract exists, so no guard
or control-flow subsystem was added.

The scanner delta is limited to apostrophe and statement-position `REM`
comments, doubled-quote/interpolated strings, bracketed identifiers, and the
bounded XML policy. Syntax classification uses the native definition facts,
case-folded VB keyword/builtin vocabularies, and `As` type context. Tests cover
the prior 13 extraction assertions, direct OLD/NEW semantic parity, native
seam isolation, XML/comment/string boundaries, mixed-case syntax, multiline
lambda ownership, and incomplete input.

Validation results:

- Focused scanner/syntax/VB suite: 21/21 PASS, including the new 6/6 native
  contract/seam tests.
- Existing VB.NET extraction contract under native mode: 13/13 PASS; the same
  default/ungated counterpart remains 13/13 PASS.
- Shared fact/differential/function-reference/native UI campaign: 59/59 PASS;
  the native UI matrix remains 33/33 PASS.
- Remaining completed-route native suites: 66/67 PASS. The sole failure is the
  pre-existing Go branch-boundary fixture (`outer` guard leakage); the four
  guard source/test files are byte-identical to the starting checkpoint and
  the scanner delta executes only when `vbnetSyntax` is enabled. It is not a
  VB.NET or scanner regression and is not widened into this boundary.
- Broad native extraction: 648 semantic assertions PASS, zero semantic
  residuals, plus seven post-assertion Windows temp-directory failures
  classified `CLEANUP_ONLY_EPERM`.
- Typecheck, clean production build, UI build, viewer/29-grammar artifact
  verification, six-fixture semantic baseline, all 21 CLI/MCP smoke checks,
  and `git diff --check` PASS.

Native semantic languages increase from 25 to 26 and known native semantic
gaps remain zero. Named parser-backed routes decrease from seven to six:
CFML, CFScript, CFQuery, COBOL, Erlang, and Terraform/OpenTofu. Active
`web-tree-sitter`/`SyntaxNode` source coupling remains 34 files (34 → 34), and
staged grammar WASM remains 29 (29 → 29). The 6,477,499-byte
`tree-sitter-vbnet.wasm`, VB adapter, parser bootstrap, `web-tree-sitter`, and
`tree-sitter-wasms` remain active default-production/release dependencies, not
obsolete assets; no package, lockfile, attribution, or legal record is removed.

Remaining special-format coupling is unchanged: Svelte, Vue, and Astro retain
script-region delegation; Razor/Blazor retains C# region delegation; and the
CFML/CFScript/CFQuery family retains its mixed three-grammar orchestration.
The next dependency-safe Phase 5F boundary is Erlang native semantic and syntax
convergence: it is a single named route with a contained form/arity contract,
whereas COBOL, Terraform/OpenTofu, and the CFML family have deeper domain or
mixed-format resolver boundaries. That boundary is not started here.

### Go native branch-boundary residual closure

The VB.NET checkpoint exposed one older completed-route residual in the shared
native guard campaign: a Go call inside `callback := func(){ ... }` incorrectly
inherited the enclosing function's preceding `if outer { return }` guard. The
failure reproduced independently and deterministically 3/3. Its primary
classification is `FUNCTION_BOUNDARY_OWNERSHIP_BUG`.

The native scanner has always emitted Go's short assignment as the compound
token `:=`. `functionBoundary()` recognized an assigned Go function literal
only when scanning backward found `=` or the legacy split pair `:` plus `=`.
It therefore failed to mark the literal body as a new execution boundary and
allowed the outer early-return guard to reach the inner call. Commit `92acfa9`
adds the missing compound-token recognition. It does not change scanners,
fact extraction, resolver behavior, or any non-Go branch rule.

The original isolation fixture now passes, and a durable regression proves
both halves of the contract: `outer` is absent while a legitimate `if inner`
inside the literal remains attached to `run()`. Focused regression is 2/2;
the complete native/legacy branch-guard selection is 70/70; and the campaign
that previously recorded 66/67 now passes all 67 original assertions plus the
new regression (68/68). Go extraction passed 8/8 and shared native
differential/fact/syntax/function-reference/resolution coverage passed 47/47.

The broad native extraction campaign again completed 648 semantic assertions
with zero residuals and seven post-assertion Windows temp-directory failures
classified `CLEANUP_ONLY_EPERM`. Native UI remains 33/33. Typecheck, clean
production/UI build, viewer and 29-grammar artifact verification, the
six-fixture semantic baseline, all 21 CLI/MCP smoke checks, and
`git diff --check` pass.

This correction changes no third-party boundary: native semantic languages
remain 26, named parser-backed routes remain six, known native semantic gaps
move from one to zero, active `web-tree-sitter`/`SyntaxNode` coupling remains
34 files, staged grammar WASM remains 29, and default fallback plus parser
bootstrap remain active. The next boundary remains Erlang native semantic and
syntax convergence; it is not started here.

### Erlang native semantic and syntax checkpoint

Starting checkpoint `2fba81c9f35bb18ee925e43d18cbbba2af06d46d`
retained Erlang as one of six named parser-backed routes. Commit `934e47c`
adds a feature-gated, dependency-free Erlang recognizer and native syntax
route. With `AFYX_GRAPH_NATIVE_PARSER=1`, `.erl`, `.hrl`, `.escript`, `.app`,
and `.app.src` semantic extraction uses scanner tokens and emits Afyx facts
directly; a structural seam test proves that the route does not request
`getParser()`. Ungated/default mode continues to use the Erlang grammar and
adapter.

The retained contract is form- and arity-based rather than a compiler model.
`-module` owns declarations, while functions retain a bare display name and
use `module::name/arity` identity. Clauses in one period-terminated form merge
into one logical function; same-name functions with different arities remain
distinct. Export state is arity-specific and `export_all` remains supported.
The bounded attribute surface covers imports/includes, behaviours, records and
fields, type/opaque aliases, preceding matching specs, callbacks as
non-symbol type declarations, and macros as constant/link boundaries. Macro
replacement bodies own their calls, use sites link to the macro, predefined
macros remain silent, and no preprocessor expansion is attempted.

Local calls use `name/arity`, static remote calls use
`module::name/arity`, and variable module/function dispatch stays silent.
`fun name/arity`, `fun module:name/arity`, record uses, statically evident
spawn/apply-family MFA arguments, and established `gen_server` registered-name
handler conventions are preserved. Anonymous and named-fun bodies remain
owned by the enclosing public function; no anonymous public node is invented.
Application resource terms retain callback-module and dependency references.
No public Erlang branch-guard contract exists, so case/receive/if/try clauses
receive no invented control-flow facts.

The scanner delta is limited to percent comments, quoted atoms, ordinary
strings, character literals, Erlang number/form termination, and binary-aware
arity counting. Existing delimiter handling covers tuples, lists, records and
maps. Incomplete strings or delimiters remain bounded and preserve prefix
facts. Native syntax adds Erlang attribute/control/operator vocabulary and
uses the semantic facts to identify function definitions. This intentionally
improves the function name from the grammar route's plain `ident` class to
`def`; other controlled syntax classes remain equal.

Validation results:

- New native contract/differential/seam/syntax/incomplete/boundary suite: 7/7
  PASS. The direct semantic and syntax proofs observe no parser request.
- Established Erlang extraction under native mode: 34/34 PASS; the same
  default/ungated contract remains 34/34 PASS.
- Erlang arity resolution and behaviour synthesis: 8/8 PASS, including binary
  literal arity handling. Total focused Erlang evidence is 49/49 PASS.
- Shared completed-route fact/syntax/differential suites: 66/66 PASS; scanner
  and branch-boundary regressions: 18/18 PASS.
- Broad native extraction completed 648 semantic assertions with zero semantic
  residuals. The same seven Windows temp-directory cleanup failures remain
  classified `CLEANUP_ONLY_EPERM`.
- Native UI highlighting remains 33/33 PASS. TypeScript typecheck, clean
  production/UI builds, viewer/29-grammar artifact verification, the standard
  six-fixture semantic baseline, all 21 CLI/MCP smoke checks, and
  `git diff --check` pass.

Native semantic languages increase from 26 to 27 and known native semantic
gaps remain zero. Named parser-backed routes decrease from six to five: COBOL,
Terraform/OpenTofu, CFML, CFScript, and CFQuery. Active
`web-tree-sitter`/`SyntaxNode` source coupling remains 34 files (34 → 34), and
staged grammar WASM remains 29 (29 → 29). The Erlang adapter and grammar asset
remain active default-production fallback and packaged release dependencies;
they are not obsolete, build-only, or test-only. Default fallback and parser
bootstrap remain ACTIVE, so no parser package, WASM, lockfile, attribution, or
legal record is removed.

Remaining special-format coupling is unchanged: Svelte, Vue, and Astro retain
script-region delegation; Razor/Blazor retains C# region delegation; and the
CFML/CFScript/CFQuery family remains a single mixed-format three-grammar
boundary. The next dependency-safe Phase 5F boundary is Terraform/OpenTofu
native semantic and syntax convergence: it is one cohesive named route with
meaningful scanner/fact reuse, while COBOL requires its fixed-format and
copybook campaign and the CFML family requires a combined mixed-format design.
That boundary is not started here.
