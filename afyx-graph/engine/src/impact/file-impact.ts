/**
 * Transitive file-dependency impact: repeatedly follow 1-hop file dependents (Graph's own
 * `getFileDependents`, untouched — see `graph/queries.ts`/`db/dependency-reader.ts`) to
 * find every file that transitively depends on a starting set, bounded by a hop count.
 *
 * Deliberately classification-agnostic (#1507-adjacent, Phase 3B.5 architecture): "what is
 * affected" (this module) is kept separate from "is this file a test" (the caller's
 * `isTerminal` predicate) so a test-file classifier change never has to touch traversal
 * code, and this same traversal is reusable for any "stop expanding once you've found a
 * file matching X" query, not just tests.
 */

export interface FileImpactHost {
  getFileDependents(filePath: string): string[];
}

export interface TransitiveFileImpactOptions {
  /** Hop count following file-dependency edges; a starting file itself is hop 0. */
  maxDepth: number;
  /**
   * A discovered file for which this returns true is recorded but not expanded further —
   * its own dependents are never visited. Omit to expand every discovered file up to
   * `maxDepth`.
   */
  isTerminal?: (filePath: string) => boolean;
}

export interface TransitiveFileImpactResult {
  /** Every distinct file discovered as a (possibly transitive) dependent of any start file. */
  allDependents: Set<string>;
  /** The subset of `allDependents` — plus any start file itself — for which `isTerminal` held. */
  terminals: Set<string>;
}

/**
 * BFS over file-dependency edges from every file in `startFiles`, one independent search
 * per start file (a dependent reachable from two different start files is still recorded
 * once — both `allDependents` and `terminals` are shared, deduping sets — but is walked
 * again from each root, exactly as the pre-rewrite implementation did).
 *
 * A start file matching `isTerminal` is recorded immediately and never expanded. A
 * terminal reached during expansion stops that branch: its own dependents are never
 * visited, so a chain of two terminals only ever reports the first one reached.
 */
export function transitiveFileImpact(
  host: FileImpactHost,
  startFiles: string[],
  options: TransitiveFileImpactOptions
): TransitiveFileImpactResult {
  const { maxDepth, isTerminal } = options;
  const allDependents = new Set<string>();
  const terminals = new Set<string>();

  for (const file of startFiles) {
    if (isTerminal?.(file)) {
      terminals.add(file);
      continue;
    }

    const queue: Array<{ file: string; depth: number }> = [{ file, depth: 0 }];
    const visited = new Set<string>([file]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;

      for (const dep of host.getFileDependents(current.file)) {
        if (visited.has(dep)) continue;
        visited.add(dep);
        allDependents.add(dep);

        if (isTerminal?.(dep)) {
          terminals.add(dep);
        } else {
          queue.push({ file: dep, depth: current.depth + 1 });
        }
      }
    }
  }

  return { allDependents, terminals };
}
