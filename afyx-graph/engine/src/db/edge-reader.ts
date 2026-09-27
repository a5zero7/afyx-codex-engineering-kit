/**
 * Edge reads: outgoing/incoming from one node or from many at once, and fan-in/fan-out
 * counts. Direction and kind filtering are explicit at every call site — nothing here
 * infers one from the other.
 */

import type { Edge, EdgeKind } from '../types';
import { chunked, placeholders, QuerySession } from './query-session';
import { rowToEdge, type EdgeRow } from './row-mappers';

function kindFilter(kinds: readonly EdgeKind[] | undefined): string {
  return kinds && kinds.length > 0 ? ` AND kind IN (${placeholders(kinds.length)})` : '';
}

export class EdgeReader {
  constructor(private readonly session: QuerySession) {}

  /** Edges leaving `sourceId`, optionally narrowed by kind and/or provenance. */
  getOutgoingEdges(sourceId: string, kinds?: EdgeKind[], provenance?: string): Edge[] {
    if ((kinds && kinds.length > 0) || provenance) {
      let sql = 'SELECT * FROM edges WHERE source = ?';
      const params: (string | number)[] = [sourceId];
      if (kinds && kinds.length > 0) {
        sql += kindFilter(kinds);
        params.push(...kinds);
      }
      if (provenance) {
        sql += ' AND provenance = ?';
        params.push(provenance);
      }
      const rows = this.session.db.prepare(sql).all(...params) as EdgeRow[];
      return rows.map(rowToEdge);
    }
    const rows = this.session.statement('SELECT * FROM edges WHERE source = ?').all(sourceId) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  /** Edges entering `targetId`, optionally narrowed by kind. */
  getIncomingEdges(targetId: string, kinds?: EdgeKind[]): Edge[] {
    if (kinds && kinds.length > 0) {
      const rows = this.session.db.prepare(`SELECT * FROM edges WHERE target = ?${kindFilter(kinds)}`).all(targetId, ...kinds) as EdgeRow[];
      return rows.map(rowToEdge);
    }
    const rows = this.session.statement('SELECT * FROM edges WHERE target = ?').all(targetId) as EdgeRow[];
    return rows.map(rowToEdge);
  }

  /** Outgoing edges for many source nodes in one pass — the batch form of `getOutgoingEdges`, chunked under the parameter limit. */
  getOutgoingEdgesFrom(sourceIds: readonly string[], kinds?: EdgeKind[]): Edge[] {
    if (sourceIds.length === 0) return [];
    const out: Edge[] = [];
    for (const chunk of chunked([...new Set(sourceIds)])) {
      let sql = `SELECT * FROM edges WHERE source IN (${placeholders(chunk.length)})`;
      const params: string[] = [...chunk];
      if (kinds && kinds.length > 0) {
        sql += kindFilter(kinds);
        params.push(...kinds);
      }
      const rows = this.session.db.prepare(sql).all(...params) as EdgeRow[];
      for (const row of rows) out.push(rowToEdge(row));
    }
    return out;
  }

  /** Incoming edges for many target nodes in one pass — the mirror of `getOutgoingEdgesFrom`. */
  getIncomingEdgesTo(targetIds: readonly string[], kinds?: EdgeKind[]): Edge[] {
    if (targetIds.length === 0) return [];
    const out: Edge[] = [];
    for (const chunk of chunked([...new Set(targetIds)])) {
      let sql = `SELECT * FROM edges WHERE target IN (${placeholders(chunk.length)})`;
      const params: string[] = [...chunk];
      if (kinds && kinds.length > 0) {
        sql += kindFilter(kinds);
        params.push(...kinds);
      }
      const rows = this.session.db.prepare(sql).all(...params) as EdgeRow[];
      for (const row of rows) out.push(rowToEdge(row));
    }
    return out;
  }

  /** Total incoming-edge count for many nodes; an id with no incoming edges is absent from the map rather than present as 0. */
  countIncomingEdges(ids: readonly string[]): Map<string, number> {
    const out = new Map<string, number>();
    if (ids.length === 0) return out;
    for (const chunk of chunked([...new Set(ids)])) {
      const rows = this.session.db
        .prepare(`SELECT target, COUNT(*) AS count FROM edges WHERE target IN (${placeholders(chunk.length)}) GROUP BY target`)
        .all(...chunk) as Array<{ target: string; count: number }>;
      for (const row of rows) out.set(row.target, row.count);
    }
    return out;
  }

  /** Total outgoing-edge count for many nodes; the mirror of `countIncomingEdges`. */
  countOutgoingEdges(ids: readonly string[]): Map<string, number> {
    const out = new Map<string, number>();
    if (ids.length === 0) return out;
    for (const chunk of chunked([...new Set(ids)])) {
      const rows = this.session.db
        .prepare(`SELECT source, COUNT(*) AS count FROM edges WHERE source IN (${placeholders(chunk.length)}) GROUP BY source`)
        .all(...chunk) as Array<{ source: string; count: number }>;
      for (const row of rows) out.set(row.source, row.count);
    }
    return out;
  }

  /** Edges whose source and target are both in `nodeIds` — recovering inter-node connectivity after a traversal. */
  findEdgesBetweenNodes(nodeIds: string[], kinds?: EdgeKind[]): Edge[] {
    if (nodeIds.length === 0) return [];
    const idsJson = JSON.stringify(nodeIds);
    let sql = 'SELECT * FROM edges WHERE source IN (SELECT value FROM json_each(?)) AND target IN (SELECT value FROM json_each(?))';
    const params: string[] = [idsJson, idsJson];
    if (kinds && kinds.length > 0) {
      sql += kindFilter(kinds);
      params.push(...kinds);
    }
    const rows = this.session.db.prepare(sql).all(...params) as EdgeRow[];
    return rows.map(rowToEdge);
  }
}
