/**
 * File reads: tracked-file records, path listings, staleness, and the generated /
 * ambient-declaration flags other readers use to exclude low-value files from ranking.
 */

import type { FileRecord, Node } from '../types';
import { isGeneratedFile } from '../extraction/generated-detection';
import { chunked, placeholders, QuerySession } from './query-session';
import { rowToFileRecord, rowToNode, type FileRow, type NodeRow } from './row-mappers';

/**
 * A SQL predicate: is the node aliased `alias` a member an INTERFACE declares?
 *
 * `method_signature` / `property_signature` enter the graph as `method` / `property`
 * nodes hung off their interface by a `contains` edge (#1638). They have no body and
 * originate no behaviour, so for a structural judgement about a FILE they are the
 * interface restated, not an extra thing the file declares — see
 * `getAmbientDeclarationPathsAmong`, the one caller, for why treating them as opaque
 * would break that rule in three places at once.
 *
 * Seeks `idx_edges_target_kind`, so it costs a key lookup per row rather than a join
 * over the whole edge table.
 */
const isInterfaceMember = (alias: string): string => `EXISTS (
  SELECT 1 FROM edges ce JOIN nodes owner ON owner.id = ce.source
   WHERE ce.target = ${alias}.id AND ce.kind = 'contains' AND owner.kind = 'interface'
)`;

export class FileReader {
  constructor(private readonly session: QuerySession) {}

  getFileByPath(filePath: string): FileRecord | null {
    const row = this.session.statement('SELECT * FROM files WHERE path = ?').get(filePath) as FileRow | undefined;
    return row ? rowToFileRecord(row) : null;
  }

  getAllFiles(): FileRecord[] {
    const rows = this.session.statement('SELECT * FROM files ORDER BY path').all() as FileRow[];
    return rows.map(rowToFileRecord);
  }

  getAllFilePaths(): string[] {
    const rows = this.session.statement('SELECT path FROM files ORDER BY path').all() as Array<{ path: string }>;
    return rows.map((row) => row.path);
  }

  /** The `file` nodes for the given paths, in one query — a file's own node without materializing every symbol in it. */
  getFileNodes(filePaths: string[]): Node[] {
    if (filePaths.length === 0) return [];
    const rows = this.session.db
      .prepare("SELECT * FROM nodes WHERE kind = 'file' AND file_path IN (SELECT value FROM json_each(?))")
      .all(JSON.stringify(filePaths)) as NodeRow[];
    return rows.map(rowToNode);
  }

  /** Most recent index timestamp across all tracked files, or null when nothing is indexed yet (#329). */
  getLastIndexedAt(): number | null {
    const row = this.session.db.prepare('SELECT MAX(indexed_at) AS last FROM files').get() as { last: number | null } | undefined;
    return row?.last ?? null;
  }

  /**
   * The index's revision marker: how far the last sync got, and how many files it left
   * behind. `MAX(indexed_at)` alone is not enough — a sync that only deletes files
   * (a branch checkout that removed a directory) advances nothing, yet the graph has
   * changed; the row count catches exactly that case.
   */
  getIndexRevision(): { lastIndexedAt: number | null; fileCount: number } {
    const row = this.session.db.prepare('SELECT MAX(indexed_at) AS last, COUNT(*) AS files FROM files').get() as { last: number | null; files: number } | undefined;
    return { lastIndexedAt: row?.last ?? null, fileCount: row?.files ?? 0 };
  }

  /** Files re-indexed strictly after `since`, newest first; `total` is the real count, `paths` is capped at `limit`. */
  getFilesIndexedSince(since: number, limit: number): { paths: string[]; total: number } {
    const count = this.session.db.prepare('SELECT COUNT(*) AS n FROM files WHERE indexed_at > ?').get(since) as { n: number } | undefined;
    const rows = this.session.db
      .prepare('SELECT path FROM files WHERE indexed_at > ? ORDER BY indexed_at DESC, path LIMIT ?')
      .all(since, Math.max(0, limit)) as Array<{ path: string }>;
    return { paths: rows.map((row) => row.path), total: count?.n ?? rows.length };
  }

  /** Files whose current content hash no longer matches what is stored. */
  getStaleFiles(currentHashes: Map<string, string>): FileRecord[] {
    return this.getAllFiles().filter((file) => {
      const currentHash = currentHashes.get(file.path);
      return currentHash !== undefined && currentHash !== file.contentHash;
    });
  }

