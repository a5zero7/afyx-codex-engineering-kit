# Afyx Technical Alpha release governance

The Technical Alpha is a prerelease channel. It does not publish or imply a
stable `v1.0.0` release.

## Branch ownership

- `main` is the canonical integration branch.
- `afyx/native-phase5f-parser-grammar` remains the ongoing engineering branch.
- `release/alpha-0.1` accepts only reviewed promotions and approved Alpha
  stabilization fixes.

Create promotion pull requests from the development branch into
`release/alpha-0.1`. Each promotion must identify the exact source commit and
must pass both `CI` and `Afyx Graph Build` on Windows, Linux, and macOS. Never
rewrite the Alpha branch. An urgent Alpha hotfix is committed through review on
the Alpha branch and then merged or cherry-picked back into the development
branch so the branches cannot silently diverge.

## Candidate identity

A branch tip is mutable and is not a release candidate identity. A candidate is
the tuple:

```text
channel=technical-alpha
series=alpha-0.1
source_revision=<full Git commit SHA>
target=<OS-architecture>
archive_sha256=<64 lowercase hex characters>
provenance=<GitHub Actions run and commit-bound manifest>
```

`product_version` remains `1.0.0` for installer compatibility; the prerelease
truth is carried by `release_channel=technical-alpha` and the Alpha series/SHA.
The Graph Build workflow creates `ALPHA-CANDIDATE-MANIFEST.json`, verifies it
against the archive's embedded metadata, and retains the archive plus manifest
as a SHA-named workflow artifact. These artifacts are candidate inputs, not a
stable GitHub Release. Publisher authenticity remains `UNVERIFIED` unless an
independent attestation is added and verified.

The initial candidate matrix is completed from the exact final workflow run:

| Candidate field | Required value |
| --- | --- |
| Branch | `release/alpha-0.1` |
| Channel / series | `technical-alpha` / `alpha-0.1` |
| Source revision | Exact successful workflow SHA |
| Platforms | `win32-x64`, `linux-x64`, and the hosted macOS architecture |
| Digest | Per-target SHA-256 in the retained candidate manifest |
| Provenance | Exact Graph Build run URL plus commit-bound manifest |

## Isolated acceptance and rollback

Download one archive and its manifest from the exact successful Graph Build
run. Verify the manifest before installation with
`scripts/afyx-graph-artifact.mjs verify-release-manifest`. Install only into a
disposable `AFYX_GRAPH_RUNTIME_ROOT` and bin directory, verify that installed
`source_revision` is `MATCH`, then run CLI/MCP smoke. Do not update the active
user runtime during candidate acceptance.

Before any later controlled deployment, retain the current runtime directory
and its metadata as the rollback unit. Rollback restores that verified unit
through the normal transactional installer path and reruns `--validate-only`;
it does not reset Git branches or overwrite MCP configuration.
