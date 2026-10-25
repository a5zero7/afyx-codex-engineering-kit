# AFYX-64 Phase 8 real-engineering dogfood

Date: 2026-10-24

This increment evaluates engineering outcomes, not Graph availability alone. It
uses one public Afyx task and one owner-private application task. Private source,
repository identity, business data, and the full patch remain local-only.

## Product increment

The optional Graph–ACE consumer now bypasses ACE for source-bearing and
diagnostic Graph tools after validating project/source identity and state-path
separation. The authoritative Graph result is cloned and returned byte-for-byte;
the ACE runner is not called and no ACE state is created. Normal reducible
content keeps the existing explicit opt-in behavior, recovery integrity,
owner/session boundaries, bounded worker lifecycle, and exact-result fallback.
ACE remains default OFF and Graph remains standalone.

## Engineering cases

### Case A — Afyx Graph–ACE protected-output optimization

The task was to locate the smallest safe change and its affected validation for
removing useless ACE worker/state overhead from protected Graph output.

- CONTROL used two targeted searches and one source-range read on the clean
  integration baseline. Discovery command time was 222.884 ms.
- TREATMENT used one Afyx Graph exploration. It returned 60 symbols across six
  files, the consumer/fallback/classification relationships, script callers, and
  the focused test path in one response. Observed tool wall time was 1.9 s.
- Both conditions reached the same five-file implementation boundary. Treatment
  made the caller/test blast radius explicit but was slower and returned more
  context than the direct known-symbol route.
- The resulting regression proves zero ACE calls, no ACE state directory,
  exact Graph result preservation, and unchanged failure fallback behavior.

### Case B — owner-private Next.js/SQLite build failure

The task started from a reproducible production build failure during parallel
page-data collection. The source worktree was never modified; CONTROL and
TREATMENT used clean task-owned clones at the same revision and independent
database files.

- Root cause: parallel build workers evaluated module-level SQLite WAL/schema
  initialization without a busy timeout, causing immediate lock failure.
- Both conditions produced the same one-file correction: configure a bounded
  SQLite busy timeout before WAL/schema initialization.
- CONTROL used three targeted searches and one file-range read.
- TREATMENT used a task-local Afyx Graph 1.0.0 index (34 files, 443 nodes,
  857 edges), two explore calls, and one affected-test call. It reported 12
  dependents and no existing affected tests. One irrelevant module was returned,
  so a second focused exploration was required.
- CONTROL validation: lint PASS; production build PASS with nine workers in
  21,008.357 ms.
- TREATMENT validation: lint PASS; production build PASS with nine workers in
  21,232.803 ms.

The private case's raw identity and patch evidence remains local-only. Its local
evidence manifest SHA-256 is
`33C59769E5500D6E17E0C6D2CE68D8C079FFC264E4DA42236C141D016F90CE6C`.

## Findings

- Correctness and task completion were equivalent in both conditions.
- Graph materially improved explicit impact awareness for unfamiliar cross-file
  code. It did not improve validation duration and did not outperform direct
  inspection for the known-symbol Afyx task.
- Graph retrieval on the private case contained one irrelevant file and needed
  query refinement. This is an optimization signal, not a demonstrated
  correctness defect.
- After indexing an uncommitted patch, Graph truthfully reported filesystem
  content CURRENT while the Git snapshot remained STALE. No stale content was
  used for the engineering decision.
- Provider/billing token counts were unavailable. No token-saving or superiority
  claim is made. Tool-call counts and observed command durations are the measured
  cost evidence.
- Human intervention was zero. Agent-only lab setup required replacing an
  unsupported dependency junction with a task-local dependency copy; this did
  not affect either source result.

This is one Phase 8 increment, not completion of the representative workload
matrix. Cross-toolchain comparisons, physical Mac validation, and legacy
third-party graph comparison were not run.
