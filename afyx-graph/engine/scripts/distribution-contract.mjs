#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED_GRAMMARS = [
  'tree-sitter-typescript.wasm', 'tree-sitter-tsx.wasm', 'tree-sitter-javascript.wasm',
  'tree-sitter-go.wasm', 'tree-sitter-python.wasm', 'tree-sitter-rust.wasm',
  'tree-sitter-swift.wasm', 'tree-sitter-c_sharp.wasm', 'tree-sitter-ruby.wasm',
  'tree-sitter-php.wasm',
];
const ENGINE_SENTINELS = ['bin/afyx-graph.js', 'index.js', 'ui/shimmer-progress.js'];
const LEGAL_FILES = ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_ENGINE_MIT.txt'];

export class DistributionError extends Error {}

function requireFile(path, label = path) {
  if (!existsSync(path) || !statSync(path).isFile()) throw new DistributionError(`missing ${label}`);
  return path;
}

function localAssetPaths(html) {
  return [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url) && !url.startsWith('#'))
    .map((url) => url.replace(/^\.\//, '').replace(/[?#].*$/, ''))
    .filter(Boolean);
}

export function verifyEngineDistribution(root = SCRIPT_ROOT, { staged = false } = {}) {
  const dist = join(resolve(root), 'dist');
  const viewer = join(dist, 'viewer');
  const index = requireFile(join(viewer, 'index.html'), 'dist/viewer/index.html');
  const html = readFileSync(index, 'utf8');
  if (html.length < 200 || !/<div id="app">/.test(html)) {
    throw new DistributionError(`dist/viewer/index.html is not a complete viewer (${html.length} bytes)`);
  }
  const assets = localAssetPaths(html);
  if (assets.length === 0) throw new DistributionError('dist/viewer/index.html references no bundled assets');
  for (const asset of assets) requireFile(join(viewer, ...asset.split('/')), `dist/viewer/${asset}`);
  for (const file of ENGINE_SENTINELS) requireFile(join(dist, ...file.split('/')), `dist/${file}`);

  const wasm = join(dist, 'extraction', 'wasm');
  if (!existsSync(wasm)) throw new DistributionError('missing dist/extraction/wasm');
  const expected = new Set(REQUIRED_GRAMMARS);
  const sourceWasm = join(resolve(root), 'src', 'extraction', 'wasm');
  if (!staged && existsSync(sourceWasm)) {
    for (const file of readdirSync(sourceWasm)) if (file.endsWith('.wasm')) expected.add(file);
  }
  for (const grammar of expected) requireFile(join(wasm, grammar), `dist/extraction/wasm/${grammar}`);
  const grammarCount = readdirSync(wasm).filter((file) => file.endsWith('.wasm')).length;

  const engineMaps = walkFiles(dist).filter((file) => file.endsWith('.js.map') && !file.includes(`${sep}viewer${sep}`));
  if (engineMaps.length === 0) throw new DistributionError('engine JavaScript source maps are missing');
  const viewerMaps = walkFiles(viewer).filter((file) => file.endsWith('.map'));
  if (viewerMaps.length > 0) throw new DistributionError('viewer source maps must remain disabled');
  return { assets: assets.length, grammarCount, engineSourceMaps: engineMaps.length };
}

export function verifyBundle(root, target) {
  const bundle = resolve(root);
  const windows = target.startsWith('win32-');
  const lib = join(bundle, 'lib');
  const engine = verifyEngineDistribution(lib, { staged: true });
  const manifest = JSON.parse(readFileSync(requireFile(join(lib, 'package.json'), 'lib/package.json'), 'utf8'));
  if (manifest.name !== '@a5zero7/afyx-graph' || manifest.bin?.['afyx-graph'] !== './dist/bin/afyx-graph.js') {
    throw new DistributionError('lib/package.json has the wrong package identity or CLI entrypoint');
  }
  const metadata = JSON.parse(readFileSync(requireFile(join(bundle, 'metadata.json'), 'metadata.json'), 'utf8'));
  if (metadata.product_name !== 'Afyx Graph' || metadata.cli !== 'afyx-graph') {
    throw new DistributionError('metadata.json has the wrong operational identity');
  }
  for (const legal of LEGAL_FILES) {
    const file = requireFile(join(bundle, 'licenses', legal), `licenses/${legal}`);
    if (statSync(file).size === 0) throw new DistributionError(`licenses/${legal} is empty`);
  }
  requireFile(join(bundle, windows ? 'node.exe' : 'node'), windows ? 'node.exe' : 'node');
  const launcher = requireFile(
    join(bundle, 'bin', windows ? 'afyx-graph.cmd' : 'afyx-graph'),
    windows ? 'bin/afyx-graph.cmd' : 'bin/afyx-graph',
  );
  const launcherText = readFileSync(launcher, 'utf8');
  if (!launcherText.includes('lib') || !launcherText.includes('dist') || !launcherText.includes('afyx-graph.js')) {
    throw new DistributionError('launcher does not target lib/dist/bin/afyx-graph.js');
  }
  if (!existsSync(join(lib, 'node_modules'))) throw new DistributionError('production node_modules is missing');
  for (const forbidden of ['src', '__tests__', 'ui']) {
    if (existsSync(join(lib, forbidden))) throw new DistributionError(`development-only lib/${forbidden} is packaged`);
  }
  return { ...engine, legalFiles: LEGAL_FILES.length, target };
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  return files.sort();
}

export function artifactManifest(root) {
  const base = resolve(root);
  return walkFiles(base).map((absolute) => {
    const bytes = readFileSync(absolute);
    return {
      path: relative(base, absolute).split(sep).join('/'),
      type: 'file',
      size: bytes.length,
      executable: process.platform === 'win32' ? null : Boolean(statSync(absolute).mode & 0o111),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  });
}

function argument(flag, fallback) {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : fallback;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2];
    const root = resolve(argument('--root', SCRIPT_ROOT));
    if (command === 'verify-dist') console.log(JSON.stringify(verifyEngineDistribution(root), null, 2));
    else if (command === 'verify-bundle') console.log(JSON.stringify(verifyBundle(root, argument('--target', '')), null, 2));
    else if (command === 'manifest') console.log(JSON.stringify(artifactManifest(root), null, 2));
    else throw new DistributionError('usage: distribution-contract.mjs verify-dist|verify-bundle|manifest --root <dir> [--target <target>]');
  } catch (error) {
    console.error(`[distribution] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