  /**
   * Which of `filePaths` the index flagged as tool-generated (schema v9+). A bounded probe
   * over a candidate list, never a whole-repo scan. Returns only the content/index signal;
   * callers union it with `isGeneratedFile` so a pre-v9 database (column present, all zeros
   * until a re-index) keeps the path-only verdict instead of regressing.
   */
  getGeneratedPathsAmong(filePaths: Iterable<string>): Set<string> {
    const unique = [...new Set(filePaths)];
    const found = new Set<string>();
    if (unique.length === 0) return found;
    for (const chunk of chunked(unique)) {
      const rows = this.session.db.prepare(`SELECT path FROM files WHERE generated = 1 AND path IN (${placeholders(chunk.length)})`).all(...chunk) as Array<{ path: string }>;
      for (const row of rows) found.add(row.path);
    }
    return found;
  }

  /** A reusable `(path) => boolean` unioning the indexed flag with the path convention — one query up front, O(1) per comparison. */
  generatedPredicateFor(filePaths: Iterable<string>): (filePath: string) => boolean {
    const flagged = this.getGeneratedPathsAmong(filePaths);
    return (filePath: string) => flagged.has(filePath) || isGeneratedFile(filePath);
  }

  /**
   * Which of `filePaths` are AMBIENT DECLARATION files (CG-28): they declare nothing but
   * types, and nothing in the index depends on them. Four conditions must all hold: the
   * file declares at least one symbol; every declared symbol is a type-level kind
   * (interface / type alias / enum / namespace); no symbol in it originates a
   * `calls`/`instantiates` edge; and nothing else in the index points at it. Interface
   * members are transparent to all four — a signature has no body, so it neither
   * qualifies, disqualifies, nor counts as inbound dependency (see `isInterfaceMember`).
   * Bounded-lookup like `getGeneratedPathsAmong`.
   */
  getAmbientDeclarationPathsAmong(filePaths: Iterable<string>): Set<string> {
    const unique = [...new Set(filePaths)];
    const found = new Set<string>();
    if (unique.length === 0) return found;

    for (const chunk of chunked(unique)) {
      const rows = this.session.db
        .prepare(`
          SELECT n.file_path AS file_path,
                 SUM(CASE WHEN n.kind NOT IN ('file','import','export','parameter')
                           AND NOT ${isInterfaceMember('n')}
                          THEN 1 ELSE 0 END) AS declared,
                 SUM(CASE WHEN n.kind IN ('interface','type_alias','enum','enum_member','namespace')
                          THEN 1 ELSE 0 END) AS typeDeclared
          FROM nodes n
          WHERE n.file_path IN (${placeholders(chunk.length)})
          GROUP BY n.file_path
        `)
        .all(...chunk) as Array<{ file_path: string; declared: number; typeDeclared: number }>;
      let candidates = rows.filter((row) => row.declared > 0 && row.declared === row.typeDeclared).map((row) => row.file_path);
      if (candidates.length === 0) continue;

      const disqualify = (sql: string): void => {
        if (candidates.length === 0) return;
        const hit = new Set(
          (this.session.db.prepare(sql.replace('$IN$', placeholders(candidates.length))).all(...candidates) as Array<{ file_path: string }>).map((row) => row.file_path)
        );
        candidates = candidates.filter((path) => !hit.has(path));
      };
      disqualify(`
        SELECT DISTINCT n.file_path AS file_path
        FROM edges e JOIN nodes n ON n.id = e.source
        WHERE e.kind IN ('calls','instantiates') AND n.file_path IN ($IN$)
          AND NOT ${isInterfaceMember('n')}
      `);
      disqualify(`
        SELECT DISTINCT t.file_path AS file_path
        FROM edges e JOIN nodes t ON t.id = e.target JOIN nodes s ON s.id = e.source
        WHERE t.file_path IN ($IN$) AND s.file_path <> t.file_path
          AND NOT ${isInterfaceMember('t')}
      `);
      for (const path of candidates) found.add(path);
    }
    return found;
  }

  /** A reusable `(path) => boolean` ambient-declaration test over a bounded candidate list. */
  ambientDeclarationPredicateFor(filePaths: Iterable<string>): (filePath: string) => boolean {
    const flagged = this.getAmbientDeclarationPathsAmong(filePaths);
    return (filePath: string) => flagged.has(filePath);
  }

  /** How many indexed files carry the generated flag — surfaced by `status`. */
  countGeneratedFiles(): number {
    const row = this.session.db.prepare('SELECT COUNT(*) AS n FROM files WHERE generated = 1').get() as { n: number } | undefined;
    return row?.n ?? 0;
  }
}
