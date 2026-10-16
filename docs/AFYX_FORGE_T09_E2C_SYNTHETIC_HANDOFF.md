# T09 synthetic acceptance evidence and controller handoff (public, sanitized)

Status: **SYNTHETIC CHECKS RECORDED / FORMAL CAMPAIGN BLOCKED**  
Date: 2026-10-16  
Base source revision: `63f528e24ed0b4b0217b8db3666ed8b7dd06bebd` (`dev`)  
Jira: [AFYX-12](https://afifbendol.atlassian.net/browse/AFYX-12), [AFYX-93](https://afifbendol.atlassian.net/browse/AFYX-93), [AFYX-285](https://afifbendol.atlassian.net/browse/AFYX-285) (owner-only evidence), [AFYX-286](https://afifbendol.atlassian.net/browse/AFYX-286) (public controller implementation).

This is a sanitized summary of owner-reported local synthetic tests, **not an independently audited security acceptance, host deployment attestation, runtime authorization, A8 GO, or benchmark result**. Owner retains original raw evidence privately; raw console output, identifiers, account names, private paths, canary material, auth, rubrics, scoring, and holdouts are excluded here. The public trust-boundary and input/output contracts remain authoritative in [AFYX_FORGE_T09_E1_SECURE_HANDOFF.md](AFYX_FORGE_T09_E1_SECURE_HANDOFF.md).

## Observed synthetic evidence

| Boundary | Owner-reported result | Narrow meaning |
| --- | --- | --- |
| Restricted-account process and non-admin token (A) | PASS | The dedicated restricted agent process launched with a non-admin medium-integrity identity |
| Initial vault denial (B) | PASS | Direct enumeration/access checks denied; separate complete WSL isolation was not established |
| Codex installation/authentication (C) | PASS | Native Windows CLI v0.163.0 started; temporary ChatGPT login used solely for synthetic run |
| D1–D3 diagnostics | FAIL / BLOCKED historically | Incomplete companion binary and effective read-only/tool policy; retain evidence, do not relabel PASS |
| D4 actual one-file agent edit | PASS | Synthetic Git workspace, `default_permissions=":workspace"`, `windows.sandbox="unelevated"`; model/tool altered only designated test file; independently checked actual content and scope, not exit code alone |
| E1 direct sandbox write | PASS | Synthetic in-workspace write succeeded without model call |
| E2 permission resolution | PASS | Requested `:workspace` resolved as `workspace-write` in diagnostics |
| E2C.1S negative write | PASS | In-workspace positive control wrote successfully; out-of-workspace synthetic sentinel write failed with inner `UnauthorizedAccessException`; sentinel remained unchanged |
| E2C.2 vault read negative | PASS | In-sandbox positive control succeeded; private vault enumeration and synthetic canary file-open were denied without reading content |
| E2C.3R temporary credential check | PASS | After logout, CLI reported not logged in, evaluator-local auth file absent, five named credential environment variables absent. Not a forensic erase or production credential-boundary proof |

Total formal B0–B5 benchmark cells executed: **0/36**. No measured Forge architecture superiority or promotion is claimed. D4 reports provider tokens for synthetic diagnostic only; no campaign budget consumed by benchmark cells.

## Separate unresolved full acceptance

1. Independent owner/evaluator review of the actual trusted-controller and restricted-agent process boundary; never run repository or evaluated-agent code with owner/evaluator privileges.
2. Formal model-provider credential containment: no auth or provider tokens readable by the evaluated agent; synthetic login is not the final architecture.
3. Path normalization and adversarial paths (traversal, alternate drive/share, symlink, junction, mount/reparse), authorized worktree-only writes, denied owner/evaluator profile and evaluator material under the actual controller.
4. Windows-only/WSL exclusion, unexpected endpoints, effective network policy, bounded process lifecycle, timeout, zero retries, owned child-tree termination, no orphan/handle and correlated cleanup.
5. Independent raw evidence preservation, failure-closed outcomes, sanitization, integrity-verifiable attestation and evaluator-only private bundle freeze.
6. Separate owner approvals: runtime, evaluator arrangement, 36-cell budget, confirmation policy/budget and final campaign execution authorization.

The `unelevated` backend was useful for synthetic functional proof, **not independently accepted as the final campaign isolation boundary**. No developer access to evaluator storage, raw logs, private test sets or scoring. Do not copy the owner/evaluator private environment into this public repository.

## Execution ownership and next work

- **AFYX-285 OWNER ONLY:** reconcile private raw test records against this sanitized summary; retain historical FAIL/BLOCKED observations; attest narrow controls and remaining gates; do not delegate private material or host changes to developer Codex.
- **AFYX-286 DEVELOPER PUBLIC ONLY:** implement deterministic public controller interfaces, schema validation, safe fixture/candidate materialization and fingerprint checks, disposable workspace, restricted process-launch contract, actual-artifact validation, timeout/cleanup and sanitization. Build mock-launcher synthetic positive/negative tests. No privileged host provisioning, no evaluator-private files, no real B0–B5 runs.
- **Owner/evaluator after code review:** independently deploy/review controlled runner and credential boundary; run one controller-mediated synthetic end-to-end job, then repeat security acceptance through the actual controller before any campaign decision.

Git workflow: PR against `dev`; no direct `main` update; no changes to frozen six candidates, 36-cell order or A0–A12. Forge A8 must explicitly GO before A9. Odoo Engineering and Expert architecture remain separate.
