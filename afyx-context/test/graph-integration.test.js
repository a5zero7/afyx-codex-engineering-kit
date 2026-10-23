import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  AceError,
  GRAPH_ACE_CONSUMER_CONTRACT,
  createGraphAceConsumer,
  deriveGraphAceIdentity,
} from '../src/index.js';

const graphText = 'Inventory fact line with stable provenance.\n'.repeat(80);
const graphResult = () => ({ content: [{ type: 'text', text: graphText }] });
const query = {
  toolName: 'afyx_graph_inventory',
  args: { declaration: '_inherit', value: 'sale.order' },
  projectRoot: process.cwd(),
  sourceIdentity: 'sha256:synthetic-source',
};

function lab(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afyx-293-graph-ace-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function enabledConsumer(t, overrides = {}) {
  const stateDir = path.join(lab(t), 'ace-state');
  return {
    stateDir,
    consumer: createGraphAceConsumer({
      enabled: true,
      stateDir,
      ownerId: 'graph-owner',
      sessionId: 'graph-session',
      ...overrides,
    }),
  };
}

test('default OFF returns the exact Graph result and never invokes ACE', async () => {
  let aceCalls = 0;
  const consumer = createGraphAceConsumer({
    aceRunner: async () => { aceCalls += 1; throw new Error('must not run'); },
  });
  const original = graphResult();
  const result = await consumer.execute({ toolName: query.toolName, executeGraph: async () => original });
  assert.equal(consumer.contract, GRAPH_ACE_CONSUMER_CONTRACT);
  assert.equal(result.status, 'disabled');
  assert.deepEqual(result.consumerResult, original);
  assert.notEqual(result.consumerResult, original);
  assert.equal(aceCalls, 0);
});

test('invalid opt-in metadata cannot prevent an otherwise valid Graph operation', async () => {
  let graphCalls = 0;
  const consumer = createGraphAceConsumer({
    enabled: true,
    stateDir: path.join(os.tmpdir(), 'afyx-293-invalid-metadata-state'),
    ownerId: 'owner',
    sessionId: 'session',
  });
  const original = graphResult();
  const result = await consumer.execute({
    toolName: query.toolName,
    projectRoot: path.join(os.tmpdir(), 'missing-afyx-293-project'),
    sourceIdentity: query.sourceIdentity,
    executeGraph: async () => { graphCalls += 1; return original; },
  });
  assert.equal(graphCalls, 1);
  assert.equal(result.status, 'fallback');
  assert.equal(result.failureCode, 'INVALID_INTEGRATION');
  assert.deepEqual(result.consumerResult, original);
});

test('native opt-in reduces a repeated Graph result and recovers exact original under the same owner/session', async (t) => {
  const { consumer } = enabledConsumer(t);
  const executeGraph = async () => graphResult();
  const first = await consumer.execute({ ...query, executeGraph });
  const second = await consumer.execute({ ...query, executeGraph });
  assert.equal(first.status, 'optimized');
  assert.equal(second.status, 'optimized');
  const reference = second.ace.items.find((item) => item.disposition === 'reference')?.reference;
  assert.match(reference, /^ace:v1:/);
  assert.ok(second.ace.metrics.outputChars < second.ace.metrics.rawChars);
  const recovered = await consumer.recover(reference);
  assert.equal(recovered.content, graphText);
  assert.equal(recovered.observations[0].provenance.sourceIdentity, query.sourceIdentity);
  assert.equal(recovered.observations[0].provenance.projectRoot, fs.realpathSync.native(query.projectRoot));
});

test('source-bearing Graph tools remain protected and inline', async (t) => {
  const { consumer } = enabledConsumer(t);
  const result = await consumer.execute({
    ...query,
    toolName: 'afyx_graph_explore',
    executeGraph: async () => graphResult(),
  });
  assert.equal(result.status, 'optimized');
  assert.equal(result.ace.items[0].classification, 'source-evidence');
  assert.equal(result.ace.items[0].disposition, 'original');
  assert.match(result.consumerResult.content[0].text, /Inventory fact line/);
});

test('unavailable, throwing, timed-out, malformed, and incomplete ACE all preserve exact Graph output', async () => {
  const original = graphResult();
  const scenarios = [
    ['unavailable', async () => { throw new Error('unavailable'); }, 'ACE_UNAVAILABLE'],
    ['throwing', () => { throw new Error('throwing'); }, 'ACE_UNAVAILABLE'],
    ['timeout', (_message, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new AceError('ACE_TIMEOUT', 'timeout')), { once: true });
    }), 'ACE_TIMEOUT'],
    ['malformed', async () => ({ unexpected: true }), 'INVALID_ACE_RESULT'],
    ['incomplete', async () => ({ status: 'fallback', failureCode: 'INVALID_INPUT', originalComplete: false }), 'INVALID_INPUT'],
  ];
  for (const [name, aceRunner, failureCode] of scenarios) {
    const consumer = createGraphAceConsumer({
      enabled: true,
      stateDir: path.join(os.tmpdir(), `afyx-293-synthetic-${name}`),
      ownerId: 'owner',
      sessionId: 'session',
      timeoutMs: name === 'timeout' ? 10 : 100,
      aceRunner,
    });
    const result = await consumer.execute({ ...query, executeGraph: async () => original });
    assert.equal(result.status, 'fallback', name);
    assert.equal(result.failureCode, failureCode, name);
    assert.deepEqual(result.consumerResult, original, name);
  }
});

