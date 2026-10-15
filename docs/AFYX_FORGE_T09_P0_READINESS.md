# Afyx Forge T09.P0 Benchmark Readiness

Status: **PREPARATION COMPLETE / BENCHMARK EXECUTION BLOCKED**

Starting revision: `b2c1d1016b2a1401a651e2b539e9a029ee0606c5`

Normative inputs:

- [A0-A3 contract](AFYX_FORGE_A0_A3_CONTRACT.md)
- [A0-A3 machine baseline](AFYX_FORGE_A0_A3_BASELINE.json)
- [Forge candidate and campaign manifest](../evals/forge/manifest.json)
- [Proposed environment](../evals/forge/environment.proposed.json)

T09.P0 prepares public candidates, fixtures, identities, controls, and owner decisions. It does not run a model cell, approve the 36-cell budget, prove Forge evaluator isolation, select the A8 architecture, or create production Forge.

## P0.1 — Evidence reconciliation

The canonical repository was clean and synchronized on `dev` at the starting revision. Authoring runtime: Windows, Codex CLI 0.162.1, Node 26.8.1, npm 11.19.0, Python 3.10.11, PowerShell 7.6.6, and Git 2.55.0.windows.5. These values are observations, not campaign approval.

The existing `evals/harness` provides bounded child execution, fresh external workspaces, correlation, fail-closed synthetic controls, atomic result publication, and process-tree cleanup for the Expert campaign. That infrastructure is reusable design evidence, but its historical isolation result and Expert aliases do not prove Forge isolation or authorize Forge execution. Existing Expert environments, results, and private-material boundaries remain unchanged.

## P0.2 — Independent Master Prompt

No executable, owner-authorized Independent Master Prompt was found in tracked canonical source or the currently supplied attachment set. The only matching attachment text is this task's warning that the earlier `Independent master prompt - afyx forge.txt` is a historical conversation/decision summary, not B2.

B2 therefore remains **UNRESOLVED**. No historical summary, Prompt Master source, Expert source, or guessed prompt was substituted. B2 requires an owner-provided exact artifact with source/revision, SHA-256, ownership, provenance, license/usage disposition, explicit evaluation authorization, and approved injection mechanism. B3 remains blocked by B2.

## P0.3 — Candidate identities

| Candidate | Identity/readiness | Entry point | Disposition |
|---|---|---|---|
| B0 | `b43d351e...15e64f`; PREPARED EXECUTABLE / NOT RUN | No additional directive or Afyx skill | Ready for later frozen campaign |
| B1 | Efficient Coding 1.2.0 tree `deab6d98...29a4`; PREPARED EXECUTABLE / NOT RUN | Repository-local `.agents/skills/efficient-coding/SKILL.md`; successful read must be observed | Ready for later frozen campaign |
| B2 | No identity | Owner-authorized prompt injection | BLOCKED: content, provenance, authorization, and injection unresolved |
| B3 | Ordered composition `[B1, B2]`; no combined hash | Materialize B1, then inject exact B2 | BLOCKED by B2 |
| B4 | No identity | To be chosen during reviewed convergence construction | BLOCKED by B2; not constructed |
| B5 | Tree `0b4e610c...e8cb58`; PREPARED EVALUATION-ONLY / NOT RUN | Copy `evals/forge/candidates/B5/AGENTS.md` to evaluated workspace root | Prototype only; not production Forge or A8 approval |

B5 is an original, compact derivative of the public A3 behavior contract. Prompt Master was used only as authoring guidance for the Codex-targeted directive; no external or unavailable prompt text was copied into it.

All executable identities must be reverified and bound into one approved campaign fingerprint immediately before the first cell. An intentional byte, loading-order, or activation-rule change creates a new candidate identity.

## P0.4 — Proposed campaign environment

`evals/forge/environment.proposed.json` fixes a reviewable proposal: Windows 11, Codex CLI 0.162.1, `gpt-5.6-sol`, OpenAI provider, medium reasoning, priority service tier, current recorded runtimes, root-deny evaluation permission profile, network disabled, no Graph/Headroom/external MCP, 300-second cell timeout, 45-second control timeout, zero model retries, fresh session/workspace, seed `16102026`, and owned-process cleanup.

