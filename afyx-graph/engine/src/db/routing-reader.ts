/**
 * Project-shape reads: the file that is the functional center of the call graph, the
 * file where routes concentrate, and the URL → handler manifest built from route edges.
 * Every one of these excludes low-value files (tests, generated code) from candidacy.
 */

import { isGeneratedFile } from '../extraction/generated-detection';
import type { FileReader } from './file-reader';
import type { QuerySession } from './query-session';

/**
 * Files that should not be candidates for "dominant file" / "top route file" detection:
 * test/spec files and tool-generated files. Generated files (`*.pb.go`, mock outputs, …)
 * often have huge in-file edge counts that dwarf the real source — etcd's `rpc.pb.go` has
 * 4× the in-file edges of `server.go`. Path patterns, plus (when the caller passes the
 * indexed set) files whose header declares them generated: a `payroll.go` full of
 * generated CRUD has the same edge-density problem and nothing in its name to catch it
 * (#1500).
 */
function isLowValueFile(filePath: string, generated?: ReadonlySet<string>): boolean {
  if (generated?.has(filePath)) return true;
  const lowered = filePath.toLowerCase();
  return (
    /(?:^|\/)(tests?|__tests?__|spec)\//.test(lowered) ||
    /_test\.go$/.test(lowered) ||
    /(?:^|\/)test_[^/]+\.py$/.test(lowered) ||
    /_test\.py$/.test(lowered) ||
    /_spec\.rb$/.test(lowered) ||
    /_test\.rb$/.test(lowered) ||
    /\.(test|spec)\.[jt]sx?$/.test(lowered) ||
    /(test|spec|tests)\.(java|kt|scala)$/.test(lowered) ||
    /(tests?|spec)\.cs$/.test(lowered) ||
    /tests?\.swift$/.test(lowered) ||
    /_test\.dart$/.test(lowered) ||
    isGeneratedFile(filePath)
  );
}

export class RoutingReader {
  constructor(
    private readonly session: QuerySession,
    private readonly files: FileReader
  ) {}

  /**
   * The file holding the densest concentration of the project's internal (same-file
   * source and target) call graph — the "core" file a context builder boosts ranking of.
   * Cross-file edges are excluded: they do not say which file is the functional center.
   * Returns null when nothing clears a 20-edge floor.
   */
  getDominantFile(): { filePath: string; edgeCount: number; nextEdgeCount: number } | null {
    // Top 20 candidates; test/generated files are filtered in code (regex-grade matching SQL LIKE can't express).
    const rows = this.session
      .statement(`
        SELECT n.file_path AS file_path, COUNT(*) AS edge_count
          FROM edges e JOIN nodes n ON e.source = n.id JOIN nodes m ON e.target = m.id
         WHERE n.file_path = m.file_path
      GROUP BY n.file_path
      ORDER BY edge_count DESC
         LIMIT 20
      `)
      .all() as Array<{ file_path: string; edge_count: number }>;
    const generated = this.files.getGeneratedPathsAmong(rows.map((row) => row.file_path));
    const filtered = rows.filter((row) => !isLowValueFile(row.file_path, generated));
    if (filtered.length === 0 || filtered[0]!.edge_count < 20) return null;
    return { filePath: filtered[0]!.file_path, edgeCount: filtered[0]!.edge_count, nextEdgeCount: filtered[1]?.edge_count ?? 0 };
  }

  /**
   * The file holding the densest concentration of the project's `route` nodes
   * (Express/Gin/Flask/Rails/Drupal/…). Returns null when there are fewer than 3
   * non-test routes total, or no file holds at least 30% of them (diffuse routing).
   */
  getTopRouteFile(): { filePath: string; routeCount: number; totalRoutes: number } | null {
    const rows = this.session
      .statement("SELECT file_path, COUNT(*) AS cnt FROM nodes WHERE kind = 'route' GROUP BY file_path ORDER BY cnt DESC LIMIT 20")
      .all() as Array<{ file_path: string; cnt: number }>;
    const generated = this.files.getGeneratedPathsAmong(rows.map((row) => row.file_path));
    const filtered = rows.filter((row) => !isLowValueFile(row.file_path, generated));
    if (filtered.length === 0) return null;
    const totalRoutes = filtered.reduce((sum, row) => sum + row.cnt, 0);
    const top = filtered[0]!;
    if (totalRoutes < 3 || top.cnt < 3 || top.cnt / totalRoutes < 0.3) return null;
    return { filePath: top.file_path, routeCount: top.cnt, totalRoutes };
  }

  /**
   * Build a URL → handler manifest: each route node's `references` (or, for Express,
   * `calls`) edge points at the function/method that handles the request. Also returns
   * the file with the most handler endpoints, so a caller can inline both the mapping
   * and the implementations. Returns null when fewer than 3 non-test/generated entries
   * survive.
   */
  getRoutingManifest(limit = 40): {
    entries: Array<{ url: string; handler: string; handlerFile: string; handlerLine: number; handlerKind: string; routeId: string; routeFile: string; routeLine: number }>;
    topHandlerFile: string | null;
    topHandlerFileCount: number;
    totalRoutes: number;
  } | null {
    const rows = this.session
      .statement(`
        SELECT r.name AS url, r.id AS route_id, r.file_path AS route_file, r.start_line AS route_line,
               h.name AS handler, h.file_path AS handler_file, h.start_line AS handler_line, h.kind AS handler_kind
          FROM nodes r
          JOIN edges e ON e.source = r.id
          JOIN nodes h ON e.target = h.id
         WHERE r.kind = 'route'
           AND e.kind IN ('references', 'calls')
           AND h.kind IN ('function', 'method', 'class', 'constant', 'variable')
      ORDER BY r.file_path, r.start_line
         LIMIT ?
      `)
      .all(limit) as Array<{ url: string; route_id: string; route_file: string; route_line: number; handler: string; handler_file: string; handler_line: number; handler_kind: string }>;

    const generated = this.files.getGeneratedPathsAmong(rows.map((row) => row.handler_file));
    const filtered = rows.filter((row) => !isLowValueFile(row.handler_file, generated));
    if (filtered.length < 3) return null;

    const fileCounts = new Map<string, number>();
    for (const row of filtered) fileCounts.set(row.handler_file, (fileCounts.get(row.handler_file) ?? 0) + 1);
    let topHandlerFile: string | null = null;
    let topHandlerFileCount = 0;
    for (const [file, count] of fileCounts) {
      if (count > topHandlerFileCount) {
        topHandlerFile = file;
        topHandlerFileCount = count;
      }
    }
    return {
      entries: filtered.map((row) => ({
        url: row.url, handler: row.handler, handlerFile: row.handler_file, handlerLine: row.handler_line, handlerKind: row.handler_kind,
        routeId: row.route_id, routeFile: row.route_file, routeLine: row.route_line,
      })),
      topHandlerFile,
      topHandlerFileCount,
      totalRoutes: filtered.length,
    };
  }
}
