/**
 * Whole-graph statistics and project metadata reads.
 */

import type { EdgeKind, GraphStats, Language, NodeKind } from '../types';
import { QuerySession } from './query-session';

export class StatsReader {
  constructor(private readonly session: QuerySession) {}

  /** Lightweight (nodes, edges) count snapshot, used around an index/sync run to compute true additions across extraction + resolution + synthesis. */
  getNodeAndEdgeCount(): { nodes: number; edges: number } {
    return this.session.db.prepare('SELECT (SELECT COUNT(*) FROM nodes) AS nodes, (SELECT COUNT(*) FROM edges) AS edges').get() as { nodes: number; edges: number };
  }

  getStats(): GraphStats {
    const counts = this.session.db
      .prepare('SELECT (SELECT COUNT(*) FROM nodes) AS node_count, (SELECT COUNT(*) FROM edges) AS edge_count, (SELECT COUNT(*) FROM files) AS file_count')
      .get() as { node_count: number; edge_count: number; file_count: number };

    const nodesByKind = {} as Record<NodeKind, number>;
    for (const row of this.session.db.prepare('SELECT kind, COUNT(*) as count FROM nodes GROUP BY kind').all() as Array<{ kind: string; count: number }>) {
      nodesByKind[row.kind as NodeKind] = row.count;
    }
    const edgesByKind = {} as Record<EdgeKind, number>;
    for (const row of this.session.db.prepare('SELECT kind, COUNT(*) as count FROM edges GROUP BY kind').all() as Array<{ kind: string; count: number }>) {
      edgesByKind[row.kind as EdgeKind] = row.count;
    }
    const filesByLanguage = {} as Record<Language, number>;
    for (const row of this.session.db.prepare('SELECT language, COUNT(*) as count FROM files GROUP BY language').all() as Array<{ language: string; count: number }>) {
      filesByLanguage[row.language as Language] = row.count;
    }

    return {
      nodeCount: counts.node_count,
      edgeCount: counts.edge_count,
      fileCount: counts.file_count,
      nodesByKind,
      edgesByKind,
      filesByLanguage,
      dbSizeBytes: 0, // set by the caller from DatabaseConnection.getSize()
      walSizeBytes: 0, // set by the caller from DatabaseConnection.getWalSizeBytes()
      lastUpdated: Date.now(),
    };
  }

  getMetadata(key: string): string | null {
    const row = this.session.db.prepare('SELECT value FROM project_metadata WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  getAllMetadata(): Record<string, string> {
    const rows = this.session.db.prepare('SELECT key, value FROM project_metadata').all() as Array<{ key: string; value: string }>;
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  }
}
