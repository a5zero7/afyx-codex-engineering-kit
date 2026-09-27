/**
 * Node identity and lookup reads: by id, by file, by kind, by name (exact, prefix,
 * qualified, case-folded), and the small full-graph name scans other readers build on.
 *
 * Owns the LRU node cache. A write that changes or removes a node calls `forgetNode` /
 * `forgetByFile` / `forgetAll` (wired from `GraphWriter`'s cache hooks), so a cached row
 * can never outlive the write that replaced it.
 */

import type { Language, Node, NodeKind } from '../types';
import { chunked, placeholders, QuerySession } from './query-session';
import { rowToNode, type NodeRow } from './row-mappers';

const MAX_CACHE_SIZE = 1000;

export class NodeReader {
  private readonly cache = new Map<string, Node>();

  constructor(private readonly session: QuerySession) {}

  private cacheNode(node: Node): void {
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(node.id, node);
  }

  /** Drop one cached node — called when a write changes or removes it. */
  forgetNode(id: string): void {
    this.cache.delete(id);
  }

  /** Drop every cached node belonging to a file — called when a write replaces the file's rows. */
  forgetByFile(filePath: string): void {
    for (const [id, node] of this.cache) {
      if (node.filePath === filePath) this.cache.delete(id);
    }
  }

  /** Empty the cache entirely. */
  clearCache(): void {
    this.cache.clear();
  }

  getNodeById(id: string): Node | null {
    const cached = this.cache.get(id);
    if (cached !== undefined) {
      // LRU touch: delete and re-add so it becomes the newest entry.
      this.cache.delete(id);
      this.cache.set(id, cached);
      return cached;
    }
    const row = this.session.statement('SELECT * FROM nodes WHERE id = ?').get(id) as NodeRow | undefined;
    if (!row) return null;
    const node = rowToNode(row);
    this.cacheNode(node);
    return node;
  }

  /**
   * Batch lookup: cache hits are served from memory, misses go out as chunked `IN (...)`
   * reads. Returns a map keyed by id, in no particular order — callers restore their own
   * ordering (typically the order edges were returned from the graph); ids with no
   * stored node are simply absent.
   */
  getNodesByIds(ids: readonly string[]): Map<string, Node> {
    const found = new Map<string, Node>();
    if (ids.length === 0) return found;

    const misses: string[] = [];
    for (const id of ids) {
      const cached = this.cache.get(id);
      if (cached !== undefined) {
        this.cache.delete(id);
        this.cache.set(id, cached);
        found.set(id, cached);
      } else {
        misses.push(id);
      }
    }
    if (misses.length === 0) return found;

    for (const chunk of chunked(misses)) {
      const rows = this.session.listStatement(`SELECT * FROM nodes WHERE id IN (${placeholders(chunk.length)})`, chunk.length).all(...chunk) as NodeRow[];
      for (const row of rows) {
        const node = rowToNode(row);
        found.set(node.id, node);
        this.cacheNode(node);
      }
    }
    return found;
  }

  /** Every node in a file, in source order. */
  getNodesByFile(filePath: string): Node[] {
    const rows = this.session.statement('SELECT * FROM nodes WHERE file_path = ? ORDER BY start_line').all(filePath) as NodeRow[];
    return rows.map(rowToNode);
  }

  getNodesByKind(kind: NodeKind): Node[] {
    const rows = this.session.statement('SELECT * FROM nodes WHERE kind = ?').all(kind) as NodeRow[];
    return rows.map(rowToNode);
  }

  /**
   * Stream every node of a kind instead of materializing them all (`getNodesByKind`): on a
   * symbol-dense project the full array of `function`/`method` nodes is gigabytes, and the
   * dynamic-edge synthesizers only scan-and-filter, so memory stays O(1) in the node count
   * (#610). Fresh statement per call — an iterator holds an open cursor, which a shared,
   * cached statement cannot serve across overlapping scans.
   */
  *iterateNodesByKind(kind: NodeKind): IterableIterator<Node> {
    const statement = this.session.db.prepare('SELECT * FROM nodes WHERE kind = ?');
    for (const row of statement.iterate(kind)) yield rowToNode(row as NodeRow);
  }

  getAllNodes(): Node[] {
    const rows = this.session.db.prepare('SELECT * FROM nodes').all() as NodeRow[];
    return rows.map(rowToNode);
  }

  /**
   * Stream nodes of one language whose `decorators` JSON array contains `decorator`. The
   * LIKE is a cheap index-free pre-filter over the JSON text (a decorator name can appear
   * as a substring of another), so callers must still exact-check `node.decorators`. Exists
   * so a synthesizer never materializes the whole node table the way `getAllNodes().filter`
   * did — that alone exhausted Node's default heap on a 2M-node graph (#1212).
   */
  *iterateNodesByLanguageWithDecorator(language: Language, decorator: string): IterableIterator<Node> {
    const statement = this.session.db.prepare("SELECT * FROM nodes WHERE language = ? AND decorators LIKE '%' || ? || '%'");
    for (const row of statement.iterate(language, `"${decorator}"`)) yield rowToNode(row as NodeRow);
  }

