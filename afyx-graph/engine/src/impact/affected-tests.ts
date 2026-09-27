/**
 * Affected-test-file computation: transitive file impact (`file-impact.ts`), terminated at
 * whatever this call classifies as a test — the shared `isTestPath` classifier (`search/
 * test-paths.ts`, untouched and reused so `affected` never drifts from what `search`/the
 * MCP tools count as a test, #1507) unless a caller-supplied filter glob replaces it
 * entirely, exactly as the CLI's own `--filter` option always has.
 */
import { isTestPath } from '../search/test-paths';
import { transitiveFileImpact, type FileImpactHost } from './file-impact';

export interface AffectedTestsOptions {
  /** Hop count following file-dependency edges; a changed file itself is hop 0. */
  maxDepth: number;
  /** Replaces the shared classifier entirely — never OR'd with it — matching `--filter`. */
  customFilter?: RegExp;
}

export interface AffectedTestsResult {
  /** Test files reached, deduplicated, sorted alphabetically. */
  affectedTests: string[];
  /** Distinct non-root files visited while searching, test or not — a traversal-size stat. */
  totalDependentsTraversed: number;
}

export function computeAffectedTests(
  host: FileImpactHost,
  changedFiles: string[],
  options: AffectedTestsOptions
): AffectedTestsResult {
  const classify = options.customFilter ? (f: string) => options.customFilter!.test(f) : isTestPath;
  const { allDependents, terminals } = transitiveFileImpact(host, changedFiles, {
    maxDepth: options.maxDepth,
    isTerminal: classify,
  });
  return {
    affectedTests: [...terminals].sort(),
    totalDependentsTraversed: allDependents.size,
  };
}
