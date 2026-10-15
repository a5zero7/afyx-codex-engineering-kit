# Afyx Graph engine

This directory contains the Afyx Graph engine. Build and test it from this
directory with `npm ci`, `npm run build:clean`, and `npm test`.

Regression gates, all local and deterministic (no model calls):

- `npm run test:semantic` compares the built engine with the frozen structural
  snapshot in `tests/semantic-baseline.json` (see `tests/semantic-baseline.meta.json`
  for its provenance). Never refreeze it from this implementation.
- `npm run test:smoke` drives the built CLI and the MCP server end to end.
- `npm test` runs the unit suites and first refuses stale build artifacts
  (`scripts/check-dist-clean.mjs`).

Project state lives in `.afyx-graph/` (database `afyx-graph.db`, override the
directory name with `AFYX_GRAPH_DIR`). An optional, committed `afyx-graph.json`
at the project root maps custom file extensions to supported languages.
The shipped product requires external Node.js 22.5.0 or newer on `PATH`; release
archives do not bundle Node or a `node_modules` dependency tree.
`afyx-graph status` reports index freshness (`MISSING`, `FRESH`, `STALE`,
`INVALID`, `UNKNOWN`) from `.afyx-graph/freshness.json`, which the engine
rewrites after every successful index or sync. Afyx Graph makes no outbound network
requests and collects no telemetry.

## File catalog coverage

The persisted file catalog reports one explicit depth per indexed file:

- `metadata`: path, content hash, language, size, and timestamps only;
- `content`: reserved for a future bounded searchable-content contract;
- `structural`: the native structural extraction contract ran, including valid
  files that contain no declarations and therefore produce zero symbols.

Generic Markdown (`.md`, `.markdown`) and JSON (`.json`) are metadata-indexed.
Their prose and values do not enter symbol search, FTS, nodes, or edges. Shopify
`templates/**/*.json` and `sections/**/*.json` retain their existing Liquid
structural route. PowerShell and shell files retain bounded direct-source
inspection but are not part of native structural extraction in this change.

`status`, MCP status, Inventory coverage, and Files metadata distinguish these
depths. Discovery accounting keeps ignored paths unenumerated; `ignored` remains
unknown rather than leaking excluded names. Existing `.gitignore`, Git exclude,
project exclude/include, path-safety, and generated-file rules apply before a
file may enter the catalog.

Install and release Afyx Graph only through the kit-level scripts and workflows:
`scripts/install-afyx-graph.ps1`, `scripts/install-afyx-graph.sh`,
`.github/workflows/graph-build.yml`, and `.github/workflows/graph-release.yml`.

Afyx Graph is licensed under the MIT License in `LICENSE`. Historical
implementation and attribution evidence is retained in the repository's Phase
5 documentation and Git history; it is not part of the current release payload.
