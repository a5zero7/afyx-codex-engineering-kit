import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afyx-graph-equivalence-'));
const distRoot = path.resolve('dist');
const child = path.resolve('scripts/afyx-equivalence-child.mjs');

function prepare(name) {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'parser.ts'), 'export function parseToken(raw: string) { return raw.trim(); }\n');
  fs.writeFileSync(path.join(dir, 'src', 'service.ts'), "import { parseToken } from './parser';\nexport function authenticate(raw: string) { return parseToken(raw); }\n");
  return dir;
}

function run(dir, afyx) {
  const env = { ...process.env, CODEGRAPH_WASM_RELAUNCHED: '1', CODEGRAPH_NO_WATCH: '1' };
  if (afyx) env.AFYX_GRAPH_PRODUCT = '1';
  const result = spawnSync(process.execPath, [child, dir, distRoot], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(fs.readFileSync(path.join(dir, 'equivalence-result.json'), 'utf8'));
}

try {
  const legacyRoot = prepare('legacy');
  const afyxRoot = prepare('afyx');
  const legacy = run(legacyRoot, false);
  const branded = run(afyxRoot, true);
  assert.deepEqual(branded, legacy);
  assert.ok(fs.existsSync(path.join(legacyRoot, '.codegraph', 'codegraph.db')));
  assert.ok(fs.existsSync(path.join(afyxRoot, '.afyx-graph', 'codegraph.db')));
  console.log('Afyx Graph / CodeGraph behavior equivalence: PASS');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
