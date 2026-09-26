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
`afyx-graph status` reports index freshness (`MISSING`, `FRESH`, `STALE`,
`INVALID`, `UNKNOWN`) from `.afyx-graph/freshness.json`, which the engine
rewrites after every successful index or sync. Afyx Graph makes no outbound network
requests and collects no telemetry.

Install and release Afyx Graph only through the kit-level scripts and workflows:
`scripts/install-afyx-graph.ps1`, `scripts/install-afyx-graph.sh`,
`.github/workflows/graph-build.yml`, and `.github/workflows/graph-release.yml`.

Portions of Afyx Graph incorporate software originally authored by Colby Mchenry
and distributed under the MIT License. The applicable copyright and permission
notice is in `LICENSE`, `../LICENSES/THIRD_PARTY_ENGINE_MIT.txt`, and
`../THIRD_PARTY_NOTICES.md`.