  /** Distinct languages present in the files table — lets a dynamic-edge synthesizer skip a whole pass on a project that has none of its language (#1212). */
  getDistinctFileLanguages(): Set<string> {
    const rows = this.session.db.prepare('SELECT DISTINCT language FROM files').all() as Array<{ language: string }>;
    return new Set(rows.map((row) => row.language));
  }

  /**
   * Nodes by exact name — resolution's candidate list. The `ORDER BY` is load-bearing, not
   * cosmetic (CG-33): when a reference names a symbol several files define and nothing
   * disambiguates them, resolution binds to the first candidate, so without a stable order
   * the winner would be decided by row insertion order (scan order on a full index, append
   * order on an incremental one) and a long-lived synced index would drift from a rebuild
   * of itself. `(file_path, start_line)` is a property of the code, so both paths pick the
   * same candidate.
   */
  getNodesByName(name: string): Node[] {
    const rows = this.session.statement('SELECT * FROM nodes WHERE name = ? ORDER BY file_path, start_line').all(name) as NodeRow[];
    return rows.map(rowToNode);
  }

  /** Nodes whose name starts with `prefix`, by index range scan (a `LIKE 'prefix%'` would skip `idx_nodes_name` under SQLite's default case-insensitive LIKE). */
  getNodesByNamePrefix(prefix: string, limit = 20): Node[] {
    const rows = this.session.statement('SELECT * FROM nodes WHERE name >= ? AND name < ? ORDER BY name LIMIT ?').all(prefix, prefix + '￿', limit) as NodeRow[];
    return rows.map(rowToNode);
  }

  getNodesByQualifiedNameExact(qualifiedName: string): Node[] {
    const rows = this.session.statement('SELECT * FROM nodes WHERE qualified_name = ?').all(qualifiedName) as NodeRow[];
    return rows.map(rowToNode);
  }

  /**
   * Nodes by name, case-insensitively (seeks the `idx_nodes_lower_name` expression index).
   * The parameter is lowered in SQL, not trusted to arrive lowered: written as a bare
   * `lower(name) = ?` it silently matched nothing for input carrying an uppercase letter,
   * and — because SQLite's `lower()` folds ASCII only while JavaScript's `.toLowerCase()`
   * folds Unicode — a caller that pre-lowered in JS could not match a non-ASCII name at
   * all. This hardens the query, not its one caller (`matchFuzzy` still lowers in JS first),
   * so the non-ASCII gap remains open there.
   */
  getNodesByLowerName(name: string): Node[] {
    const rows = this.session.statement('SELECT * FROM nodes WHERE lower(name) = lower(?)').all(name) as NodeRow[];
    return rows.map(rowToNode);
  }

  /** Every distinct node name (lightweight — names only, for pre-filtering). */
  getAllNodeNames(): string[] {
    const rows = this.session.statement('SELECT DISTINCT name FROM nodes').all() as Array<{ name: string }>;
    return rows.map((row) => row.name);
  }

  /** The incremental counterpart to `getAllNodeNames`, for callers that must yield to the event loop mid-scan (resolver cache warm-up on multi-million-node indexes). */
  *iterateNodeNames(): IterableIterator<string> {
    const statement = this.session.db.prepare('SELECT DISTINCT name FROM nodes');
    for (const row of statement.iterate()) yield (row as { name: string }).name;
  }

  /** Distinct node names defined in the given files — the symbol names a sync pass looks up retryable failed refs against. */
  getNodeNamesByFiles(filePaths: string[]): string[] {
    if (filePaths.length === 0) return [];
    const names = new Set<string>();
    for (const chunk of chunked(filePaths)) {
      const rows = this.session.listStatement(`SELECT DISTINCT name FROM nodes WHERE file_path IN (${placeholders(chunk.length)})`, chunk.length).all(...chunk) as Array<{ name: string }>;
      for (const row of rows) names.add(row.name);
    }
    return [...names];
  }

  /**
   * Distinct `file\0name` pairs defined by the given files — sync's definition-delta shape
   * (CG-33). A bare name set taken over the whole changed batch would cancel a name that
   * moves between two files in one commit out of the symmetric difference; keying by file
   * makes each definition its own fact, so a move reads as one removal plus one addition.
   */
  getNodeNamePairsByFiles(filePaths: string[]): Set<string> {
    const pairs = new Set<string>();
    if (filePaths.length === 0) return pairs;
    for (const chunk of chunked(filePaths)) {
      const rows = this.session.listStatement(`SELECT DISTINCT file_path, name FROM nodes WHERE file_path IN (${placeholders(chunk.length)})`, chunk.length).all(...chunk) as Array<{ file_path: string; name: string }>;
      // NUL-joined: a path or a symbol name can contain a space, never a NUL.
      for (const row of rows) pairs.add(`${row.file_path}\0${row.name}`);
    }
    return pairs;
  }
}
