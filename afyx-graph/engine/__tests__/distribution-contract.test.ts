import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
// The production helper is intentionally plain ESM so release shells can invoke it directly.
// @ts-expect-error JavaScript module has no declaration file.
import { artifactManifest, verifyBundle } from '../scripts/distribution-contract.mjs';

const grammars = [
  'typescript', 'tsx', 'javascript', 'go', 'python', 'rust', 'swift', 'c_sharp', 'ruby', 'php',
];
const roots: string[] = [];

function file(root: string, relative: string, content = 'fixture'): void {
  const target = join(root, ...relative.split('/'));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function bundle(): string {
  const root = mkdtempSync(join(tmpdir(), 'afyx-distribution-'));
  roots.push(root);
  file(root, 'lib/dist/viewer/index.html', `${'<html>'.padEnd(210, ' ')}<div id="app"></div><script src="./assets/app.js"></script>`);
  file(root, 'lib/dist/viewer/assets/app.js');
  file(root, 'lib/dist/bin/afyx-graph.js');
  file(root, 'lib/dist/index.js');
  file(root, 'lib/dist/index.js.map');
  file(root, 'lib/dist/ui/shimmer-progress.js');
  for (const grammar of grammars) file(root, `lib/dist/extraction/wasm/tree-sitter-${grammar}.wasm`);
  file(root, 'lib/package.json', JSON.stringify({ name: '@a5zero7/afyx-graph', bin: { 'afyx-graph': './dist/bin/afyx-graph.js' } }));
  mkdirSync(join(root, 'lib', 'node_modules'), { recursive: true });
  file(root, 'metadata.json', JSON.stringify({ product_name: 'Afyx Graph', cli: 'afyx-graph' }));
  file(root, 'licenses/THIRD_PARTY_NOTICES.md');
  file(root, 'licenses/THIRD_PARTY_ENGINE_MIT.txt');
  file(root, 'node.exe');
  file(root, 'bin/afyx-graph.cmd', 'node.exe lib\\dist\\bin\\afyx-graph.js');
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Afyx distribution contract', () => {
  it('accepts a complete staged bundle and emits a stable sorted manifest', () => {
    const root = bundle();
    expect(verifyBundle(root, 'win32-x64')).toMatchObject({ legalFiles: 2, target: 'win32-x64' });
    const first = artifactManifest(root);
    expect(first).toEqual(artifactManifest(root));
    expect(first.map((entry: { path: string }) => entry.path)).toEqual(first.map((entry: { path: string }) => entry.path).sort());
  });

  it.each([
    ['runtime artifact', 'node.exe'],
    ['viewer asset', 'lib/dist/viewer/assets/app.js'],
    ['wasm grammar', 'lib/dist/extraction/wasm/tree-sitter-python.wasm'],
    ['required notice', 'licenses/THIRD_PARTY_NOTICES.md'],
    ['launcher', 'bin/afyx-graph.cmd'],
  ])('rejects a missing %s', (_label, relative) => {
    const root = bundle();
    unlinkSync(join(root, ...relative.split('/')));
    expect(() => verifyBundle(root, 'win32-x64')).toThrow();
  });

  it('rejects development-only content', () => {
    const root = bundle();
    file(root, 'lib/src/stale.ts');
    expect(() => verifyBundle(root, 'win32-x64')).toThrow(/development-only/);
  });

  it('rejects wrong CLI metadata', () => {
    const root = bundle();
    file(root, 'lib/package.json', JSON.stringify({ name: '@a5zero7/afyx-graph', bin: { 'afyx-graph': './wrong.js' } }));
    expect(() => verifyBundle(root, 'win32-x64')).toThrow(/entrypoint/);
  });
});
