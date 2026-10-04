import { describe, expect, it } from 'vitest';
import { extractNativeFacts } from '../src/extraction/native/fact-extractor';

describe('Afyx-native JS/TS fact extraction', () => {
  it('extracts declarations, containment, imports, and calls without false comment/string facts', () => {
    const result = extractNativeFacts('src/ledger.ts', [
      "import { helper } from './helper';",
      'export class Ledger {',
      '  total(value: number): number {',
      '    return helper(value);',
      '  }',
      '}',
      'const decoy = "function ghost() {}";',
      '// function phantom() {}',
    ].join('\n'), 'typescript');

    expect(result.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'class', name: 'Ledger', startLine: 2, endLine: 6, isExported: true }),
      expect.objectContaining({ kind: 'method', name: 'total', startLine: 3, endLine: 5 }),
    ]));
    expect(result.nodes.some((node) => node.name === 'ghost' || node.name === 'phantom')).toBe(false);
    expect(result.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'contains', source: expect.stringMatching(/^class:/), target: expect.stringMatching(/^method:/) }),
    ]));
    expect(result.unresolvedReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ referenceKind: 'imports', referenceName: './helper' }),
      expect.objectContaining({ referenceKind: 'imports', referenceName: 'helper', line: 1 }),
    ]));
  });

  it('keeps useful prefix facts for incomplete code', () => {
    const result = extractNativeFacts('src/incomplete.ts', 'export function ready() { call(', 'typescript');
    expect(result.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'function', name: 'ready' }),
    ]));
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'native_incomplete_source' }),
    ]));
  });
});
