import { beforeAll, describe, expect, it } from 'vitest';
import { extractFromSource, TreeSitterExtractor } from '../src/extraction/tree-sitter';
import { initGrammars, loadGrammarsForLanguages } from '../src/extraction/grammars';
import type { Language } from '../src/types';

beforeAll(async () => {
  await initGrammars();
  await loadGrammarsForLanguages(['typescript', 'python', 'go', 'java']);
});

function canonical(filePath: string, source: string, language: Language, oracle = false) {
  const result = oracle
    ? new TreeSitterExtractor(filePath, source, language).extract()
    : extractFromSource(filePath, source, language);
  return {
    nodes: Object.fromEntries(result.nodes.map((node) => [`${node.kind}:${node.name}`, {
      id: node.id, kind: node.kind, name: node.name, qualifiedName: node.qualifiedName,
      filePath: node.filePath, language: node.language, startLine: node.startLine,
      endLine: node.endLine, startColumn: node.startColumn, endColumn: node.endColumn,
      isExported: node.isExported,
    }])),
    edges: result.edges.map(({ source, target, kind }) => ({ source, target, kind }))
      .sort((left, right) => left.target.localeCompare(right.target)),
    refs: result.unresolvedReferences.map((ref) => ({
      fromNodeId: ref.fromNodeId, referenceName: ref.referenceName,
      referenceKind: ref.referenceKind, line: ref.line, column: ref.column,
      filePath: ref.filePath, language: ref.language,
    })).sort((left, right) => left.line - right.line || left.column - right.column),
    errors: result.errors,
  };
}

describe('native parser semantic differential', () => {
  it('preserves the established TypeScript ground-truth facts', () => {
    const source = [
      "import { helper } from './helper';",
      'export class Ledger {',
      '  total(value: number): number {',
      '    return helper(value);',
      '  }',
      '}',
    ].join('\n');
    expect(canonical('ledger.ts', source, 'typescript')).toEqual(canonical('ledger.ts', source, 'typescript', true));
  });

  it.each([
    ['service.py', 'python', [
      'from helpers import normalize', '', 'class PaymentService:',
      '    def charge(self, amount: int) -> int:', '        return normalize(amount)',
    ].join('\n')],
    ['worker.go', 'go', [
      'package worker', '', 'import "fmt"', '', 'type Job struct {', '  ID int', '}', '',
      'func Process(job Job) string {', '  return fmt.Sprint(job.ID)', '}',
    ].join('\n')],
    ['Ledger.java', 'java', [
      'package com.example;', '', 'public class Ledger {',
      '  public int total() {', '    return 1;', '  }', '}',
    ].join('\n')],
  ] as const)('preserves %s ground-truth facts', (filePath, language, source) => {
    expect(canonical(filePath, source, language)).toEqual(canonical(filePath, source, language, true));
  });
});
