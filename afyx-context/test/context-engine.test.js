import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AfyxContextEngine, AceError, classifyContent } from '../src/index.js';

function lab(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afyx-context-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

const longContent = 'stable source evidence line\n'.repeat(20);

test('classifies sensitive evidence conservatively without unsafe downgrade', () => {
  assert.equal(classifyContent('ERROR E_BOUNDARY at owned.js:7'), 'diagnostic');
  assert.equal(classifyContent('permission denied for credential store'), 'security');
  assert.equal(classifyContent('exact bytes', undefined, { exactSource: true }), 'source-evidence');
  assert.equal(classifyContent('ERROR cannot be downgraded', 'normal'), 'diagnostic');
});

test('deduplicates repeated normal content and restores exact originals after reopen', (t) => {
  const stateDir = lab(t);
  const engine = new AfyxContextEngine({ stateDir, ownerId: 'owner-a', sessionId: 'session-a' });
  const result = engine.reduce({
    budgetChars: 10_000,
    segments: [
      { id: 'first', content: longContent, provenance: { source: 'synthetic-a' } },
      { id: 'repeat', content: longContent, provenance: { source: 'synthetic-b' } },
    ],
  });
  assert.equal(result.mode, 'optimized');
  assert.equal(result.items[0].disposition, 'original');
  assert.equal(result.items[1].disposition, 'reference');
  assert.ok(result.metrics.savedChars > 0);
  assert.ok(result.metrics.reductionRatio > 0);

  const reopened = new AfyxContextEngine({ stateDir, ownerId: 'owner-a', sessionId: 'session-a' });
  assert.equal(reopened.retrieve(result.items[1].reference), longContent);
  const record = reopened.retrieveRecord(result.items[1].reference);
  assert.deepEqual(record.observations.map((item) => item.provenance.source), ['synthetic-a', 'synthetic-b']);
});

test('uses a recoverable reference to satisfy a smaller context budget', (t) => {
  const engine = new AfyxContextEngine({ stateDir: lab(t), ownerId: 'owner', sessionId: 'budget' });
  const result = engine.reduce({
    budgetChars: 180,
    segments: [{ id: 'large-normal', content: 'ordinary context '.repeat(80) }],
  });
  assert.equal(result.mode, 'optimized');
  assert.equal(result.items[0].disposition, 'reference');
  assert.equal(engine.retrieve(result.items[0].reference), 'ordinary context '.repeat(80));
  assert.ok(result.metrics.outputChars <= 180);
});

test('preserves diagnostics, security content and exact source evidence inline', (t) => {
  const engine = new AfyxContextEngine({ stateDir: lab(t), ownerId: 'owner', sessionId: 'protected' });
  const result = engine.reduce({
    budgetChars: 10_000,
    segments: [
      { id: 'diagnostic', classification: 'diagnostic', content: longContent },
      { id: 'security', classification: 'security', content: longContent },
      { id: 'evidence', classification: 'source-evidence', content: longContent },
    ],
  });
  assert.deepEqual(result.items.map((item) => item.disposition), ['original', 'original', 'original']);
  assert.ok(result.renderedContext.includes(longContent));
});

test('falls back to byte-complete originals when protected content exceeds budget', (t) => {
  const engine = new AfyxContextEngine({ stateDir: lab(t), ownerId: 'owner', sessionId: 'fallback' });
  const segments = [{ id: 'security', classification: 'security', content: longContent }];
  const result = engine.reduce({ budgetChars: 10, segments });
  assert.equal(result.mode, 'passthrough');
  assert.equal(result.reason, 'protected-content-exceeds-budget');
  assert.equal(result.items[0].content, longContent);
  assert.equal(result.metrics.savedChars, 0);
});

test('rejects relative, ambiguous, foreign and cross-session state', (t) => {
  assert.throws(
    () => new AfyxContextEngine({ stateDir: 'relative', ownerId: 'owner', sessionId: 'session' }),
    (error) => error instanceof AceError && error.code === 'UNSAFE_STATE_PATH',
  );
  const ambiguous = lab(t);
  fs.writeFileSync(path.join(ambiguous, 'foreign.txt'), 'foreign');
  assert.throws(
    () => new AfyxContextEngine({ stateDir: ambiguous, ownerId: 'owner', sessionId: 'session' }),
    (error) => error instanceof AceError && error.code === 'AMBIGUOUS_STATE',
  );

  const owned = lab(t);
  const first = new AfyxContextEngine({ stateDir: owned, ownerId: 'owner-a', sessionId: 'session-a' });
  const result = first.reduce({ segments: [{ id: 'content', content: longContent }] });
  assert.throws(
    () => new AfyxContextEngine({ stateDir: owned, ownerId: 'owner-b', sessionId: 'session-a' }),
    (error) => error instanceof AceError && error.code === 'FOREIGN_STATE',
  );
  const otherSession = new AfyxContextEngine({ stateDir: owned, ownerId: 'owner-a', sessionId: 'session-b' });
  assert.throws(
    () => otherSession.retrieve(result.items[0].reference),
    (error) => error instanceof AceError && error.code === 'REFERENCE_BOUNDARY',
  );
});

test('rejects a state root alias without touching its target', (t) => {
  const parent = lab(t);
  const target = path.join(parent, 'target');
  const alias = path.join(parent, 'alias');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'sentinel.txt'), 'unchanged');
  try {
    fs.symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') {
      t.skip('host does not permit disposable symlink/junction creation');
      return;
    }
    throw error;
  }
  assert.throws(
    () => new AfyxContextEngine({ stateDir: alias, ownerId: 'owner', sessionId: 'session' }),
    (error) => error instanceof AceError && error.code === 'UNSAFE_STATE_PATH',
  );
  assert.equal(fs.readFileSync(path.join(target, 'sentinel.txt'), 'utf8'), 'unchanged');
  assert.deepEqual(fs.readdirSync(target), ['sentinel.txt']);
});

test('fails closed when original content is corrupted', (t) => {
  const stateDir = lab(t);
  const engine = new AfyxContextEngine({ stateDir, ownerId: 'owner', sessionId: 'integrity' });
  const result = engine.reduce({ segments: [{ id: 'content', content: longContent }] });
  const digest = result.items[0].digest;
  fs.writeFileSync(path.join(stateDir, 'content', `${digest}.txt`), 'tampered');
  assert.throws(
    () => engine.retrieve(result.items[0].reference),
    (error) => error instanceof AceError && error.code === 'CONTENT_INTEGRITY',
  );
});

test('validates all segments before writing content', (t) => {
  const stateDir = lab(t);
  const engine = new AfyxContextEngine({ stateDir, ownerId: 'owner', sessionId: 'validation' });
  const before = fs.readdirSync(path.join(stateDir, 'content'));
  assert.throws(
    () => engine.reduce({ segments: [{ id: 'good', content: 'valid' }, { id: 'bad', content: 7 }] }),
    (error) => error instanceof AceError && error.code === 'INVALID_INPUT',
  );
  assert.deepEqual(fs.readdirSync(path.join(stateDir, 'content')), before);
});
