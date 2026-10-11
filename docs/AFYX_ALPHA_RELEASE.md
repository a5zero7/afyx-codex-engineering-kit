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

The accepted initial candidate is commit
`a431ba9ad5fae7bd06329f1fc6e42f1ba503f6dd`, verified by
[CI 38134702686](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38134702686)
and
[Afyx Graph Build 38134702720](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/38134702720).
Both workflows passed on Windows, Linux, and macOS. The retained archive
digests were downloaded and independently matched against their manifests:

| Target | Archive SHA-256 |
| --- | --- |
| `win32-x64` | `ade92e800b1ab129b89b76df33852d54cf1c20eaf32e16467b8a5ec0b295e8b9` |
| `linux-x64` | `6bfbc8799ffe9f3578e5345cc4a3a4361da497c5112947070e8089feec4bc8e2` |
| `darwin-arm64` | `369e00e0e8946c8ba62cb944068524030801d2c2311ae251b33a57dc30409f9e` |

The GitHub Actions container digests are separate transport-integrity values;
the table records the actual Afyx Graph archive digests bound by the candidate
manifest. Publisher authenticity remains `UNVERIFIED`; no stable release or
stable tag was created.

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

The Windows candidate was also built and installed locally under a disposable
runtime root. Its revision reported `MATCH`; restoring the prior
`fd96cd3a9ad41fc98346b46c56f3ade8e73cc1e8` artifact restored that source
identity and working CLI without touching the active user runtime.
