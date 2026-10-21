import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ACE_INTEGRATION_CONTRACT,
  SUPPORTED_COMPONENTS,
  createOptionalIntegrationAdapter,
} from '../src/index.js';

const request = {
  contract: ACE_INTEGRATION_CONTRACT,
  component: 'graph',
  stateDir: 'not-used-by-failing-engine',
  ownerId: 'owner',
  sessionId: 'session',
  segments: [{ id: 'critical', classification: 'security', content: 'retain this exactly' }],
};

test('declares one versioned optional contract for all planned consumers', () => {
  assert.equal(ACE_INTEGRATION_CONTRACT, 'ace.integration/v1');
  assert.deepEqual(SUPPORTED_COMPONENTS, ['graph', 'engineering-expert', 'forge', 'kit']);
});

test('consumer remains functional with exact original content when ACE fails', () => {
  for (const component of SUPPORTED_COMPONENTS) {
    const adapter = createOptionalIntegrationAdapter({
      component,
      createEngine: () => { throw new Error('synthetic unavailable engine'); },
    });
    const result = adapter.process({ ...request, component });
    assert.equal(result.status, 'fallback');
    assert.equal(result.failureCode, 'ACE_UNAVAILABLE');
    assert.ok(result.renderedContext.includes('retain this exactly'));
  }
});

test('adapter uses native ACE when the optional engine is available', (t) => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'afyx-context-adapter-'));
  t.after(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const adapter = createOptionalIntegrationAdapter({ component: 'graph' });
  const content = 'repeated adapter payload '.repeat(20);
  const result = adapter.process({
    ...request,
    stateDir,
    segments: [{ id: 'first', content }, { id: 'repeat', content }],
  });
  assert.equal(result.status, 'optimized');
  assert.equal(result.result.items[1].disposition, 'reference');
  assert.equal(result.renderedContext, result.result.renderedContext);
});

test('adapter rejects an unknown component and incompatible contract', () => {
  assert.throws(() => createOptionalIntegrationAdapter({ component: 'unknown' }), /unsupported optional component/);
  const adapter = createOptionalIntegrationAdapter({ component: 'graph' });
  assert.throws(() => adapter.process({ ...request, contract: 'ace.integration/v2' }), /request contract/);
});
