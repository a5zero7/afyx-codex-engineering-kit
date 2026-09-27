/**
 * Turning a `TaskContext` into text.
 *
 *   markdown   compact and ordered for a reader with a small budget: header, entry
 *              points, at most ten related symbols grouped by file, code blocks.
 *              Generated files (protobuf stubs, mocks, ...) always sort last and
 *              never appear among related symbols: flow questions want the
 *              hand-written implementation first.
 *   json       the same content as a structured document for programs
 *   tree       an indented relationship outline of a subgraph
 *   bytes      human-readable sizes
 */

import type { CodeBlock, Edge, Node, Subgraph, TaskContext } from '../types';
import { isGeneratedFile } from '../extraction/generated-detection';

const MAX_RELATED_SYMBOLS = 10;

/** Non-generated items first, generated ones after, each group in its original order. */
function generatedLast<T>(items: readonly T[], pathOf: (item: T) => string, isGenerated: (filePath: string) => boolean): T[] {
  const handWritten: T[] = [];
  const generated: T[] = [];
  for (const item of items) (isGenerated(pathOf(item)) ? generated : handWritten).push(item);
  return [...handWritten, ...generated];
}

const locationOf = (node: Node): string => (node.startLine ? `:${node.startLine}` : '');

function entryPointLines(entries: readonly Node[]): string[] {
  if (entries.length === 0) return [];
  const lines = ['### Entry Points\n'];
  for (const node of entries) {
    lines.push(`- **${node.name}** (${node.kind}) - ${node.filePath}${locationOf(node)}`);
    if (node.signature) lines.push(`  \`${node.signature}\``);
  }
  lines.push('');
  return lines;
}

function relatedSymbolLines(context: TaskContext, isGenerated: (filePath: string) => boolean): string[] {
  const entryIds = new Set(context.entryPoints.map((node) => node.id));
  const related = [...context.subgraph.nodes.values()]
    .filter((node) => !entryIds.has(node.id) && !isGenerated(node.filePath))
    .slice(0, MAX_RELATED_SYMBOLS);
  if (related.length === 0) return [];

  const byFile = new Map<string, Node[]>();
  for (const node of related) {
    const group = byFile.get(node.filePath);
    if (group) group.push(node);
    else byFile.set(node.filePath, [node]);
  }
  const lines = ['### Related Symbols\n'];
  for (const [file, nodes] of byFile) lines.push(`- ${file}: ${nodes.map((node) => `${node.name}:${node.startLine}`).join(', ')}`);
  lines.push('');
  return lines;
}

function codeBlockLines(blocks: readonly CodeBlock[]): string[] {
  if (blocks.length === 0) return [];
  const lines = ['### Code\n'];
  for (const block of blocks) {
    lines.push(`#### ${block.node?.name ?? 'Unknown'} (${block.filePath}:${block.startLine})\n`, '```' + block.language, block.content, '```\n');
  }
  return lines;
}

/** `isGenerated` defaults to the filename convention; the builder passes a storage-backed test that also knows header-flagged files. */
export function formatContextAsMarkdown(context: TaskContext, isGenerated: (filePath: string) => boolean = isGeneratedFile): string {
  return [
    '## Code Context\n',
    `**Query:** ${context.query}\n`,
    ...entryPointLines(generatedLast(context.entryPoints, (node) => node.filePath, isGenerated)),
    ...relatedSymbolLines(context, isGenerated),
    ...codeBlockLines(generatedLast(context.codeBlocks, (block) => block.filePath, isGenerated)),
  ].join('\n');
}

const describeNode = (node: Node): Record<string, unknown> => ({
  id: node.id,
  kind: node.kind,
  name: node.name,
  qualifiedName: node.qualifiedName,
  filePath: node.filePath,
  language: node.language,
  startLine: node.startLine,
  endLine: node.endLine,
  signature: node.signature,
  docstring: node.docstring,
  visibility: node.visibility,
  isExported: node.isExported,
  isAsync: node.isAsync,
  isStatic: node.isStatic,
});

