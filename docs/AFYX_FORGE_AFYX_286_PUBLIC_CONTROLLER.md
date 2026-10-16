# AFYX-286 public trusted-controller contract

Status: **PUBLIC SYNTHETIC IMPLEMENTATION READY / OWNER INTEGRATION BLOCKED**

This record covers only the independently reviewable developer-side contract. It implements no privileged controller, provider client, Windows account integration, Task Scheduler deployment, private evaluator bundle, rubric, holdout, scoring, or benchmark execution. The authoritative trust boundary and schemas remain [T09.E1 secure evaluator handoff](AFYX_FORGE_T09_E1_SECURE_HANDOFF.md); this document does not introduce a competing campaign contract.

Public baseline: `63f528e24ed0b4b0217b8db3666ed8b7dd06bebd`. Jira: [AFYX-286](https://afifbendol.atlassian.net/browse/AFYX-286). Draft [PR #60](https://github.com/a5zero7/afyx-codex-engineering-kit/pull/60) is treated only as owner-reported sanitized synthetic evidence and is not merged or reclassified as independent runtime acceptance.

## Public architecture

`evals/forge/controller.py` provides four bounded layers:

1. `validate_cell_input` checks the exact public schema against the frozen manifest: scenario prompt and command, candidate identity and activation, fixture/environment fingerprints, frozen cell identity, canonical allowed paths, timeout bound, and zero retries.
2. `DisposableWorkspaceManager` creates one correlated workspace below a caller-owned root and cleans only its registered lease. Source and workspace trees reject traversal, links, junctions, mount/reparse points, and conflicting materialization.
3. `RestrictedProcessLauncher` and `ArtifactValidator` are protocols only. Developer tests inject fakes. No implementation in this repository launches a model, authenticates a provider, changes host configuration, or assumes owner/evaluator privileges.
4. `PublicController` records bounded output digests and sizes, actual file mutations, artifact checks, identity/timeout/process-tree status, sanitization, and correlated cleanup. Raw stdout, stderr, transcript, prompt, credentials, and private evidence are not public result fields.

The controller copies the canonical public fixture and exact selected candidate into a fresh workspace, rechecks content after copying, snapshots bytes before and after the injected launcher, and rejects mutations outside `allowed_file_scope`. `DigestArtifactValidator` performs deterministic LF-normalized content validation for synthetic artifacts; a process exit code of zero without matching content still fails.

## Public interfaces

- Input is schema version 1 from the E1 handoff and must match one exact manifest cell.
- `RestrictedProcessLauncher.launch(LaunchRequest)` must return the observed restricted identity, exit state, bounded output, timeout, owned-process-tree termination, provider-reported token values when available, tool-call count, and retry count.
- `ArtifactValidator.validate(...)` must be implemented so validation also executes inside the restricted boundary. It returns a command exit status and at least one content check; the trusted controller must never execute agent-modified source as owner/evaluator.
- Output contains every canonical `result_schema.required_fields` entry plus public candidate/environment identities, mutation inventory, lifecycle state, bounded evidence metadata, and sanitization status. All four private quality gates remain `NOT_TESTED` until the independent evaluator applies its private rubric.

## Fail-closed behavior

The public implementation rejects malformed or extra schema fields, unknown cells, scenario/candidate/activation drift, fingerprint mismatch, unsafe or non-canonical paths, source/workspace reparse points, materialization conflicts, non-zero retries, identity mismatch, timeout, unexpected termination, incomplete process-tree termination, file-scope violations, incorrect artifacts, unsafe output markers, and failed cleanup. Error reporting exposes stable codes rather than untrusted output or private paths.

## Deterministic developer validation

Synthetic tests cover successful materialization and cleanup plus malformed input, fingerprint drift, traversal/reparse rejection, restricted-identity mismatch, timeout, unexpected termination, incomplete process-tree cleanup, cleanup failure, forbidden output markers, unauthorized mutations, retry-policy drift, raw-output publication rejection, and exit-zero with incorrect content. They make no model/provider call and use no private material.

Commands:

```text
python -m unittest scripts.tests.test_forge_controller -v
python -m unittest scripts.tests.test_forge_readiness -v
python evals/forge/validate.py --check-fixtures
python -m py_compile evals/forge/controller.py scripts/tests/test_forge_controller.py
```

## Security limitations and owner-only handoff

This code does not prove Windows OS isolation, credential containment, WSL exclusion, network policy, Task Scheduler suitability, actual restricted-token launch, or process-tree termination. Fakes prove contract handling only. The seven campaign authorization gates remain unresolved and the benchmark remains `0/36`.

Before any privileged or model execution, the owner/independent evaluator must:

1. review this exact source revision independently and implement the launcher and validator outside developer control;
2. bind them to the approved native-Windows restricted identity without forwarding owner/evaluator credentials, profiles, WSL, shared mounts, undeclared MCP endpoints, or private storage;
3. ensure model and validation processes, including agent-modified code, run only inside the restricted boundary with bounded timeout and owned-process-tree cleanup;
4. repeat positive and adversarial synthetic acceptance through the actual controller and preserve raw evidence privately;
5. publish only a sanitized integrity-verifiable attestation, then obtain each remaining owner approval separately.

Implementation readiness is not deployment approval, isolation acceptance, campaign authorization, A8 GO, or benchmark authority. Final campaign status: **CAMPAIGN BLOCKED — 0/36**.
