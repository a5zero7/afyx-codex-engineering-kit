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
session. A content hash is verified on every retrieval.

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

Current operational limitation: the state format supports one writer at a time;
cross-process write coordination is not yet provided. Stored content is local
plaintext and the caller owns filesystem access control and retention policy.
