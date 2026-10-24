# T09 A4-A8 public closure and owner/evaluator handoff

## Status

- **PUBLIC IMPLEMENTATION READY**
- **OWNER/EVALUATOR INTEGRATION PENDING**
- **FORMAL CAMPAIGN BLOCKED — 0/36**
- **A8 — NO GO DECISION**

This checkpoint audits public source at `dcebee5a08d3b958d757d056336a3eef7e9653e9`.
Exact-source GitHub Actions run
[`39125023590`](https://github.com/a5zero7/afyx-codex-engineering-kit/actions/runs/39125023590)
reported success on Windows, Linux, and macOS. Those public CI results do not prove
owner/evaluator runtime isolation or private evidence durability.

## Public implementation closure

The Route B B0-B5 matrix and 36-cell order are frozen. The public controller
implements manifest-bound inputs, safe materialization, a restricted-launcher
interface, bounded inventory and evidence, fail-closed stream completeness,
artifact verification, sanitization, and cleanup precedence. The public evidence
retention contract adds schema-v2 receipt requirements, strict verifier return
semantics, correlation, fresh challenges, replay rejection, and finalization before
an operational PASS.

No remaining reproducible public contract defect was found. Additional public
controller refactoring would not establish the privileged properties still missing.
The minimum viable evaluator path is the native Windows E1 boundary defined in
[AFYX_FORGE_T09_E1_SECURE_HANDOFF.md](AFYX_FORGE_T09_E1_SECURE_HANDOFF.md).
The E4-E8 and P5 WSL/container work is reusable public synthetic evidence only:
it neither authorizes installation nor proves independent evaluator identity.

## Seven unresolved authorization gates

| Gate | Current evidence | Technically missing | Authority | Minimum acceptance proof | Stop condition |
|---|---|---|---|---|---|
| `OWNER_APPROVED_RUNTIME_CONFIGURATION` | Public runtime contract only | Exact approved native Windows runner configuration and immutable identity | Owner | Signed/sanitized configuration attestation bound to campaign identity | Configuration is absent, mutable, or mismatched |
| `INDEPENDENTLY_ENFORCED_EVALUATOR_ISOLATION` | Public synthetic controls only; formal isolation `NOT_TESTED` | Actual restricted identity, deny boundaries, process containment, timeout, cleanup, and negative controls | Independent evaluator | Correlated E1 positive/negative evidence from the real boundary | Developer/evaluated agent can reach evaluator assets or containment is unproved |
| `EXPLICIT_36_CELL_BUDGET_APPROVAL` | Frozen 36-cell order; execution disabled | Explicit total campaign budget authorization | Owner | Approval bound to the frozen manifest and campaign identity | Budget is absent, ambiguous, or exceeded |
| `EXPLICIT_CONFIRMATION_BUDGET_APPROVAL` | Confirmation policy is not authorized | Explicit bounded confirmation/retry allowance | Owner | Separate approval stating limits and stop behavior | Confirmation allowance is absent or would permit unbounded retries |
| `INDEPENDENT_EVALUATOR_ARRANGEMENT_APPROVAL` | Roles documented; no accepted private arrangement | Named independent control and review arrangement | Owner and independent evaluator | Sanitized attestation of control, separation, reviewer, and retention responsibilities | Independence or reviewer authority is unverified |
| `FINAL_CAMPAIGN_EXECUTION_APPROVAL` | Readiness gate intentionally fails closed | Final approval after all preceding gates pass | Owner | Immutable campaign envelope plus explicit execution authorization | Any prerequisite remains unresolved or identity drifts |
| `EVALUATOR_ONLY_BUNDLE_FREEZE` | Public fixtures/candidates frozen; private bundle identity is null | Private rubric/holdout/canary bundle frozen outside developer and evaluated-agent access | Independent evaluator | Sanitized bundle digest/attestation bound to the campaign without disclosing contents | Bundle is unavailable, mutable, exposed, or not independently verified |

## Exact owner/evaluator handoff

1. Independently review and implement the privileged launcher, validator, evidence
   recorder, and receipt verifier outside developer control. Repository code is an
   untrusted public contract, not privileged implementation authority.
2. Prove native Windows restricted launch and the E1 positive and negative controls
   with no developer or evaluated-agent access to evaluator-only material.
3. Prove private original-artifact integrity, complete-stream capture within approved
   bounds, verifier authenticity, persistent anti-replay state, interruption/restart,
   recovery, durable finalization, and cleanup recording.
4. Freeze the evaluator-only bundle and publish only bounded sanitized attestations.
5. Approve the runtime, evaluator arrangement, 36-cell budget, and confirmation
   policy as distinct decisions.
6. Assemble one immutable campaign envelope binding source, manifest, candidates,
   environment, evaluator, private-bundle digest, budgets, and approvals.
7. Run `python evals/forge/validate.py --campaign-ready`. Exit code `2`, any listed
   blocker, or any identity drift is an unconditional stop. Formal model execution
   may begin only after the gate succeeds and final execution approval is explicit.

T05 Adit macOS testing is owner-deferred and outside this checkpoint. T10 A9-A10,
Alpha promotion, Master Prompt retirement, and any formal B0-B5 cell remain
unauthorized.
