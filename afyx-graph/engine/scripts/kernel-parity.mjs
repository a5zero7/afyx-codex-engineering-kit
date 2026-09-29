#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ENGINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LANGUAGES = new Set(['typescript', 'tsx', 'javascript', 'jsx', 'java', 'python', 'go', 'c', 'cpp', 'rust', 'csharp', 'ruby', 'php', 'swift', 'kotlin', 'r', 'lua', 'luau', 'scala', 'dart']);
const EXTENSIONS = new Map(Object.entries({
  '.ts': 'typescript', '.mts': 'typescript', '.cts': 'typescript', '.tsx': 'tsx',
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.jsx': 'jsx',
  '.java': 'java', '.py': 'python', '.pyw': 'python', '.go': 'go', '.c': 'c',
  '.h': 'detect', '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
  '.hxx': 'cpp', '.metal': 'cpp', '.cu': 'cpp', '.cuh': 'cpp', '.rs': 'rust',
  '.cs': 'csharp', '.rb': 'ruby', '.rake': 'ruby', '.php': 'php', '.module': 'php',
  '.install': 'php', '.theme': 'php', '.inc': 'php', '.swift': 'swift', '.kt': 'kotlin',
  '.kts': 'kotlin', '.r': 'r', '.lua': 'lua', '.luau': 'luau', '.scala': 'scala',
  '.sc': 'scala', '.dart': 'dart',
}));
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', 'dist', '.afyx-graph']);

function parseArguments(argv) {
  const options = { inputs: [], languages: null, sampleLimit: 5, listFiles: false, maxDeferral: 0.1 };
  const value = (flag, index) => {
    if (index + 1 >= argv.length) throw new Error(`missing value for ${flag}`);
    return argv[index + 1];
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--lang') options.languages = new Set(value(token, index++).split(','));
    else if (token === '--max-samples') options.sampleLimit = Number(value(token, index++));
    else if (token === '--max-deferral') options.maxDeferral = Number(value(token, index++));
    else if (token === '--list-files') options.listFiles = true;
    else if (token.startsWith('--')) throw new Error(`unknown option: ${token}`);
    else options.inputs.push(token);
  }
  if (options.inputs.length === 0) throw new Error('usage: kernel-parity.mjs <file-or-dir>... [--lang ts,tsx] [--max-samples N]');
  if (!Number.isFinite(options.sampleLimit) || options.sampleLimit < 0) throw new Error('--max-samples must be a non-negative number');
  if (!Number.isFinite(options.maxDeferral) || options.maxDeferral < 0 || options.maxDeferral > 1) throw new Error('--max-deferral must be between 0 and 1');
  return options;
}

function discover(location, languages, found) {
  let state;
  try { state = statSync(location); } catch { return; }
  if (state.isDirectory()) {
    if (SKIP_DIRECTORIES.has(basename(location))) return;
    for (const entry of readdirSync(location).sort()) discover(join(location, entry), languages, found);
    return;
  }
  const language = EXTENSIONS.get(extname(location).toLowerCase());
  if (!language) return;
  if (languages && language !== 'detect' && !languages.has(language)) return;
  if (languages && language === 'detect' && !languages.has('c') && !languages.has('cpp')) return;
  found.push({ file: location, language });
}

function select(object, required, optional = []) {
  const selected = Object.fromEntries(required.map((key) => [key, object[key]]));
  for (const key of optional) if (object[key] !== undefined) selected[key] = object[key];
  return JSON.stringify(selected);
}

const canonicalizers = {
  node: (value) => select(value,
    ['id', 'kind', 'name', 'qualifiedName', 'filePath', 'language', 'startLine', 'endLine', 'startColumn', 'endColumn'],
    ['docstring', 'signature', 'visibility', 'isExported', 'isAsync', 'isStatic', 'isAbstract', 'returnType', 'decorators', 'typeParameters']),
  edge: (value) => select(value, ['source', 'target', 'kind'], ['line', 'column', 'provenance', 'metadata']),
  ref: (value) => select({ ...value, from: value.fromNodeId, name: value.referenceName, kind: value.referenceKind },
    ['from', 'name', 'kind', 'line', 'column'], ['filePath', 'language', 'candidates', 'rowId']),
};

function multisetDifference(left, right) {
  const counts = (values) => values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map());
  const a = counts(left); const b = counts(right);
  const expand = (source, other) => [...source].flatMap(([value, count]) => Array(Math.max(0, count - (other.get(value) ?? 0))).fill(value));
  return { missing: expand(a, b), extra: expand(b, a) };
}

