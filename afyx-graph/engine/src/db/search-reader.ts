/**
 * Name search: FTS5 with a LIKE fallback and a bounded fuzzy fallback, plus the two
 * direct-lookup helpers hybrid search uses for known symbol names. Ranking blends BM25
 * (or a LIKE-derived score) with kind, path and name-match signals, then applies the
 * `path:`/`name:` filters `parseQuery` pulled out of the raw query.
 */

import type { Language, NodeKind, SearchOptions, SearchResult } from '../types';
import { boundedEditDistance, parseQuery } from '../search/query-parser';
import { kindBonus, nameMatchBonus, scorePathRelevance } from '../search/query-utils';
import type { NodeReader } from './node-reader';
import { QuerySession } from './query-session';
import { rowToNode, type NodeRow } from './row-mappers';

/**
 * How much of the exact-name bonus a `deprioritize`d path keeps (#982). Damped rather
 * than zeroed: a query that genuinely targets that tree must still rank it — the same
 * "discount, don't erase" rule the path penalty follows. Derived rather than picked:
 * `nameMatchBonus`'s prefix arm tops out below `10 + 30 = 40`, and a de-prioritized node
 * also takes the -15 path penalty, so `80 * SCALE - 15 > 40` is what stops a damped
 * whole-query exact match from losing to a mere prefix match; 0.75 clears it (45).
 * Measured on a 62k-node django index: at 0.25 the invariant breaks in practice, while
 * crowd-out removal is almost flat between 0.75 and 0.5, so a deeper discount buys little
 * and costs the invariant. Pinned by a test.
 */
export const DEPRIORITIZED_NAME_BONUS_SCALE = 0.75;

function kindFilterSql(kinds: readonly NodeKind[] | undefined): string {
  return kinds && kinds.length > 0 ? ` AND kind IN (${kinds.map(() => '?').join(',')})` : '';
}
function languageFilterSql(languages: readonly Language[] | undefined): string {
  return languages && languages.length > 0 ? ` AND language IN (${languages.map(() => '?').join(',')})` : '';
}

export class SearchReader {
  /** Detected once at construction — like `DatabaseConnection.fts5Available`, but independently, and (like the original) never re-detected on `rebind`. */
  private readonly fts5Available: boolean;

  // Normalized project-name tokens (go.mod / package.json / repo dir): a query word
  // matching one is dropped from path-relevance scoring, since it names the whole
  // project rather than a symbol (#720). Empty by default.
  private projectNameTokens: Set<string> = new Set();
  private isDeprioritizedPath: ((filePath: string) => boolean) | undefined;

  constructor(
    private readonly session: QuerySession,
    private readonly nodes: NodeReader
  ) {
    try {
      session.db.prepare('SELECT * FROM nodes_fts LIMIT 0').get();
      this.fts5Available = true;
    } catch {
      this.fts5Available = false;
    }
  }

  setProjectNameTokens(tokens: Set<string>): void {
    this.projectNameTokens = tokens;
  }
  getProjectNameTokens(): Set<string> {
    return this.projectNameTokens;
  }
  setDeprioritizedPathMatcher(matcher: ((filePath: string) => boolean) | undefined): void {
    this.isDeprioritizedPath = matcher;
  }
  getDeprioritizedPathMatcher(): ((filePath: string) => boolean) | undefined {
    return this.isDeprioritizedPath;
  }

  /**
   * Search nodes by name: FTS5 prefix match first, LIKE substring next, a bounded
   * edit-distance fuzzy sweep last, each tried only once the one before returned nothing.
   * Exact-name matches are then always folded in as candidates (BM25 can bury a short
   * exact match under many compound names before rescoring gets a chance), the whole set
   * is rescored with kind/path/name signals and trimmed to `limit`, and finally the
   * `path:`/`name:` filters `parseQuery` extracted are applied as a hard gate.
   */
  searchNodes(query: string, options: SearchOptions = {}): SearchResult[] {
    const { limit = 100, offset = 0 } = options;

    // Field-qualified bits (kind:, lang:, path:, name:) compose with the SearchOptions
    // arg — both apply (intersection-style). Anything unrecognised stays in `text`.
    const parsed = parseQuery(query);
    const kinds = parsed.kinds.length > 0 ? Array.from(new Set([...(options.kinds ?? []), ...parsed.kinds])) : options.kinds;
    const languages = parsed.languages.length > 0 ? Array.from(new Set([...(options.languages ?? []), ...parsed.languages])) : options.languages;
    const { text, pathFilters, nameFilters } = parsed;

    // A filter-only query (`kind:function`, no text) still needs a candidate set, so
    // over-fetch by 5× — the post-scoring path:/name: filters can be very selective.
    let results = text
      ? (this.fts5Available !== false ? this.searchNodesFTS(text, { kinds, languages, limit, offset }) : [])
      : this.searchAllByFilters({ kinds, languages, limit: limit * 5 });

    if (results.length === 0 && text.length >= 2) results = this.searchNodesLike(text, { kinds, languages, limit, offset });
    // Fuzzy fallback only fires when both FTS and LIKE found nothing and there is enough
    // text to be worth fuzzing (a 1-char query would match too much).
    if (results.length === 0 && text.length >= 3) results = this.searchNodesFuzzy(text, { kinds, languages, limit });

    if (results.length > 0 && query) this.foldInExactNames(results, query, kinds, languages);
    if (results.length > 0 && (text || query)) results = this.rescore(results, text || query, limit);

    if (pathFilters.length > 0) {
      const lowered = pathFilters.map((p) => p.toLowerCase());
      results = results.filter((r) => lowered.some((p) => r.node.filePath.toLowerCase().includes(p)));
    }
    if (nameFilters.length > 0) {
      const lowered = nameFilters.map((n) => n.toLowerCase());
      results = results.filter((r) => lowered.some((n) => r.node.name.toLowerCase().includes(n)));
    }
    return results;
  }

