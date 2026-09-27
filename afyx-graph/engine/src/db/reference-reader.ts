/**
 * Unresolved-reference reads: by name, by file, by source node, batched/keyset paging
 * for the resolution loop, and the retry/rebind lookups a sync uses after a file that
 * introduced or removed a definition changes.
 */

import type { Edge, Language, UnresolvedReference } from '../types';
import { chunked, placeholders, QuerySession } from './query-session';
import { rowToEdge, rowToUnresolvedRef, type EdgeRow, type UnresolvedRefRow } from './row-mappers';

export class ReferenceReader {
  constructor(private readonly session: QuerySession) {}

  getUnresolvedByName(name: string): UnresolvedReference[] {
    const rows = this.session.statement('SELECT * FROM unresolved_refs WHERE reference_name = ?').all(name) as UnresolvedRefRow[];
    return rows.map(rowToUnresolvedRef);
  }

  getUnresolvedReferences(): UnresolvedReference[] {
    const rows = this.session.db.prepare('SELECT * FROM unresolved_refs').all() as UnresolvedRefRow[];
    return rows.map(rowToUnresolvedRef);
  }

  /**
   * Count of PENDING (never-attempted) references, without loading them. Rows marked
   * `failed` — attempted by a completed pass, no match — are excluded: they are retry
   * candidates for the #1240 sweep, not outstanding work, so they must not trip the
   * #1187 orphan sweep or the `status` pending-refs warning.
   */
  getUnresolvedReferencesCount(): number {
    const row = this.session.statement("SELECT COUNT(*) as count FROM unresolved_refs WHERE status = 'pending'").get() as { count: number };
    return row.count;
  }

  /**
   * A page of PENDING references via LIMIT/OFFSET, ordered by rowid. The order is
   * load-bearing for the pipelined resolution loop: it prefetches batch k+1 at
   * `OFFSET batch_k.length` while batch k's rows are still pending, which is only exact
   * under a stable enumeration.
   */
  getUnresolvedReferencesBatch(offset: number, limit: number): UnresolvedReference[] {
    const rows = this.session.statement("SELECT * FROM unresolved_refs WHERE status = 'pending' ORDER BY rowid LIMIT ? OFFSET ?").all(limit, offset) as UnresolvedRefRow[];
    return rows.map(rowToUnresolvedRef);
  }

  /**
   * Keyset variant of `getUnresolvedReferencesBatch`: seeks past the last-seen row id
   * instead of OFFSET-walking, which re-scans the accumulated failed-row prefix on every
   * batch (O(failed rows) per read — 54.6s of a kernel-scale batch loop, §7a.2), while the
   * seek stays O(batch) forever. `id` is the rowid alias, so enumeration order matches the
   * OFFSET reader's. `prerequisites` splits the phase so import/extends/implements refs
   * commit before dependent calls, even when an interrupted sync queued rows out of order
   * (#1577); each phase's statement is cached under its own key so the three variants
   * never overwrite each other.
   */
  getUnresolvedReferencesBatchAfter(afterRowId: number, limit: number, prerequisites?: boolean): UnresolvedReference[] {
    const filter = prerequisites === undefined ? '' : ` AND reference_kind ${prerequisites ? 'IN' : 'NOT IN'} ('imports', 'extends', 'implements')`;
    const sql = `SELECT * FROM unresolved_refs WHERE status = 'pending' AND id > ?${filter} ORDER BY id LIMIT ?`;
    const rows = this.session.statement(sql).all(afterRowId, limit) as UnresolvedRefRow[];
    return rows.map(rowToUnresolvedRef);
  }

  /** Every unresolved reference recorded in one file, ordered by line — one indexed lookup whatever the file holds. `limit` bounds the answer, not the work; rows come back in line order, so a cap trims the end of the file. */
  getUnresolvedReferencesInFile(filePath: string, limit = 5000): UnresolvedReference[] {
    const rows = this.session.statement('SELECT * FROM unresolved_refs WHERE file_path = ? ORDER BY line, col LIMIT ?').all(filePath, limit) as UnresolvedRefRow[];
    return rows.map(rowToUnresolvedRef);
  }

  /** References recorded against a symbol that never resolved to a node (a third-party package, a runtime builtin). */
  getUnresolvedReferencesFrom(fromNodeId: string): UnresolvedReference[] {
    const rows = this.session.statement('SELECT * FROM unresolved_refs WHERE from_node_id = ?').all(fromNodeId) as UnresolvedRefRow[];
    return rows.map(rowToUnresolvedRef);
  }

  /** Unresolved references scoped to specific file paths (`idx_unresolved_file_path`), chunked under the parameter limit and appended with a loop — the result set is unbounded even though the input chunk is (#540, #1558). */
  getUnresolvedReferencesByFiles(filePaths: string[]): UnresolvedReference[] {
    if (filePaths.length === 0) return [];
    const rows: UnresolvedRefRow[] = [];
    for (const chunk of chunked(filePaths)) {
      const chunkRows = this.session.listStatement(`SELECT * FROM unresolved_refs WHERE status = 'pending' AND file_path IN (${placeholders(chunk.length)})`, chunk.length).all(...chunk) as UnresolvedRefRow[];
      for (const row of chunkRows) rows.push(row);
    }
    return rows.map(rowToUnresolvedRef);
  }