Status remains **OWNER_APPROVAL_REQUIRED**. `campaign_source_revision` is deliberately `null`; it must be set only when the owner approves the environment and every candidate/evaluator identity is frozen. Historical Expert runtime values are proposal evidence, not inherited authority.

## P0.5 — Isolation and contamination

Required topology:

```text
developer identity -> public source, public fixtures, sanitized verdicts only
evaluated identity -> disposable scenario workspace and exact candidate only
trusted evaluator  -> approved public inputs plus evaluator-only bundle/output
evaluator-only root -> rubric, canary, ground truth, private holdout; denied to both agents
```

The controller must enforce separation using independently controlled OS accounts, a VM/container, or equivalent ACL boundary. Synthetic positive workspace read/write plus negative evaluator read/write/traversal tests must pass from the actual evaluated identity. Shared profiles, mounts, attachments, transcripts, logs, and tool endpoints must not expose evaluator material. Unauthorized read or marker exposure is FAIL regardless of another BLOCKED result.

No independent Forge host was available to this developer session. Isolation is **NOT TESTED / BLOCKED**, no real private material was accessed, and historical Expert canary results were not reused as Forge acceptance.

## P0.6 — Fixture, harness, and budget

The public synthetic fixture covers the exact six frozen categories. Five coding scenarios have focused deterministic baseline tests that fail with exit `1` on pristine copies and target exit `0`; the negative/simple scenario permits no file mutation or tool call. The fixture tree SHA-256 is `02947fd6e29d0517cc5e0d768aa91ea3ec88b483aed42d7fc3a853bd3f12720e`.

The manifest produces 36 unique deterministically shuffled cell IDs (`6 candidates × 6 categories × 1 repetition`) with order SHA-256 `e5bda9785e3570611753737ef9b75e931220b21c304e10d78fe02162d154603a`. It specifies fresh sessions/workspaces, run/control correlation, candidate/fixture/environment fingerprints, timeout/cleanup/exclusion records, four ordered hard gates, and nullable provider metrics. Monetary cost remains `NOT AVAILABLE` unless directly reported.

The separate 36-cell budget and any confirmation budget are **NOT APPROVED**. Discovery `n=1` is calibration, not comparative superiority. No benchmark cell was run.

## P0.7 — Progress and decisions

| Concern | Result |
|---|---|
| Public candidate/fixture identities | PASS for B0, B1, B5; B2-B4 explicitly blocked |
| Schema, containment, deterministic order | PASS |
| Pristine fixture reproduction | PASS; five expected failing baselines, canonical tree unchanged |
| Public contamination scan | PASS; no evaluator marker in candidate/fixture content |
| Independent Forge isolation | NOT TESTED / BLOCKED |
| Runtime approval | NOT APPROVED |
| 36-cell budget | NOT APPROVED |
| Evaluator-only bundle | NOT FROZEN / inaccessible to developer |
| Model benchmark/performance/A8 | NOT RUN / NOT CLAIMED |

Externally supplied Jira state for this task says AFYX-12, AFYX-88, and AFYX-171 are In Progress; AFYX-172 and A1-A3 issues are Done within their documented contract scope. No Jira connector or CLI was available here, so no live transition/comment is claimed. A0 methodology remains complete while A0 input completion stays open.

## Owner decision register and exact handoff

Benchmark execution remains blocked until an authorized owner/evaluator supplies and approves all items:

1. exact B2 artifact, provenance/license/authorization, digest, and injection mechanism;
2. reviewed B4 executable candidate and final B0-B5 immutable fingerprints;
3. exact approved campaign source revision and runtime configuration;
4. independent Forge isolation with fresh synthetic control evidence;
5. explicit 36-cell and confirmation budgets;
6. evaluator-only bundle identities and freeze confirmation outside both agent roots.

After these inputs exist, the next task is **T09.P1 — Candidate Freeze, Independent Isolation Acceptance, and Campaign Authorization**. It must first run:

```text
python evals/forge/validate.py --check-fixtures
python scripts/tests/test_forge_readiness.py
```

Then it binds the approved repository/environment/evaluator identities, verifies the actual host controls, and stops for authorization. Only a subsequent authorized T09 benchmark execution may run the 36 cells. A8 remains blocked until independently evaluated results pass the frozen decision rule.
