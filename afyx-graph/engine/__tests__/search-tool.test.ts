import { describe, expect, it } from 'vitest';
import { executeSearchTool, type SearchToolSource } from '../src/mcp/search-tool';
import type { SearchResult } from '../src/types';

const result = (name: string, filePath = `src/${name}.ts`, extra: Record<string, unknown> = {}): SearchResult => ({
  node: { id: name, name, kind: 'function', filePath, language: 'typescript', ...extra } as SearchResult['node'],
  score: 1,
});

function fixture(results: SearchResult[]) {
  const calls: Array<{ query: string; options: unknown }> = [];
  const predicateInputs: string[][] = [];
  const source: SearchToolSource = {
    searchNodes(query, options) { calls.push({ query, options }); return results; },
    generatedFilePredicate(paths) {
      predicateInputs.push([...paths]);
      return (path) => path.includes('/generated/');
    },
  };
  return { source, calls, predicateInputs };
}

describe('MCP Search adapter', () => {
  it('maps type to type_alias and invokes the domain exactly once', () => {
    const { source, calls } = fixture([result('hit')]);
    executeSearchTool(source, { query: 'needle', kind: 'type', limit: 5 });
    expect(calls).toEqual([{ query: 'needle', options: { limit: 5, kinds: ['type_alias'] } }]);
  });

  it('omits kinds when no kind is supplied and forwards other runtime kinds', () => {
    const omitted = fixture([result('hit')]);
    executeSearchTool(omitted.source, { query: 'q' });
    expect(omitted.calls[0]).toEqual({ query: 'q', options: { limit: 10, kinds: undefined } });

    const unknown = fixture([result('hit')]);
    executeSearchTool(unknown.source, { query: 'q', kind: 'mystery' });
    expect(unknown.calls[0]).toEqual({ query: 'q', options: { limit: 10, kinds: ['mystery'] } });
  });

  it.each([
    [undefined, 10], [0, 10], [5, 5], [-3, 1], [101, 100], ['7', 7], ['bad', 10],
  ])('normalizes limit %p to %p', (input, expected) => {
    const { source, calls } = fixture([result('hit')]);
    executeSearchTool(source, { query: 'q', limit: input });
    expect((calls[0]!.options as { limit: number }).limit).toBe(expected);
  });

  it('returns exact success-shaped empty result', () => {
    const { source } = fixture([]);
    expect(executeSearchTool(source, { query: 'missing' })).toEqual({
      content: [{ type: 'text', text: 'No results found for "missing"' }],
    });
  });

  it('stably orders handwritten results before generated results', () => {
    const { source, predicateInputs } = fixture([
      result('genA', 'src/generated/a.ts'), result('handA'),
      result('genB', 'src/generated/b.ts'), result('handB'),
    ]);
    const text = executeSearchTool(source, { query: 'q' }).content[0]!.text;
    expect(predicateInputs).toEqual([['src/generated/a.ts', 'src/handA.ts', 'src/generated/b.ts', 'src/handB.ts']]);
    expect([...text.matchAll(/^\*\*(.+?)\*\* \(/gm)].map((match) => match[1])).toEqual(['handA', 'handB', 'genA', 'genB']);
  });

  it('preserves exact compact formatting, optional signature, and optional line', () => {
    const { source } = fixture([
      result('signed', 'src/signed.ts', { startLine: 17, signature: 'signed(): void' }),
      result('plain', 'src/plain.ts'),
    ]);
    expect(executeSearchTool(source, { query: 'q' }).content[0]!.text).toBe(
      '**Search Results (2 found)**\n\n' +
      '**signed** (function)\nsrc/signed.ts:17\n`signed(): void`\n\n' +
      '**plain** (function)\nsrc/plain.ts\n'
    );
  });

  it('consumes the frozen shared output bound', () => {
    const results = Array.from({ length: 180 }, (_, index) =>
      result(`item${index}`, `src/${'x'.repeat(80)}/${index}.ts`, { signature: `${'arg: string, '.repeat(12)}` }),
    );
    const { source } = fixture(results);
    const text = executeSearchTool(source, { query: 'q', limit: 100 }).content[0]!.text;
    expect(text.endsWith('\n\n... (output truncated)')).toBe(true);
    expect(text.length).toBeLessThanOrEqual(15_024);
  });
});
