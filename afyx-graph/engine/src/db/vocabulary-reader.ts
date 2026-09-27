/**
 * Reads over the name-segment vocabulary (writes live in `NameVocabulary`, Phase 3B.4A):
 * emptiness, paged rebuild candidates, and the prompt hook's segment lookups.
 */

import { QuerySession } from './query-session';

export class VocabularyReader {
  constructor(private readonly session: QuerySession) {}

  /** True when the vocabulary has no rows — an index built before the table existed; `sync` uses this to heal such databases. */
  isNameSegmentVocabEmpty(): boolean {
    return this.session.statement('SELECT 1 FROM name_segment_vocab LIMIT 1').get() === undefined;
  }

  /** One page of distinct segmentable node names, for batched vocab rebuilds (file basenames and import specifiers are excluded — see `NameVocabulary`). */
  getDistinctNodeNames(limit: number, offset: number): string[] {
    const rows = this.session
      .statement("SELECT DISTINCT name FROM nodes WHERE kind NOT IN ('file', 'import') ORDER BY name LIMIT ? OFFSET ?")
      .all(limit, offset) as Array<{ name: string }>;
    return rows.map((row) => row.name);
  }

  /**
   * Names whose segments cover at least `minWords` distinct prompt words — the
   * co-occurrence probe behind the prompt hook's medium tier. Variants (plural forms of
   * one word) are folded back to their word INSIDE the SQL so a name matching both
   * `service` and `services` counts one word, not two; counting raw variants would let a
   * plural pair tie with a genuine two-word match and, because ORDER BY/LIMIT run before
   * any JS re-check, crowd a real match past the limit on vocab-heavy repos (#1146).
   */
  getSegmentCoOccurrence(variants: Array<{ segment: string; word: string }>, minWords: number, limit: number): Array<{ name: string; matches: number }> {
    if (variants.length === 0) return [];
    const placeholders = variants.map(() => '?').join(', ');
    const whens = variants.map(() => 'WHEN ? THEN ?').join(' ');
    return this.session.db
      .prepare(`
        SELECT name, COUNT(DISTINCT CASE segment ${whens} END) AS matches
          FROM name_segment_vocab
         WHERE segment IN (${placeholders})
      GROUP BY name
        HAVING matches >= ?
      ORDER BY matches DESC, length(name) ASC
         LIMIT ?
      `)
      .all(...variants.flatMap((v) => [v.segment, v.word]), ...variants.map((v) => v.segment), minWords, limit) as Array<{ name: string; matches: number }>;
  }

  /** How many distinct names each segment appears in — the rarity signal separating a discriminative word ("checkout") from a ubiquitous one ("state"). */
  getSegmentNameCounts(segments: string[]): Map<string, number> {
    if (segments.length === 0) return new Map();
    const placeholders = segments.map(() => '?').join(', ');
    const rows = this.session.db.prepare(`SELECT segment, COUNT(*) AS n FROM name_segment_vocab WHERE segment IN (${placeholders}) GROUP BY segment`).all(...segments) as Array<{ segment: string; n: number }>;
    return new Map(rows.map((row) => [row.segment, row.n]));
  }

  /** Names containing the given segment (the rare-single-word tier), shortest first. */
  getNamesForSegment(segment: string, limit: number): string[] {
    const rows = this.session.db.prepare('SELECT name FROM name_segment_vocab WHERE segment = ? ORDER BY length(name) ASC LIMIT ?').all(segment, limit) as Array<{ name: string }>;
    return rows.map((row) => row.name);
  }
}