  /**
   * Which of `names` the index holds an unresolved reference to, matched loosely on the
   * reference name AND its tail (`util.greet` → `greet`) — a maybe has to count as a yes
   * when the question is "could this be the name we failed to follow".
   */
  getUnresolvedNamesAmong(names: Iterable<string>): Set<string> {
    const unique = [...new Set(names)].filter((name) => name.length > 0);
    const found = new Set<string>();
    if (unique.length === 0) return found;
    for (const chunk of chunked(unique)) {
      const rows = this.session.db
        .prepare(`
          SELECT DISTINCT reference_name AS name FROM unresolved_refs WHERE reference_name IN (${placeholders(chunk.length)})
          UNION
          SELECT DISTINCT name_tail AS name FROM unresolved_refs WHERE name_tail IN (${placeholders(chunk.length)})
        `)
        .all(...chunk, ...chunk) as Array<{ name: string }>;
      for (const row of rows) found.add(row.name);
    }
    return found;
  }

  /**
   * Failed refs whose name tail matches one of the given symbol names — the retry
   * candidates after files carrying those names changed (#1240). A name matching more
   * than `perNameCeiling` failed refs is skipped entirely: at that population it is
   * external/builtin noise (`get`, `map`, …) that one new definition will not resolve.
   */
  getRetryableFailedReferences(names: string[], perNameCeiling = 500): UnresolvedReference[] {
    if (names.length === 0) return [];

    const retryNames: string[] = [];
    for (const chunk of chunked(names)) {
      const counts = this.session.db
        .prepare(`SELECT name_tail, COUNT(*) as count FROM unresolved_refs WHERE status = 'failed' AND name_tail IN (${placeholders(chunk.length)}) GROUP BY name_tail`)
        .all(...chunk) as Array<{ name_tail: string; count: number }>;
      for (const row of counts) if (row.count <= perNameCeiling) retryNames.push(row.name_tail);
    }
    if (retryNames.length === 0) return [];

    const rows: UnresolvedRefRow[] = [];
    for (const chunk of chunked(retryNames)) {
      const chunkRows = this.session.db
        .prepare(`SELECT * FROM unresolved_refs WHERE status = 'failed' AND name_tail IN (${placeholders(chunk.length)})`)
        .all(...chunk) as UnresolvedRefRow[];
      for (const row of chunkRows) rows.push(row);
    }
    return rows.map(rowToUnresolvedRef);
  }

  /**
   * Resolution edges whose target symbol is named one of `names` — the edges a sync must
   * re-resolve after `names` gained or lost a definition (CG-33). Resolution binds a
   * reference to a node whose name matches the reference's tail, picking among ALL
   * same-named definitions project-wide, so one definition changing anywhere can change
   * the answer for every matching reference in the repo. Excludes synthesized
   * (`provenance='heuristic'`) edges: they carry no reference name to resurrect from, so
   * deleting one would be a permanent loss. Names matching more than `perNameCeiling`
   * edges are skipped, same rationale as `getRetryableFailedReferences`.
   */
  getResolutionEdgesByTargetName(
    names: string[],
    perNameCeiling = 500
  ): Array<Edge & { edgeId: number; sourceFilePath: string; sourceLanguage: Language }> {
    if (names.length === 0) return [];

    const keep: string[] = [];
    for (const chunk of chunked(names)) {
      const counts = this.session.db
        .prepare(`
          SELECT tgt.name AS name, COUNT(*) AS count
            FROM edges e JOIN nodes tgt ON tgt.id = e.target
           WHERE tgt.name IN (${placeholders(chunk.length)})
             AND (e.provenance IS NULL OR e.provenance != 'heuristic')
        GROUP BY tgt.name`)
        .all(...chunk) as Array<{ name: string; count: number }>;
      for (const row of counts) if (row.count <= perNameCeiling) keep.push(row.name);
    }
    if (keep.length === 0) return [];

    const out: Array<Edge & { edgeId: number; sourceFilePath: string; sourceLanguage: Language }> = [];
    for (const chunk of chunked(keep)) {
      const rows = this.session.db
        .prepare(`
          SELECT e.*, src.file_path AS source_file_path, src.language AS source_language
            FROM edges e
            JOIN nodes tgt ON tgt.id = e.target
            JOIN nodes src ON src.id = e.source
           WHERE tgt.name IN (${placeholders(chunk.length)})
             AND (e.provenance IS NULL OR e.provenance != 'heuristic')`)
        .all(...chunk) as Array<EdgeRow & { source_file_path: string; source_language: Language }>;
      for (const row of rows) {
        out.push({ ...rowToEdge(row), edgeId: row.id, sourceFilePath: row.source_file_path, sourceLanguage: row.source_language });
      }
    }
    return out;
  }
}
