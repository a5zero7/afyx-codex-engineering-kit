# Afyx Context Engine

Afyx Context Engine (ACE) is an Afyx-owned, standalone Node.js component for
conservative context reduction with byte-exact original recovery. It does not
require Afyx Graph, Forge, Engineering Expert, Headroom, or the Kit installer.

## API

```js
import { AfyxContextEngine } from '@a5zero7/afyx-context';

const engine = new AfyxContextEngine({
  stateDir: 'C:\\owned\\absolute\\ace-state',
  ownerId: 'agent-owner',
  sessionId: 'session-1',
  // Optional bounded coordination controls (defaults: 5000 ms / 25 ms).
  lockTimeoutMs: 5_000,
  lockRetryMs: 25,
});

const result = engine.reduce({
  budgetChars: 16_000,
  segments: [
    { id: 'diagnostic', classification: 'diagnostic', content: 'exact failure text' },
    { id: 'output-1', content: 'repeated tool output' },
    { id: 'output-2', content: 'repeated tool output' },
  ],
});

const original = engine.retrieve(result.items[2].reference);
```

`diagnostic`, `security`, and `source-evidence` segments remain inline. ACE
only replaces normal content when the stable reference is smaller. If the
budget cannot safely represent the complete selection, ACE returns all
original content in `passthrough` mode.

The state directory must be absolute, empty or already bound to the same
owner, and not itself a symbolic link. References are bound to both owner and
session. A content hash is verified on every retrieval. Original blobs and
session metadata are committed through owned temporary files followed by
`fsync` and rename. A retry can adopt a complete orphan blob left by an
interruption; malformed metadata and corrupt existing blobs fail closed.

Every state read and mutation participates in one local, state-root-wide
exclusive lock. The deliberately coarse scope protects first initialization,
all sessions, and the shared content-addressed store across cooperating local
processes on Windows, Linux, and macOS. Lock acquisition is bounded; contention
reports `LOCK_TIMEOUT`. A lock is recovered only on the same host after the OS
proves that its recorded PID is absent. A present or unverifiable PID—including
a possible reused PID—never authorizes removal. Missing, foreign, or ambiguous
ownership fails closed with `LOCK_RECOVERY_UNSAFE`; lock age alone is never
recovery evidence.

After a verified process interruption, complete content temporaries are adopted
only after SHA-256 validation. Complete uncommitted session metadata is removed
without replacing the last committed session, so references cannot expose an
interrupted write. Unknown files and ambiguous coordination artifacts are not
deleted automatically.

## CLI

```text
afyx-context reduce --state <absolute-path> --owner <id> --session <id> --input <request.json|-> [--budget <chars>]
afyx-context get --state <absolute-path> --owner <id> --session <id> --reference <ace:v1:...>
```

Build and test without third-party runtime dependencies:

```text
npm ci
npm run build:clean
npm test
npm run test:benchmark
```

## Optional integration

`contracts/integration-v1.schema.json` defines `ace.integration/v1` for Graph,
Engineering Expert, Forge, and Kit consumers. `createOptionalIntegrationAdapter`
catches an unavailable/failed ACE and returns original content, so the consumer
remains independently functional. The foundation does not install adapters into
those products or add ACE to a Kit preset.

Malformed or unavailable optional integration requests return a bounded
fallback. `originalInput` retains the supplied input, and `originalComplete`
states whether `renderedContext` contains its complete render.

The v1 boundary accepts at most 1,024 segments, 1 MiB content and 64 KiB
provenance per segment, 8 MiB aggregate request content, 512-byte segment and
owner/session identities, and 10 MiB CLI input. State/session metadata are
bounded at 64 KiB/16 MiB; a stored blob is bounded at 1 MiB, a session at
100,000 unique contents, and provenance at 256 observations per digest.

Coordination is local and exclusive, not distributed. A process-liveness check
that is unavailable, cross-host, or inconclusive requires operator inspection
instead of automatic lock removal. Stored content remains local plaintext, and
the caller owns filesystem access control and retention policy.