  /**
   * Whole-name equality candidates for every space-separated term of the original query,
   * folded into `results` in place. Written as `lower(name) = lower(?)` so it seeks
   * `idx_nodes_lower_name` — the equivalent `name = ? COLLATE NOCASE` matches no index
   * (`idx_nodes_name` is binary-collated, and the expression index only matches the same
   * expression) and degrades to a full table scan, which the `LIMIT 20` cannot rescue:
   * SQLite can only stop early once it has 20 rows, and this runs once per term, most of
   * which name nothing in the corpus.
   */
  private foldInExactNames(results: SearchResult[], query: string, kinds: NodeKind[] | undefined, languages: Language[] | undefined): void {
    const existingIds = new Set(results.map((r) => r.node.id));
    const maxScore = Math.max(...results.map((r) => r.score));
    for (const term of query.split(/\s+/).filter((t) => t.length >= 2)) {
      let sql = 'SELECT * FROM nodes WHERE lower(name) = lower(?)';
      const params: (string | number)[] = [term];
      if (kinds && kinds.length > 0) {
        sql += kindFilterSql(kinds);
        params.push(...kinds);
      }
      if (languages && languages.length > 0) {
        sql += languageFilterSql(languages);
        params.push(...languages);
      }
      sql += ' LIMIT 20';
      const rows = this.session.db.prepare(sql).all(...params) as NodeRow[];
      for (const row of rows) {
        if (existingIds.has(row.id)) continue;
        results.push({ node: rowToNode(row), score: maxScore });
        existingIds.add(row.id);
      }
    }
  }

  /** Apply kind/path/name-match rescoring, sort by score, and trim to `limit`. */
  private rescore(results: SearchResult[], scoringQuery: string, limit: number): SearchResult[] {
    const rescored = results.map((r) => {
      // A de-prioritized path's exact-name bonus is damped too, evaluated once and reused
      // (the predicate stats the config file); see DEPRIORITIZED_NAME_BONUS_SCALE.
      const deprioritized = this.isDeprioritizedPath?.(r.node.filePath) ?? false;
      const nameBonus = nameMatchBonus(r.node.name, scoringQuery);
      return {
        ...r,
        score: r.score + kindBonus(r.node.kind) + scorePathRelevance(r.node.filePath, scoringQuery, this.projectNameTokens, deprioritized) + (deprioritized ? Math.round(nameBonus * DEPRIORITIZED_NAME_BONUS_SCALE) : nameBonus),
      };
    });
    rescored.sort((a, b) => b.score - a.score);
    return rescored.length > limit ? rescored.slice(0, limit) : rescored;
  }

  /** Match-everything path for a filter-only query, ordered by name; the caller's filter pass narrows to what was asked for. */
  private searchAllByFilters(options: { kinds?: NodeKind[]; languages?: Language[]; limit: number }): SearchResult[] {
    let sql = 'SELECT * FROM nodes WHERE 1=1';
    const params: (string | number)[] = [];
    if (options.kinds && options.kinds.length > 0) {
      sql += kindFilterSql(options.kinds);
      params.push(...options.kinds);
    }
    if (options.languages && options.languages.length > 0) {
      sql += languageFilterSql(options.languages);
      params.push(...options.languages);
    }
    sql += ' ORDER BY name LIMIT ?';
    params.push(options.limit);
    const rows = this.session.db.prepare(sql).all(...params) as NodeRow[];
    return rows.map((row) => ({ node: rowToNode(row), score: 1 }));
  }

