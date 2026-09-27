/**
 * File-level and blast-radius dependency reads: what depends on what, fan-in/fan-out
 * aggregates, cross-file dependency pairs (cycle-finder input), and the module-graph
 * rollup. Everywhere here, "depends on" means any edge kind except `contains` — a
 * container containing a member is structure, not a dependency.
 */

import type { Edge, EdgeKind, Language, Node, NodeKind } from '../types';
import { chunked, placeholders, QuerySession } from './query-session';
import { rowToEdge, rowToNode, type EdgeRow, type NodeRow } from './row-mappers';

interface ModuleGroupRow {
  source: string;
  target: string;
  kind: EdgeKind;
  from: string;
  to: string;
  count: number;
  declared: number;
  uncertain: number;
}
interface ModuleLinkTotal { source: string; target: string; kind: EdgeKind; count: number; declared: number; uncertain: number }
interface ModulePairTotal { source: string; target: string; from: string; to: string; count: number; declared: number }

/**
 * Turn the module aggregation's one result set into its two answers.
 *
 * The query groups by module pair AND kind AND symbol names, because the join is what
 * costs and a finer grouping rides along free. That leaves two folds: counts per
 * (module, module, kind) for the map's link weights, and the busiest symbol pairs per
 * link for its tooltip. Pairs are ranked `declared` first and only then by raw count, so
 * a link's tooltip names the symbols the source actually points at rather than whichever
 * `has`/`get`/`run` happened to name-match most often; only `pairKinds` are eligible.
 */
