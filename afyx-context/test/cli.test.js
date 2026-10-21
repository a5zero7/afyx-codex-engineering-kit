import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));

function run(args, input) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', input });
}

test('CLI reduces JSON from stdin and retrieves its stable reference', (t) => {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'afyx-context-cli-'));
  t.after(() => fs.rmSync(state, { recursive: true, force: true }));
  const content = 'CLI original content '.repeat(30);
  const input = JSON.stringify({ segments: [{ id: 'a', content }, { id: 'b', content }] });
  const reduced = run(['reduce', '--state', state, '--owner', 'cli-owner', '--session', 'cli-session', '--input', '-'], input);
  assert.equal(reduced.status, 0, reduced.stderr);
  const result = JSON.parse(reduced.stdout);
  assert.equal(result.items[1].disposition, 'reference');

  const restored = run(['get', '--state', state, '--owner', 'cli-owner', '--session', 'cli-session', '--reference', result.items[1].reference]);
  assert.equal(restored.status, 0, restored.stderr);
  assert.equal(restored.stdout, content);
});

test('CLI reports bounded validation failure without falling back to another state', () => {
  const result = run(['reduce', '--state', 'relative', '--owner', 'owner', '--session', 'session', '--input', '-'], '{"segments":[]}');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /UNSAFE_STATE_PATH/);
});
