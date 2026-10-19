# Phase 7 — Engineering Assurance and Prompt Master Default Retirement

Status: **IMPLEMENTED / FOCUSED LOCAL VALIDATION PASS / EXACT-HEAD CI PENDING / OWNER REVIEW PENDING**

Stacked baseline: Phase 6 PR #79 at
`b7fddb76264244803d723cca5537f9e2ddc0238c`. The Phase 7 branch must remain
stacked on the Phase 6 branch until PR #79 is merged and its ancestry/effective
diff is reconciled. No automatic merge or Alpha promotion is authorized.

## Phase 6 boundary review

| Checkpoint | Result |
|---|---|
| PR #79 exact source identity | PASS — `b7fddb76264244803d723cca5537f9e2ddc0238c` |
| CI run `39227026045` | PASS — Windows, Linux, macOS |
| Ownership-aware scope and preservation | PASS from reviewed source and focused evidence |
| Owner isolated Windows install/post-install/idempotency evidence | NOT VERIFIED — no separately attributable public evidence was available in PR #79 |
| Native-Windows repository suite | FAIL retained — 25 Forge POSIX/WSL environment errors, no Phase 6 assertion failure |
| Independent review / owner merge decision | PENDING |

## Frozen-v1 preset amendment

| Preset | Desired components |
|---|---|
| Minimal | Efficient Coding + Odoo Engineering |
| Recommended | Minimal + Afyx Engineering Expert |
| Full | Recommended + Afyx Graph + platform-applicable Usage Tracking |
| Custom | Explicit ordered operator selection, including Prompt Master when deliberately requested |

Prompt Master remains an upstream-owned `EXTERNAL` component with its historical
provenance and rollback contract intact. Default install, update, repair, verify,
Recommended, and Full paths neither fetch nor require it. Existing user-owned or
disabled state is preserved. Explicit Custom/component actions retain the pinned,
fail-closed upstream lifecycle. This is default retirement, not a Forge replacement.

## Assurance contract

`scripts/engineering-assurance.json` defines the frozen vocabulary. The validator
`scripts/validate-engineering-assurance.py` validates the contract by default and
optionally a task record:

```text
python scripts/validate-engineering-assurance.py
python scripts/validate-engineering-assurance.py --record <record.json> --expected-head <40-char-sha>
```

The record declares its Task Contract baseline, source SHA, relevant-source digest,
acceptance revision, allowed/changed scope, and evidence-backed ground truth. The
validator is deliberately a record-schema validator: these source, scope, CI, and
evidence identities are `SELF_DECLARED`, not independently discovered facts. Its
successful record result is `SCHEMA_VALID` with
`INDEPENDENT_VERIFICATION_REQUIRED`; a reviewer or trusted automation must still
verify the Git source/diff and CI identities before acceptance.
Validation Level 1 requires static and focused evidence; Level 2 adds negative and
regression evidence; Level 3 adds security and rollback evidence. Mutation,
differential, and measured performance proof are mandatory only when their risk flags
are set. Performance uses a numeric value, threshold, comparator, and unit and can
never override correctness or security failure.

Only `PASS`, `FAIL`, `NOT_RUN`, and `BLOCKED` are accepted. An `AFFIRMATIVE`
Ground Truth claim requires `PASS` evidence. A separately classified
`NEGATIVE_OBSERVATION` may cite only `FAIL`, `BLOCKED`, or `NOT_RUN`, preserving
real negative evidence without allowing it to prove success. `NOT_RUN` needs an
`UNSUPPORTED`, `DEFERRED`, or `ENVIRONMENT` disposition and reason. `FAIL`/`BLOCKED`
needs an owner, resolution, and expected acceptance evidence; required-v1 failures
block readiness. Evidence reuse requires matching relevant-source digest, acceptance
revision, and scope fingerprint plus no new relevant failure. Validation-budget
overrun needs an explicit reason.

`MERGE_READY` requires a record declaring a clean baseline, no scope violation,
eligible ground truth, the risk-level test set, and explicit CI/documentation PASS
evidence. This is schema-valid merge-readiness input, not independent acceptance.
The canonical lifecycle remains:

```text
PLANNED → ANALYZED → IMPLEMENTED → VALIDATED → DOCUMENTED → MERGE_READY
```

## Requirement-to-implementation matrix

| Requirement | Implementation | Status |
|---|---|---|
| Task Contract / Baseline / Scope / Ground Truth | Canonical repository-relative scope validation, status-eligible claims, and explicit self-declared authority | PASS |
| Risk Levels 1/2/3 | Cumulative required test kinds | PASS |
| Mutation / Differential Proof | Conditional risk flags and named PASS evidence | PASS |
| Performance Gate | Numeric threshold-bound measurement | PASS |
| Adaptive budget / evidence reuse | Budget-overrun justification and exact relevance binding | PASS |
| Failed/skipped classification | Closed vocabulary and fail-closed metadata rules | PASS |
| CI / docs / merge readiness | Explicit gates tied to canonical lifecycle | PASS |
| Prompt Master default retirement | Unified component plan and lifecycle entrypoints | PASS |
| Daily-runtime compatibility | PASS in disposable focused workflows; active user runtime NOT TOUCHED |
| Exact-head cross-platform CI | PENDING |

Local focused evidence: component contract PASS; engineering-assurance 13/13 PASS;
control-plane 11/11 PASS. The current native-Windows scripts suite executed 240
tests with zero assertion failures and 15 environment errors in the same three Forge
POSIX/WSL modules: three synthetic-image compiler-path cases, six WSL-container
identity cases, and six WSL-lab identity cases. This current result is `FAIL`; the
earlier 25-error run remains separate historical `FAIL` evidence and is not rewritten.
Broader unchanged regression evidence may be reused only where its source and
acceptance scope remain valid. Exact-head CI and final SHA are recorded on the
stacked Draft PR, not inferred here.

## Limits and Phase 8 handoff

Phase 7 is development assurance only. It does not self-approve an independent
review, merge Phase 6/7, replace the active runtime, activate Alpha, or authorize a
release. T05 Adit remains `DEFERRED BY OWNER`. T09 remains `BLOCKED — 0/36`; A8 has
no GO decision and production Forge is not implemented. Phase 8 may begin only from
the separately approved merged ancestry and must reuse this exact assurance evidence
unless relevant source, acceptance criteria, or failures change.
