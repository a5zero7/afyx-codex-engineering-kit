import type AfyxGraph from '../index';
import { textToolResult, type ToolResult } from './tool-results';

export type StatusToolSource = Pick<
  AfyxGraph,
  | 'getStats'
  | 'getJournalMode'
  | 'getPendingReferenceCount'
  | 'isWatcherDegraded'
  | 'getWatcherDegradedReason'
  | 'getPendingFiles'
>;

export interface StatusToolContext {
  worktreeWarning?: string;
  nowMs: number;
}

/** Render the MCP Status contract from already-selected live graph state. */
export function executeStatusTool(
  source: StatusToolSource,
  context: StatusToolContext,
): ToolResult {
  const stats = source.getStats();
  const lines: string[] = ['**Afyx Graph Status**', ''];

  if (context.worktreeWarning) {
    lines.push(`> ⚠ ${context.worktreeWarning.replace(/\n/g, '\n> ')}`, '');
  }

  lines.push(
    `**Files indexed:** ${stats.fileCount}`,
    `**Total nodes:** ${stats.nodeCount}`,
    `**Total edges:** ${stats.edgeCount}`,
    `**Database size:** ${(stats.dbSizeBytes / 1024 / 1024).toFixed(2)} MB`,
    '**Backend:** node:sqlite (Node built-in) — full WAL + FTS5',
  );

  const journalMode = source.getJournalMode();
  if (journalMode === 'wal') {
    lines.push('**Journal mode:** wal (concurrent reads safe)');
  } else {
    lines.push(
      `**Journal mode:** ⚠ ${journalMode || 'unknown'} — WAL not active, so reads ` +
      'can block on a concurrent write (WAL appears unsupported on this filesystem)',
    );
  }

  const pendingReferences = source.getPendingReferenceCount();
  if (pendingReferences > 0) {
    lines.push(
      `**Pending resolution:** ⚠ ${pendingReferences} references from an interrupted ` +
      'index run — some caller/impact edges are missing until the next sync ' +
      '(any file change triggers it, or run `afyx-graph sync`)',
    );
  }

  lines.push('', '**Nodes by Kind:**');
  for (const [kind, count] of Object.entries(stats.nodesByKind)) {
    if (count > 0) lines.push(`- ${kind}: ${count}`);
  }

  lines.push('', '**Languages:**');
  for (const [language, count] of Object.entries(stats.filesByLanguage)) {
    if (count > 0) lines.push(`- ${language}: ${count}`);
  }

  if (source.isWatcherDegraded()) {
    lines.push(
      '',
      '**Auto-sync disabled:**',
      `- ${source.getWatcherDegradedReason() ?? 'live file watching stopped'}`,
      '- The index is frozen; Read files directly for current content.',
    );
  }

  const pendingFiles = source.getPendingFiles();
  if (pendingFiles.length > 0) {
    lines.push('', '**Pending sync:**');
    for (const pending of pendingFiles) {
      const ageMs = Math.max(0, context.nowMs - pending.lastSeenMs);
      const label = pending.indexing ? 'indexing in progress' : 'pending sync';
      lines.push(`- ${pending.path} (edited ${ageMs}ms ago, ${label})`);
    }
  }

  return textToolResult(lines.join('\n'));
}