function foldModuleRows(
  rows: readonly ModuleGroupRow[],
  options: { topPairsPerLink: number; pairKinds: readonly EdgeKind[] }
): { links: ModuleLinkTotal[]; pairs: ModulePairTotal[] } {
  // A module id is a path and may contain anything printable, so the key separator has
  // to be something a path cannot hold.
  const SEP = '\u0000';
  const links = new Map<string, ModuleLinkTotal>();
  const pairKinds = new Set(options.pairKinds);
  const wantPairs = options.topPairsPerLink > 0 && pairKinds.size > 0;
  const pairTotals = new Map<string, ModulePairTotal>();

  for (const row of rows) {
    const linkKey = `${row.source}${SEP}${row.target}${SEP}${row.kind}`;
    const link = links.get(linkKey);
    if (link) {
      link.count += row.count;
      link.declared += row.declared;
      link.uncertain += row.uncertain;
    } else {
      links.set(linkKey, { source: row.source, target: row.target, kind: row.kind, count: row.count, declared: row.declared, uncertain: row.uncertain });
    }
    // Only the confident half of a row can be named: an uncertain edge is a guess.
    if (!wantPairs || row.count === 0 || !pairKinds.has(row.kind)) continue;
    const pairKey = `${row.source}${SEP}${row.target}${SEP}${row.from}${SEP}${row.to}`;
    const pair = pairTotals.get(pairKey);
    if (pair) {
      pair.count += row.count;
      pair.declared += row.declared;
    } else {
      pairTotals.set(pairKey, { source: row.source, target: row.target, from: row.from, to: row.to, count: row.count, declared: row.declared });
    }
  }

  const byLink = new Map<string, ModulePairTotal[]>();
  for (const pair of pairTotals.values()) {
    const key = `${pair.source}${SEP}${pair.target}`;
    const list = byLink.get(key);
    if (list) list.push(pair);
    else byLink.set(key, [pair]);
  }
  const pairs: ModulePairTotal[] = [];
  for (const list of byLink.values()) {
    list.sort((a, b) => b.declared - a.declared || b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    for (const pair of list.slice(0, options.topPairsPerLink)) pairs.push(pair);
  }
  return { links: [...links.values()], pairs };
}

export class DependencyReader {
  constructor(private readonly session: QuerySession) {}

  /**
   * Symbols nothing in the index points at — the candidate set behind the dead-code list.
   * One `NOT EXISTS` scan over `idx_edges_target_kind`, never a `LEFT JOIN … GROUP BY`
   * (which builds a row per edge for the whole table before discarding all but the empty
   * groups). A self-edge is excluded, the same reason a recursive function is not its own
   * caller. Ordered by position, so the answer is stable across runs.
   */
  getUnreferencedNodes(kinds: readonly string[], limit: number): Array<{ node: Node; generated: boolean }> {
    if (kinds.length === 0 || limit <= 0) return [];
    const rows = this.session.db
      .prepare(`
        SELECT n.*, COALESCE(f.generated, 0) AS file_generated
          FROM nodes n
          LEFT JOIN files f ON f.path = n.file_path
         WHERE n.kind IN (${placeholders(kinds.length)})
           AND NOT EXISTS (
                 SELECT 1 FROM edges e
                  WHERE e.target = n.id AND e.kind != 'contains' AND e.source != n.id
               )
      ORDER BY n.file_path, n.start_line, n.name
         LIMIT ?
      `)
      .all(...kinds, limit) as Array<NodeRow & { file_generated: number }>;
    return rows.map((row) => ({ node: rowToNode(row), generated: row.file_generated === 1 }));
  }

  /**
   * Which of `names` are carried by MORE THAN ONE symbol, at least one of which something
   * points at. The false positive this kills: a self-resolution attaches an edge to one
   * twin, leaving the other with nothing, and from the edge table alone that mis-resolution
   * and a genuinely unused twin look identical — so neither name is claimed as dead.
   * Self-edges count as evidence the name resolves somewhere, since they are the very
   * fingerprint of that mis-resolution.
   */
  getAmbiguousReferencedNames(names: Iterable<string>): Set<string> {
    const unique = [...new Set(names)].filter((name) => name.length > 0);
    const found = new Set<string>();
    if (unique.length === 0) return found;
    for (const chunk of chunked(unique)) {
      const rows = this.session.db
        .prepare(`
          SELECT name FROM (
            SELECT n.name AS name,
                   EXISTS (SELECT 1 FROM edges e WHERE e.target = n.id AND e.kind != 'contains') AS referenced
              FROM nodes n
             WHERE n.name IN (${placeholders(chunk.length)})
          )
          GROUP BY name
            HAVING COUNT(*) > 1 AND SUM(referenced) > 0
        `)
        .all(...chunk) as Array<{ name: string }>;
      for (const row of rows) found.add(row.name);
    }
    return found;
  }

  /** Which of the given languages the index records an export marker for — the honest basis for the dead-code report's "may be reached from outside" filter. */
  getLanguagesWithExports(languages: Iterable<string>): Set<string> {
    const unique = [...new Set(languages)].filter((language) => language.length > 0);
    const found = new Set<string>();
    if (unique.length === 0) return found;
    for (const chunk of chunked(unique)) {
      const rows = this.session.db
        .prepare(`SELECT language, MAX(is_exported) AS any_exported FROM nodes WHERE language IN (${placeholders(chunk.length)}) GROUP BY language`)
        .all(...chunk) as Array<{ language: string; any_exported: number }>;
      for (const row of rows) if (row.any_exported === 1) found.add(row.language);
    }
    return found;
  }

  /** The nodes with the most DISTINCT dependents, most first — the symbols a change actually radiates furthest from. */
  getTopDependedOn(limit: number): Array<{ nodeId: string; dependents: number }> {
    if (limit <= 0) return [];
    return this.session.db
      .prepare(`
        SELECT target AS nodeId, COUNT(DISTINCT source) AS dependents
          FROM edges
         WHERE kind != 'contains' AND source != target
      GROUP BY target
      ORDER BY dependents DESC
         LIMIT ?
      `)
      .all(limit) as Array<{ nodeId: string; dependents: number }>;
  }

  /**
   * The graph's executable roots — files that run something at module level, ranked by
   * how much of the project they set in motion. Ranking multiplies what an entry point
   * does: it runs (calls/instantiates) and it wires the project together (distinct other
   * files its symbols reach) — one alone is misleading (a registration table calls only
   * itself; a barrel file imports everything and runs nothing).
   */
  getTopCallingFiles(limit: number): Array<{ nodeId: string; filePath: string; calls: number; reaches: number; score: number }> {
    if (limit <= 0) return [];
    return this.session.db
      .prepare(`
        WITH tops AS (
             SELECT n.id AS file_id, n.id AS src FROM nodes n WHERE n.kind = 'file'
             UNION ALL
             SELECT c.source AS file_id, c.target AS src
               FROM edges c JOIN nodes f ON f.id = c.source JOIN nodes v ON v.id = c.target
              WHERE c.kind = 'contains' AND f.kind = 'file' AND v.kind IN ('variable', 'constant')
        ),
        runs AS (
             SELECT t.file_id AS id, COUNT(*) AS calls
               FROM tops t JOIN edges e ON e.source = t.src
              WHERE e.kind IN ('calls', 'instantiates')
           GROUP BY t.file_id
        ),
        cand AS (SELECT r.id AS id, n.file_path AS fp, r.calls AS calls FROM runs r JOIN nodes n ON n.id = r.id),
        wires AS (
             SELECT sn.file_path AS fp, COUNT(DISTINCT tn.file_path) AS reaches
               FROM edges e JOIN nodes sn ON sn.id = e.source JOIN nodes tn ON tn.id = e.target
              WHERE e.kind != 'contains' AND sn.file_path <> tn.file_path AND sn.file_path IN (SELECT fp FROM cand)
           GROUP BY sn.file_path
        )
        SELECT c.id AS nodeId, c.fp AS filePath, c.calls AS calls, COALESCE(w.reaches, 0) AS reaches,
               c.calls * (1 + COALESCE(w.reaches, 0)) AS score
          FROM cand c LEFT JOIN wires w ON w.fp = c.fp
      ORDER BY score DESC, calls DESC, filePath
         LIMIT ?
      `)
      .all(limit) as Array<{ nodeId: string; filePath: string; calls: number; reaches: number; score: number }>;
  }

  /** How many OTHER files depend on each of the given files, counted through their symbols (a file node almost never receives an edge directly). */
  getFileDependentCounts(filePaths: string[]): Array<{ filePath: string; dependents: number }> {
    if (filePaths.length === 0) return [];
    return this.session.db
      .prepare(`
        SELECT tn.file_path AS filePath, COUNT(DISTINCT sn.file_path) AS dependents
          FROM edges e JOIN nodes tn ON tn.id = e.target JOIN nodes sn ON sn.id = e.source
         WHERE e.kind != 'contains'
           AND tn.file_path IN (SELECT value FROM json_each(?))
           AND sn.file_path != tn.file_path
      GROUP BY tn.file_path
      `)
      .all(JSON.stringify(filePaths)) as Array<{ filePath: string; dependents: number }>;
  }

  /** How far each of the given files reaches out — the mirror of `getFileDependentCounts`, driven from `nodes` so the cost is proportional to the files asked about. */
  getFileReachCounts(filePaths: string[]): Array<{ filePath: string; reaches: number; refs: number }> {
    if (filePaths.length === 0) return [];
    return this.session.db
      .prepare(`
        SELECT sn.file_path AS filePath, COUNT(DISTINCT tn.file_path) AS reaches, COUNT(*) AS refs
          FROM nodes sn JOIN edges e ON e.source = sn.id JOIN nodes tn ON tn.id = e.target
         WHERE sn.file_path IN (SELECT value FROM json_each(?))
           AND e.kind != 'contains'
           AND tn.file_path != sn.file_path
      GROUP BY sn.file_path
      `)
      .all(JSON.stringify(filePaths)) as Array<{ filePath: string; reaches: number; refs: number }>;
  }

  /**
   * Roll the whole edge table up to module granularity in one pass. The caller decides
   * what a module IS (naming is policy); grouping a million edges by it is mechanics that
   * belongs in SQLite. The assignment lands in an indexed temp table so the join stays
   * bounded by modules², and `declared` marks the subset of a link's edges that came from
   * something the source writes down (an import, a qualified name, an inheritance clause,
   * a call through a typed receiver) rather than a bare name match, which would invent
   * cross-module links out of common method names.
   */
  aggregateModuleGraph(
    assignments: ReadonlyArray<{ filePath: string; module: string }>,
    options: { kinds: readonly EdgeKind[]; minConfidence: number; topPairsPerLink: number; pairKinds: readonly EdgeKind[] }
  ): { links: ModuleLinkTotal[]; pairs: ModulePairTotal[] } {
    if (assignments.length === 0 || options.kinds.length === 0) return { links: [], pairs: [] };

    const CONFIDENCE = `COALESCE(json_extract(e.metadata, '$.confidence'), 1)`;
    const DECLARED = `(json_extract(e.metadata, '$.resolvedBy') IN ('import', 'qualified-name')
                       OR e.kind IN ('extends', 'implements')
                       OR (json_extract(e.metadata, '$.resolvedBy') = 'instance-method'
                           AND ${CONFIDENCE} >= 0.9))`;

    const db = this.session.db;
    db.exec('DROP TABLE IF EXISTS temp.cg_module_map');
    db.exec('CREATE TEMP TABLE cg_module_map (path TEXT PRIMARY KEY, mod TEXT NOT NULL)');
    try {
      const insert = db.prepare('INSERT OR REPLACE INTO cg_module_map (path, mod) VALUES (?, ?)');
      db.exec('BEGIN');
      try {
        for (const row of assignments) insert.run(row.filePath, row.module);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }

      // One pass over the edge table: grouping by symbol names as well as modules costs
      // nothing extra in scan time (the join is what is expensive), and it buys both
      // results from a single scan.
      const rows = db
        .prepare(`
          SELECT ms.mod AS source, mt.mod AS target, e.kind AS kind,
                 sn.name AS "from", tn.name AS "to",
                 SUM(CASE WHEN ${CONFIDENCE} >= ? THEN 1 ELSE 0 END) AS count,
                 SUM(CASE WHEN ${CONFIDENCE} >= ? AND ${DECLARED} THEN 1 ELSE 0 END) AS declared,
                 SUM(CASE WHEN ${CONFIDENCE} <  ? THEN 1 ELSE 0 END) AS uncertain
            FROM edges e
            JOIN nodes sn ON sn.id = e.source
            JOIN nodes tn ON tn.id = e.target
            JOIN cg_module_map ms ON ms.path = sn.file_path
            JOIN cg_module_map mt ON mt.path = tn.file_path
           WHERE e.kind IN (SELECT value FROM json_each(?))
             AND ms.mod <> mt.mod
        GROUP BY ms.mod, mt.mod, e.kind, sn.name, tn.name
        `)
        .all(options.minConfidence, options.minConfidence, options.minConfidence, JSON.stringify(options.kinds)) as ModuleGroupRow[];

      return foldModuleRows(rows, options);
    } finally {
      db.exec('DROP TABLE IF EXISTS temp.cg_module_map');
    }
  }

  /** Every ordered pair of files where one reaches into the other, once each — the input a cycle finder wants. Low-confidence name matches are excluded: a cycle conjured by a common method name is a false alarm a reader cannot check. */
  getCrossFileDependencyPairs(minConfidence: number): Array<{ source: string; target: string }> {
    return this.session.db
      .prepare(`
        SELECT DISTINCT sn.file_path AS source, tn.file_path AS target
          FROM edges e JOIN nodes sn ON sn.id = e.source JOIN nodes tn ON tn.id = e.target
         WHERE e.kind <> 'contains'
           AND sn.file_path <> tn.file_path
           AND COALESCE(json_extract(e.metadata, '$.confidence'), 1) >= ?
      `)
      .all(minConfidence) as Array<{ source: string; target: string }>;
  }

  /** Distinct file paths that DEPEND ON `filePath` — the file-level projection of the symbol dependency graph, and the basis for blast-radius / `affected` test selection. Not restricted to `imports` edges: those connect a file to its own local import declarations (always same-file), so the real cross-file signal is the resolved call/reference graph. */
  getDependentFilePaths(filePath: string): string[] {
    const rows = this.session.db
      .prepare(`
        SELECT DISTINCT src.file_path AS fp
          FROM edges e JOIN nodes tgt ON tgt.id = e.target JOIN nodes src ON src.id = e.source
         WHERE tgt.file_path = ? AND e.kind != 'contains' AND src.file_path != ?
      `)
      .all(filePath, filePath) as Array<{ fp: string }>;
    return rows.map((row) => row.fp);
  }

  /** Distinct file paths that `filePath` DEPENDS ON — the inverse of `getDependentFilePaths`, same edge-kind rules. */
  getDependencyFilePaths(filePath: string): string[] {
    const rows = this.session.db
      .prepare(`
        SELECT DISTINCT tgt.file_path AS fp
          FROM edges e JOIN nodes src ON src.id = e.source JOIN nodes tgt ON tgt.id = e.target
         WHERE src.file_path = ? AND e.kind != 'contains' AND tgt.file_path != ?
      `)
      .all(filePath, filePath) as Array<{ fp: string }>;
    return rows.map((row) => row.fp);
  }

  /**
   * Cross-file edges whose target is a node in `filePath` and whose source is in a
   * different file, paired with the target's (name, kind) so a caller can re-resolve the
   * edge to the re-indexed target's new id (node ids embed the file's line numbers, so any
   * line shift changes them and a naive re-insert by old id silently drops incoming edges,
   * #899). Same edge-kind rules as `getDependentFilePaths`.
   */
  getCrossFileIncomingEdgesWithTarget(filePath: string): Array<Edge & { targetName: string; targetKind: NodeKind; sourceFilePath: string; sourceLanguage: Language }> {
    const rows = this.session.db
      .prepare(`
        SELECT e.*, tgt.name AS target_name, tgt.kind AS target_kind, src.file_path AS source_file_path, src.language AS source_language
          FROM edges e JOIN nodes tgt ON tgt.id = e.target JOIN nodes src ON src.id = e.source
         WHERE tgt.file_path = ? AND e.kind != 'contains' AND src.file_path != ?
      `)
      .all(filePath, filePath) as Array<EdgeRow & { target_name: string; target_kind: NodeKind; source_file_path: string; source_language: Language }>;
    return rows.map((row) => ({ ...rowToEdge(row), targetName: row.target_name, targetKind: row.target_kind, sourceFilePath: row.source_file_path, sourceLanguage: row.source_language }));
  }
}
