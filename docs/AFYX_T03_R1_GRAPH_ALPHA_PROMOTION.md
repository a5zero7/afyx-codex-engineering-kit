# T03.R1 — Graph-only Technical Alpha promotion

Status: **IMPLEMENTED LOCALLY; EXACT-HEAD CI AND OWNER MERGE DECISION PENDING**

## Reconciliation baseline

- Promotion base: `alpha` at `760778e709ec99e85fded58d10a0efc0350abaa9`.
- Reviewed development source: `dev` at `dcebee5a08d3b958d757d056336a3eef7e9653e9`.
- Permanent local branches were fast-forwarded to their matching remote refs.
- The temporary promotion branch is `afyx/t03-r1-graph-alpha-promotion` and has no inherited `origin/alpha` upstream.
- Five obsolete local branches were deleted only after ancestry and unpublished-commit checks passed. The linked AFYX-279 worktree was removed non-force after tracked/untracked cleanliness and generated-only ignored contents were verified. Detached historical audit worktrees were preserved.

## Inclusion matrix

| Capability | Source commits | Included closure |
|---|---|---|
| AFYX-280 bounded ranked discovery | `4572dc2`, `e508732` | `limit + 1` truncation detection, bounded wording, MCP/search/security regressions |
| AFYX-281/282 exact structural inventory | `d728a20`, `c16ff5c`, `ef8777a`, `0a9615d`, `2e81388`, `7c3026f`, `8837ea9` | extraction-v28 property facts, inventory CLI/MCP, exact totals and pagination, scoped coverage, frozen semantic-oracle LF identity, positive/negative/restart/path regressions |
| T02 tiny-project MCP correction | `7fe9328` | inventory remains exposed for the supported two-tool tiny-project allowlist; smoke and allowlist regressions |
| Universal File Catalog Foundation | `ef711d6` | file catalog schema/migration, extraction admission, language metadata, persisted file attributes, freshness/status/read APIs, fixtures and recovery/incremental tests |

The resulting `afyx-graph/engine` tree is byte-equivalent to the accepted
`dev` Graph tree. Provenance is retained through `cherry-pick -x` records.

## Explicit exclusions and preservation

- `5989661` was not replayed: PR #59 already supplied the accepted Alpha dependency-security remediation, lockfile, immutable action pins, workflows, installer fallback, and release-manifest governance.
- Graph Build/Release workflows, package manifests/lockfile, Vitest configuration, and Graph installer scripts remain byte-equivalent to the starting `alpha` tree.
- Forge, Engineering Expert, optional skills, evaluator/runtime work, provider experiments, and post-v1 expansion are excluded.
- The deleted legacy Alpha integration roadmap was not resurrected. Relevant promotion evidence is recorded here and in the focused PR.
- The previously accepted candidate `a431ba9ad5fae7bd06329f1fc6e42f1ba503f6dd` remains active until a replacement is explicitly accepted.

## Local validation evidence

| Check | Actual result |
|---|---|
| Clean TypeScript and UI production build | **PASS** |
| Focused Graph integration tests | **PASS** — 12 files; 870 passed, 2 declared skipped |
| Semantic baseline | **PASS** — extraction-v28 additive contract and 6 frozen fixtures |
| CLI/MCP smoke | **PASS** — 21 checks |
| Graph identity/metadata and independence audit | **PASS** |
| Release-manifest/artifact identity tests | **PASS** — 4/4 |
| `git diff --check` | **PASS** |
| Full Windows-local Vitest run | **FAIL (environment-bound)** — 5,673 passed, 31 skipped, 25 failed across 10 files; failures were dominated by temp-directory cleanup `EPERM` |
| Targeted serial rerun of only failed files | **FAIL (environment-bound)** — 267 passed; 21 failed across 6 files: temp-directory cleanup `EPERM` plus one old-Git shim `spawnSync ENOENT` |

The Windows-local failures are not relabelled PASS. The affected Graph feature
contracts passed in the focused run. Full deterministic Graph regression must
pass on the exact PR head in the Linux Graph Build job; Windows and macOS jobs
must pass their declared build, semantic, smoke, installer, and artifact gates.

## Pending acceptance

Before merge, the focused PR into `alpha` requires review plus exact-head CI
and Afyx Graph Build success on Linux, Windows, and macOS. This promotion does
not itself create or accept a new Technical Alpha candidate. After separately
authorized merge, candidate identity must use the resulting `alpha` merge SHA
and retained inner archives/manifests—not the PR head or Actions wrapper ZIP.
