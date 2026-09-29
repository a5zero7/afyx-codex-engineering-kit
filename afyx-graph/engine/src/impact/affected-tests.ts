/**
 * Affected-test-file computation over transitive file impact (`file-impact.ts`). The shared
 * `isTestPath` classifier (`search/test-paths.ts`) decides which reached files are reported.
 * Only an explicit test filename terminates Graph's walk: a support module matched solely
 * because it lives in a test tree can itself have an executable test as a dependent. A
 * caller-supplied filter still replaces the classifier entirely (and remains terminal),
 * exactly as the CLI's own `--filter` option always has.
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
  const isTerminal = options.customFilter
    ? classify
    : (filePath: string) => isTestPath(filePath.replace(/\\/g, '/').split('/').pop()!);
  const { allDependents } = transitiveFileImpact(host, changedFiles, {
    maxDepth: options.maxDepth,
    isTerminal,
  });
  const affectedTests = new Set(changedFiles.filter(classify));
  for (const dependent of allDependents) {
    if (classify(dependent)) affectedTests.add(dependent);
  }
  return {
    affectedTests: [...affectedTests].sort(),
    totalDependentsTraversed: allDependents.size,
  };
}
