/**
 * Reading symbol source for code blocks.
 *
 * Two rules matter more than convenience. A config-leaf node (a single key lifted out
 * of a YAML/properties file) never has its value read: the on-disk line is
 * `key = <secret>`, so only the key is returned. And a path that escapes the project
 * root (lexically or through a symlink) is treated as unreadable.
 *
 * A reader is scoped to one operation and reads each file at most once, however many
 * symbols of that file are requested.
 */

import * as fs from 'fs';
import type { CodeBlock, Node, Subgraph } from '../types';
import { logDebug } from '../errors';
import { isConfigLeafNode, validatePathWithinRoot } from '../utils';

const TRUNCATION_MARKER = '\n... (truncated) ...';

export class SourceReader {
  private readonly files = new Map<string, string[] | null>();

  constructor(private readonly projectRoot: string) {}

  /** Lines of a project file, or null when it is missing, outside the root, or unreadable. */
  private linesOf(filePath: string): string[] | null {
    if (this.files.has(filePath)) return this.files.get(filePath)!;
    let lines: string[] | null = null;
    const resolved = validatePathWithinRoot(this.projectRoot, filePath);
    if (resolved && fs.existsSync(resolved)) {
      try {
        lines = fs.readFileSync(resolved, 'utf-8').split('\n');
      } catch (error) {
        logDebug('Failed to extract code from file', { filePath, error: String(error) });
      }
    }
    this.files.set(filePath, lines);
    return lines;
  }

  /** The node's source between its start and end lines (1-indexed, inclusive). */
  read(node: Node): string | null {
    if (isConfigLeafNode(node)) return node.signature || node.qualifiedName || node.name;
    const lines = this.linesOf(node.filePath);
    if (!lines) return null;
    return lines.slice(Math.max(0, node.startLine - 1), Math.min(lines.length, node.endLine)).join('\n');
  }
}

/**
 * Nodes worth showing code for, best first: entry points, then remaining functions
 * and methods, then remaining classes (each group in discovery order).
 */
function codePriority(subgraph: Subgraph): Node[] {
  const roots = new Set(subgraph.roots);
  const entries = subgraph.roots.map((id) => subgraph.nodes.get(id)).filter((node): node is Node => node !== undefined);
  const others = [...subgraph.nodes.values()].filter((node) => !roots.has(node.id));
  return [
    ...entries,
    ...others.filter((node) => node.kind === 'function' || node.kind === 'method'),
    ...others.filter((node) => node.kind === 'class'),
  ];
}

/** Code blocks for the highest-priority symbols, stopping as soon as the budget is met. */
export function selectCodeBlocks(subgraph: Subgraph, reader: SourceReader, maxBlocks: number, maxBlockSize: number): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  for (const node of codePriority(subgraph)) {
    if (blocks.length >= maxBlocks) break;
    const code = reader.read(node);
    if (!code) continue;
    blocks.push({
      // A language-neutral marker: the block renders inside a fence whose language varies.
      content: code.length > maxBlockSize ? code.slice(0, maxBlockSize) + TRUNCATION_MARKER : code,
      filePath: node.filePath,
      startLine: node.startLine,
      endLine: node.endLine,
      language: node.language,
      node,
    });
  }
  return blocks;
}