class Findings {
  constructor(sampleLimit) { this.sampleLimit = sampleLimit; this.categories = new Map(); }
  add(category, sample) {
    const bucket = this.categories.get(category) ?? { count: 0, samples: [] };
    bucket.count += 1;
    if (bucket.samples.length < this.sampleLimit) bucket.samples.push(sample);
    this.categories.set(category, bucket);
  }
  print() {
    for (const [category, bucket] of [...this.categories].sort((a, b) => b[1].count - a[1].count)) {
      console.log(`--- ${category}: ${bucket.count}`);
      for (const sample of bucket.samples) console.log(`    ${sample.length > 400 ? `${sample.slice(0, 400)}…` : sample}`);
    }
  }
}

async function main() {
  let options;
  try { options = parseArguments(process.argv.slice(2)); } catch (error) { console.error(error.message); return 2; }
  const candidates = [];
  for (const input of options.inputs) discover(resolve(input), options.languages, candidates);
  if (candidates.length === 0) { console.error('no matching files'); return 2; }

  const fromDist = (path) => import(pathToFileURL(join(ENGINE_ROOT, 'dist', path)).href);
  if (!existsSync(join(ENGINE_ROOT, 'dist'))) { console.error('dist not found — run: npm run build'); return 2; }
  const extractor = await fromDist('extraction/tree-sitter.js');
  const grammars = await fromDist('extraction/grammars.js');
  const kernel = await fromDist('extraction/kernel/index.js');
  await grammars.initGrammars();
  await grammars.loadGrammarsForLanguages([...LANGUAGES]);
  if (!kernel.getKernel()) { console.error('kernel .node not found — run: npm run build:kernel'); return 2; }

  const findings = new Findings(options.sampleLimit);
  const outcome = { processed: 0, ok: 0, different: 0, deferred: 0, nodes: 0, edges: 0, refs: 0 };
  process.env.AFYX_GRAPH_KERNEL_LANGS = 'all';
  for (const candidate of candidates) {
    const source = readFileSync(candidate.file, 'utf8');
    const display = relative(ENGINE_ROOT, candidate.file);
    const language = candidate.language === 'detect' ? grammars.detectLanguage(display, source) : candidate.language;
    if (!LANGUAGES.has(language) || (options.languages && !options.languages.has(language))) continue;
    outcome.processed += 1;
    delete process.env.AFYX_GRAPH_KERNEL;
    const nativeResult = kernel.tryKernelExtract(display, source, language);
    if (!nativeResult) { outcome.deferred += 1; findings.add('kernel-deferred', display); continue; }
    process.env.AFYX_GRAPH_KERNEL = '0';
    const wasmResult = extractor.extractFromSource(display, source, language);
    delete process.env.AFYX_GRAPH_KERNEL;
    outcome.nodes += wasmResult.nodes.length; outcome.edges += wasmResult.edges.length; outcome.refs += wasmResult.unresolvedReferences.length;
    let differs = false;
    const tables = { node: [wasmResult.nodes, nativeResult.nodes], edge: [wasmResult.edges, nativeResult.edges], ref: [wasmResult.unresolvedReferences, nativeResult.unresolvedReferences] };
    for (const [kind, [wasmRows, nativeRows]] of Object.entries(tables)) {
      const wasm = wasmRows.map(canonicalizers[kind]); const native = nativeRows.map(canonicalizers[kind]);
      const delta = multisetDifference(wasm, native);
      for (const row of delta.missing) { differs = true; findings.add(`${kind}:missing-in-kernel:${JSON.parse(row).kind ?? ''}`, `${display}: ${row}`); }
      for (const row of delta.extra) { differs = true; findings.add(`${kind}:extra-in-kernel:${JSON.parse(row).kind ?? ''}`, `${display}: ${row}`); }
      if (delta.missing.length === 0 && delta.extra.length === 0) {
        const mismatch = wasm.findIndex((row, index) => row !== native[index]);
        if (mismatch >= 0) { differs = true; findings.add(`${kind}:order-mismatch`, `${display}: index ${mismatch}: wasm=${wasm[mismatch]} kernel=${native[mismatch]}`); }
      }
    }
    outcome[differs ? 'different' : 'ok'] += 1;
    if (differs && options.listFiles) console.log(`DIFF ${display}`);
  }

  console.log(`\n=== kernel parity: ${outcome.ok}/${outcome.processed} files byte-parity (${outcome.different} with diffs, ${outcome.deferred} deferred-to-wasm) | wasm totals: ${outcome.nodes} nodes / ${outcome.edges} edges / ${outcome.refs} refs ===\n`);
  findings.print();
  const deferralRate = outcome.deferred / Math.max(outcome.processed, 1);
  if (deferralRate > options.maxDeferral) {
    console.error(`deferral rate ${(deferralRate * 100).toFixed(1)}% exceeds ${(options.maxDeferral * 100).toFixed(0)}% — kernel likely broken`);
    return 1;
  }
  return outcome.different > 0 ? 1 : 0;
}

process.exitCode = await main();
