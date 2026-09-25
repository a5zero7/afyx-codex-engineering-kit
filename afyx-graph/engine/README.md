# Afyx Graph engine

This directory contains the vendored Afyx Graph engine. Build and test it from
this directory with `npm ci`, `npm run build`, and `npm test`.

Install and release Afyx Graph only through the kit-level scripts and workflows:
`scripts/install-afyx-graph.ps1`, `scripts/install-afyx-graph.sh`,
`.github/workflows/graph-build.yml`, and `.github/workflows/graph-release.yml`.

The engine is based on CodeGraph 1.6.0. Upstream provenance and MIT attribution
are retained in `../afyx-graph.json`, `../THIRD_PARTY_NOTICES.md`, and
`../LICENSES/CodeGraph-MIT.txt`.