test('Graph error remains authoritative and bypasses ACE', async () => {
  let aceCalls = 0;
  const consumer = createGraphAceConsumer({
    enabled: true,
    stateDir: path.resolve('unused-state'),
    ownerId: 'owner',
    sessionId: 'session',
    aceRunner: async () => { aceCalls += 1; },
  });
  const original = { content: [{ type: 'text', text: 'Error: unavailable index' }], isError: true };
  const result = await consumer.execute({ ...query, executeGraph: async () => original });
  assert.equal(result.status, 'graph-error');
  assert.deepEqual(result.consumerResult, original);
  assert.equal(aceCalls, 0);
});

test('foreign session, invalid reference, and corrupt original recovery fail closed', async (t) => {
  const { stateDir, consumer } = enabledConsumer(t);
  const executeGraph = async () => graphResult();
  await consumer.execute({ ...query, executeGraph });
  const reduced = await consumer.execute({ ...query, executeGraph });
  const item = reduced.ace.items.find((candidate) => candidate.disposition === 'reference');
  assert.ok(item);

  const foreign = createGraphAceConsumer({
    enabled: true,
    stateDir,
    ownerId: 'graph-owner',
    sessionId: 'other-session',
  });
  await assert.rejects(foreign.recover(item.reference), (error) => error.code === 'REFERENCE_BOUNDARY');
  await assert.rejects(consumer.recover('ace:v1:invalid'), (error) => error.code === 'INVALID_REFERENCE');

  fs.writeFileSync(path.join(stateDir, 'content', `${item.digest}.txt`), 'corrupted original', 'utf8');
  await assert.rejects(consumer.recover(item.reference), (error) => error.code === 'CONTENT_INTEGRITY');
});

test('corrupted or foreign ACE state falls back without mutating Graph result', async (t) => {
  const { stateDir, consumer } = enabledConsumer(t);
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'state.json'), '{"format":"foreign"}', 'utf8');
  const original = graphResult();
  const result = await consumer.execute({ ...query, executeGraph: async () => original });
  assert.equal(result.status, 'fallback');
  assert.equal(result.failureCode, 'FOREIGN_STATE');
  assert.deepEqual(result.consumerResult, original);
});

test('identity mapping is deterministic and source-sensitive', () => {
  const a = deriveGraphAceIdentity({ ...query, consumerId: 'local-agent' });
  const b = deriveGraphAceIdentity({ ...query, consumerId: 'local-agent' });
  const changed = deriveGraphAceIdentity({ ...query, sourceIdentity: 'sha256:changed', consumerId: 'local-agent' });
  assert.deepEqual(a, b);
  assert.equal(a.ownerId, changed.ownerId);
  assert.notEqual(a.sessionId, changed.sessionId);
  assert.ok(Object.isFrozen(a));
});

test('invalid configuration and malformed Graph payloads fail before ACE state use', async () => {
  assert.throws(() => createGraphAceConsumer({ enabled: true, stateDir: 'relative', ownerId: 'o', sessionId: 's' }), /absolute/);
  assert.throws(() => createGraphAceConsumer({ enabled: true, stateDir: path.resolve('x'), ownerId: '', sessionId: 's' }), /ownerId/);
  const consumer = createGraphAceConsumer();
  await assert.rejects(
    consumer.execute({ ...query, executeGraph: async () => ({ content: [{ type: 'image', data: 'x' }] }) }),
    /unsupported content block/,
  );

  const overlapping = createGraphAceConsumer({
    enabled: true,
    stateDir: path.join(process.cwd(), '.owned-test-state'),
    ownerId: 'owner',
    sessionId: 'session',
  });
  const result = await overlapping.execute({ ...query, executeGraph: async () => graphResult() });
  assert.equal(result.status, 'fallback');
  assert.equal(result.failureCode, 'UNSAFE_STATE_PATH');
  assert.equal(fs.existsSync(path.join(process.cwd(), '.owned-test-state')), false);

  const cyclic = {};
  cyclic.self = cyclic;
  const cyclicResult = await createGraphAceConsumer({
    enabled: true,
    stateDir: path.join(os.tmpdir(), 'afyx-293-cyclic-state'),
    ownerId: 'owner',
    sessionId: 'session',
    aceRunner: async () => { throw new Error('must not run'); },
  }).execute({ ...query, args: cyclic, executeGraph: async () => graphResult() });
  assert.equal(cyclicResult.status, 'fallback');
  assert.equal(cyclicResult.failureCode, 'INVALID_INTEGRATION');
});