  /**
   * Bounded edit-distance sweep over the distinct name set, only reached when FTS and LIKE
   * both found nothing. `maxDist` caps at 2 (1 for a ≤4-char query) so `getUssr` finds
   * `getUser` but `process` does not match `prosody`. Follow-up per-name queries are
   * capped so a project with many similar names cannot fan out past `limit` queries
   * before the inner-loop cap takes over.
   */
  private searchNodesFuzzy(text: string, options: { kinds?: NodeKind[]; languages?: Language[]; limit: number }): SearchResult[] {
    const lowered = text.toLowerCase();
    const maxDist = lowered.length <= 4 ? 1 : 2;
    const candidates: Array<{ name: string; dist: number }> = [];
    for (const name of this.nodes.getAllNodeNames()) {
      const dist = boundedEditDistance(name.toLowerCase(), lowered, maxDist);
      if (dist <= maxDist) candidates.push({ name, dist });
    }
    candidates.sort((a, b) => a.dist - b.dist);
    const capped = candidates.slice(0, Math.max(options.limit * 2, 50));

    const results: SearchResult[] = [];
    const seen = new Set<string>();
    for (const candidate of capped) {
      if (results.length >= options.limit) break;
      let sql = 'SELECT * FROM nodes WHERE name = ?';
      const params: (string | number)[] = [candidate.name];
      if (options.kinds && options.kinds.length > 0) {
        sql += kindFilterSql(options.kinds);
        params.push(...options.kinds);
      }
      if (options.languages && options.languages.length > 0) {
        sql += languageFilterSql(options.languages);
        params.push(...options.languages);
      }
      sql += ' LIMIT 5';
      const rows = this.session.db.prepare(sql).all(...params) as NodeRow[];
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        results.push({ node: rowToNode(row), score: 1 / (1 + candidate.dist) });
        if (results.length >= options.limit) break;
      }
    }
    return results;
  }

  /**
   * FTS5 prefix match. `::` (a qualifier separator in Rust/C++/Ruby, not a token char) is
   * treated as whitespace before stripping so `stage_apply::run` splits instead of
   * collapsing to `stage_applyrun` (#173). BM25 weights name heavily (20) over qualified
   * name (5), docstring (1) and signature (2) so exact/prefix name matches rank above
   * incidental mentions; results are over-fetched 5× so the caller's rescoring can promote
   * what BM25 alone undervalues.
   */
  private searchNodesFTS(query: string, options: SearchOptions): SearchResult[] {
    const { kinds, languages, limit = 100, offset = 0 } = options;
    const ftsQuery = query
      .replace(/::/g, ' ')
      .replace(/['"*():^]/g, '')
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .filter((term) => !/^(AND|OR|NOT|NEAR)$/i.test(term))
      .map((term) => `"${term}"*`)
      .join(' OR ');
    if (!ftsQuery) return [];

    const ftsLimit = Math.max(limit * 5, 100);
    let sql = `
      SELECT nodes.*, bm25(nodes_fts, 0, 20, 5, 1, 2) as score
      FROM nodes_fts
      JOIN nodes ON nodes_fts.id = nodes.id
      WHERE nodes_fts MATCH ?
    `;
    const params: (string | number)[] = [ftsQuery];
    if (kinds && kinds.length > 0) {
      sql += ` AND nodes.kind IN (${kinds.map(() => '?').join(',')})`;
      params.push(...kinds);
    }
    if (languages && languages.length > 0) {
      sql += ` AND nodes.language IN (${languages.map(() => '?').join(',')})`;
      params.push(...languages);
    }
    sql += ' ORDER BY score LIMIT ? OFFSET ?';
    params.push(ftsLimit, offset);

    try {
      const rows = this.session.db.prepare(sql).all(...params) as Array<NodeRow & { score: number }>;
      return rows.map((row) => ({ node: rowToNode(row), score: Math.abs(row.score) })); // bm25 returns negative scores
    } catch {
      return [];
    }
  }

  /** LIKE-based substring search (camelCase matching where FTS's tokenizer keeps a name as one token — e.g. "signIn" finding "signInWithGoogle"). */
  private searchNodesLike(query: string, options: SearchOptions): SearchResult[] {
    const { kinds, languages, limit = 100, offset = 0 } = options;
    let sql = `
      SELECT nodes.*,
        CASE
          WHEN name = ? THEN 1.0
          WHEN name LIKE ? THEN 0.9
          WHEN name LIKE ? THEN 0.8
          WHEN qualified_name LIKE ? THEN 0.7
          ELSE 0.5
        END as score
      FROM nodes
      WHERE (name LIKE ? OR qualified_name LIKE ? OR name LIKE ?)
    `;
    const startsWith = `${query}%`;
    const contains = `%${query}%`;
    const params: (string | number)[] = [query, startsWith, contains, contains, contains, contains, startsWith];
    if (kinds && kinds.length > 0) {
      sql += kindFilterSql(kinds);
      params.push(...kinds);
    }
    if (languages && languages.length > 0) {
      sql += languageFilterSql(languages);
      params.push(...languages);
    }
    sql += ' ORDER BY score DESC, length(name) ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = this.session.db.prepare(sql).all(...params) as Array<NodeRow & { score: number }>;
    return rows.map((row) => ({ node: rowToNode(row), score: row.score }));
  }

  /**
   * Exact/case-insensitive name lookup for hybrid search's known symbol names. Two passes:
   * find which files hold DISTINCTIVE (rare, <10-file) names among the query, then
   * re-query each name boosting results that co-locate with a distinctive symbol — the
   * signal that "run" appearing beside "scrapeLoop" is probably the answer, plain "run"
   * elsewhere probably is not.
   */
  findNodesByExactName(names: string[], options: SearchOptions = {}): SearchResult[] {
    if (names.length === 0) return [];
    const { kinds, languages, limit = 50 } = options;

    const nameToFiles = new Map<string, Set<string>>();
    for (const name of names) {
      let sql = 'SELECT DISTINCT file_path FROM nodes WHERE lower(name) = lower(?)';
      const params: (string | number)[] = [name];
      if (kinds && kinds.length > 0) {
        sql += kindFilterSql(kinds);
        params.push(...kinds);
      }
      sql += ' LIMIT 100';
      const rows = this.session.db.prepare(sql).all(...params) as Array<{ file_path: string }>;
      nameToFiles.set(name.toLowerCase(), new Set(rows.map((row) => row.file_path)));
    }
    const distinctiveFiles = new Set<string>();
    for (const files of nameToFiles.values()) if (files.size > 0 && files.size < 10) for (const file of files) distinctiveFiles.add(file);

    const perNameLimit = Math.max(8, Math.ceil(limit / names.length));
    const allResults: SearchResult[] = [];
    const seenIds = new Set<string>();
    for (const name of names) {
      let sql = 'SELECT nodes.*, 1.0 as score FROM nodes WHERE lower(name) = lower(?)';
      const params: (string | number)[] = [name];
      if (kinds && kinds.length > 0) {
        sql += kindFilterSql(kinds);
        params.push(...kinds);
      }
      if (languages && languages.length > 0) {
        sql += languageFilterSql(languages);
        params.push(...languages);
      }
      sql += ' LIMIT ?';
      params.push(Math.max(perNameLimit * 3, 50));
      const rows = this.session.db.prepare(sql).all(...params) as Array<NodeRow & { score: number }>;
      const nameResults: SearchResult[] = [];
      for (const row of rows) {
        const node = rowToNode(row);
        if (seenIds.has(node.id)) continue;
        const coLocationBoost = distinctiveFiles.has(node.filePath) ? 20 : 0;
        nameResults.push({ node, score: row.score + coLocationBoost });
      }
      nameResults.sort((a, b) => b.score - a.score);
      for (const result of nameResults.slice(0, perNameLimit)) {
        seenIds.add(result.node.id);
        allResults.push(result);
      }
    }
    allResults.sort((a, b) => b.score - a.score);
    return allResults.slice(0, limit);
  }

  /** Names containing a substring — CamelCase-part matching where FTS fails because the whole name is one token. Ordered shortest-name-first (more likely the core type). */
  findNodesByNameSubstring(substring: string, options: SearchOptions & { excludePrefix?: boolean } = {}): SearchResult[] {
    const { kinds, languages, limit = 30, excludePrefix } = options;
    let sql = 'SELECT nodes.*, 1.0 as score FROM nodes WHERE name LIKE ?';
    const params: (string | number)[] = [`%${substring}%`];
    if (excludePrefix) {
      sql += ' AND name NOT LIKE ?';
      params.push(`${substring}%`);
    }
    if (kinds && kinds.length > 0) {
      sql += kindFilterSql(kinds);
      params.push(...kinds);
    }
    if (languages && languages.length > 0) {
      sql += languageFilterSql(languages);
      params.push(...languages);
    }
    sql += ' ORDER BY length(name) ASC LIMIT ?';
    params.push(limit);
    const rows = this.session.db.prepare(sql).all(...params) as Array<NodeRow & { score: number }>;
    return rows.map((row) => ({ node: rowToNode(row), score: row.score }));
  }
}