const describeEdge = (edge: Edge): Record<string, unknown> => ({
  source: edge.source,
  target: edge.target,
  kind: edge.kind,
  line: edge.line,
  column: edge.column,
});

export function formatContextAsJson(context: TaskContext): string {
  return JSON.stringify({
    query: context.query,
    summary: context.summary,
    entryPoints: context.entryPoints.map(describeNode),
    nodes: [...context.subgraph.nodes.values()].map(describeNode),
    edges: context.subgraph.edges.map(describeEdge),
    codeBlocks: context.codeBlocks.map((block) => ({
      filePath: block.filePath,
      startLine: block.startLine,
      endLine: block.endLine,
      language: block.language,
      content: block.content,
      nodeName: block.node?.name,
      nodeKind: block.node?.kind,
    })),
    relatedFiles: context.relatedFiles,
    stats: context.stats,
  }, null, 2);
}

// ---- relationship outline -----------------------------------------------------------------

const OUTLINE_KINDS: ReadonlySet<string> = new Set(['calls', 'extends', 'implements', 'imports', 'references']);
const MAX_EDGES_LISTED = 3;
const MAX_OUTLINE_REMAINDER = 10;
const SIGNATURE_WIDTH = 50;

const shorten = (text: string, width: number): string => (text.length <= width ? text : `${text.slice(0, width - 3)}...`);

export function formatSubgraphTree(subgraph: Subgraph, entryPoints: Node[]): string {
  const outgoing = new Map<string, Edge[]>();
  for (const edge of subgraph.edges) {
    const list = outgoing.get(edge.source);
    if (list) list.push(edge);
    else outgoing.set(edge.source, [edge]);
  }
  const printed = new Set<string>();
  const lines: string[] = [];
  const nameOf = (id: string): string => subgraph.nodes.get(id)?.name ?? 'unknown';

  const outline = (node: Node, depth: number, indent: string): void => {
    if (printed.has(node.id)) return;
    printed.add(node.id);
    const signature = node.signature ? ` - ${shorten(node.signature, SIGNATURE_WIDTH)}` : '';
    lines.push(`${indent}${node.kind}: ${node.name} (${node.filePath}${locationOf(node)})${signature}`);

    const relations = (outgoing.get(node.id) ?? []).filter((edge) => OUTLINE_KINDS.has(edge.kind));
    const byKind = new Map<string, Edge[]>();
    for (const edge of relations) {
      const group = byKind.get(edge.kind);
      if (group) group.push(edge);
      else byKind.set(edge.kind, [edge]);
    }
    const inner = `${indent}  `;
    for (const [kind, group] of byKind) {
      if (group.length > MAX_EDGES_LISTED) {
        const shown = group.slice(0, MAX_EDGES_LISTED).map((edge) => nameOf(edge.target)).join(', ');
        lines.push(`${inner}├── ${kind}: ${shown} and ${group.length - MAX_EDGES_LISTED} more`);
      } else {
        group.forEach((edge, index) => lines.push(`${inner}${index === group.length - 1 ? '└──' : '├──'} ${kind} → ${nameOf(edge.target)}`));
      }
    }
    if (depth >= 1) return;
    for (const edge of relations.slice(0, MAX_EDGES_LISTED)) {
      const target = subgraph.nodes.get(edge.target);
      if (target && !printed.has(target.id)) outline(target, depth + 1, inner);
    }
  };

  for (const entry of entryPoints) {
    outline(entry, 0, '');
    lines.push('');
  }

  const remaining = [...subgraph.nodes.values()].filter((node) => !printed.has(node.id));
  if (remaining.length > MAX_OUTLINE_REMAINDER) {
    lines.push(`... and ${remaining.length} more related symbols`);
  } else if (remaining.length > 0) {
    lines.push('Other relevant symbols:');
    for (const node of remaining) lines.push(`  ${node.kind}: ${node.name} (${node.filePath}${locationOf(node)})`);
  }
  return lines.join('\n').trim();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
