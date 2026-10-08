import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initGrammars, loadGrammarsForLanguages } from '../src/extraction/grammars';
import { tokenizeSource, tokenizeSourceWithParserOracle } from '../src/extraction/syntax-tokens';
import type { Language } from '../src/types';

const originalGate = process.env.AFYX_GRAPH_NATIVE_PARSER;

function restoreGate(): void {
  if (originalGate === undefined) delete process.env.AFYX_GRAPH_NATIVE_PARSER;
  else process.env.AFYX_GRAPH_NATIVE_PARSER = originalGate;
}

async function semanticTokens(source: string, language: Language, oracle = false) {
  const result = await (oracle ? tokenizeSourceWithParserOracle : tokenizeSource)(source, language);
  return result?.spans
    .filter((span) => span.cls !== 'other')
    .map((span) => [span.cls, source.slice(span.start, span.end)] as const);
}

describe('Afyx-native syntax token differential', () => {
  beforeAll(async () => {
    await initGrammars();
    await loadGrammarsForLanguages(['typescript', 'tsx', 'javascript', 'jsx', 'python', 'go', 'java']);
  });
  afterEach(restoreGate);

  it.each([
    ['sample.ts', 'typescript', 'export class Store { read(value: string) { return api.load(value); } } // note'],
    ['sample.js', 'javascript', 'export function run() { return api.load("function fake() {}"); }'],
    ['sample.py', 'python', 'def run(value: str):\n    # fake def hidden():\n    return api.load(value)'],
    ['sample.go', 'go', 'func Run(value string) string { return api.Load(value) } // note'],
    ['Sample.java', 'java', 'public class Sample { public String run() { return Api.load(); } }'],
    ['sample.tsx', 'tsx', 'export function View(): string { return render(); }'],
    ['sample.jsx', 'jsx', 'export function View() { return render(); }'],
  ] as const)('preserves semantic syntax classes for %s', async (_file, language, source) => {
    expect(await semanticTokens(source, language)).toEqual(await semanticTokens(source, language, true));
  });

  it('keeps interpolation code claimable while strings and comments stay opaque', async () => {
    process.env.AFYX_GRAPH_NATIVE_PARSER = '1';
    const source = 'const text = `fake() ${store.size()} // text`; // real';
    const tokens = await semanticTokens(source, 'typescript', true);
    expect(tokens).toContainEqual(['ident', 'size']);
    expect(tokens).toContainEqual(['comment', '// real']);
    expect(tokens).not.toContainEqual(['ident', 'fake']);
  });
});
