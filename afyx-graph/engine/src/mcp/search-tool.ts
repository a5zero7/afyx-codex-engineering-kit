import type { NodeKind, SearchResult } from '../types';
import { clamp } from '../utils';
import { boundToolOutput } from './tool-output';
import { textToolResult, type ToolResult } from './tool-results';

export interface SearchToolSource {
  searchNodes(query: string, options: { limit: number; kinds?: NodeKind[] }): SearchResult[];
  generatedFilePredicate(filePaths: Iterable<string>): (filePath: string) => boolean;
}

export interface SearchToolRequest {
  query: string;
  kind?: string;
  limit?: unknown;
}

/** Adapt an already-validated MCP Search request to the frozen Search domain API. */
export function executeSearchTool(source: SearchToolSource, request: SearchToolRequest): ToolResult {
  const kind = request.kind === 'type' ? 'type_alias' : request.kind;
  const limit = clamp(Number(request.limit) || 10, 1, 100);
  const results = source.searchNodes(request.query, {
    limit,
    kinds: kind ? [kind as NodeKind] : undefined,
  });

  if (results.length === 0) {
    return textToolResult(`No results found for "${request.query}"`);
  }

  const isGenerated = source.generatedFilePredicate(results.map((result) => result.node.filePath));
  const ordered = [...results].sort((left, right) => {
    const leftGenerated = isGenerated(left.node.filePath) ? 1 : 0;
    const rightGenerated = isGenerated(right.node.filePath) ? 1 : 0;
    return leftGenerated - rightGenerated;
  });

  return textToolResult(boundToolOutput(formatSearchResults(ordered)));
}

function formatSearchResults(results: SearchResult[]): string {
  const lines: string[] = [`**Search Results (${results.length} found)**`, ''];

  for (const { node } of results) {
    const location = node.startLine ? `:${node.startLine}` : '';
    lines.push(`**${node.name}** (${node.kind})`);
    lines.push(`${node.filePath}${location}`);
    if (node.signature) lines.push(`\`${node.signature}\``);
    lines.push('');
  }

  return lines.join('\n');
}
