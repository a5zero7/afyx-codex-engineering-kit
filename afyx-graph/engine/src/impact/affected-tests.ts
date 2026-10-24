/**
 * Affected-test-file computation over transitive file impact (`file-impact.ts`). The shared
 * `isTestPath` classifier (`search/test-paths.ts`) decides which reached files are reported.
 * Only an explicit test filename terminates Graph's walk: a support module matched solely
 * because it lives in a test tree can itself have an executable test as a dependent. A
 * caller-supplied filter still replaces the classifier entirely (and remains terminal),
 * exactly as the CLI's own `--filter` option always has.
 */
import { isTestPath } from '../search/test-paths';
import type { IndexHealth } from '../index-health';
import type { FileRecord } from '../types';
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

export type EmptyAffectedTestsReason =
  | 'NO_INDEXED_TESTS'
  | 'NO_REACHABLE_INDEXED_TESTS'
  | 'INSUFFICIENT_GRAPH_EVIDENCE';

export interface AffectedTestsAnalysis {
  /** Null when at least one affected test was found. */
  emptyReason: EmptyAffectedTestsReason | null;
  /** Whether the empty reason is supported by a complete, current structural index. */
  evidenceSufficient: boolean;
  indexedTestFiles: number;
  structurallyIndexedTestFiles: number;
  /** Stable machine-readable limitations; empty when evidence is sufficient. */
  limitations: string[];
}

/**
 * Explain an affected-test result without turning graph absence into source-code truth.
 * Existing callers keep the original `affectedTests` array; CLI JSON adds this analysis
 * alongside it so empty results are actionable and backward compatible.
 */
export function analyzeAffectedTests(
  result: AffectedTestsResult,
  changedFiles: string[],
  files: FileRecord[],
  health: IndexHealth,
  customFilter?: RegExp,
): AffectedTestsAnalysis {
  const classify = (filePath: string): boolean => {
    if (!customFilter) return isTestPath(filePath);
    customFilter.lastIndex = 0;
    return customFilter.test(filePath);
  };
  const indexedTests = files.filter((file) => classify(file.path));
  const structuralTests = indexedTests.filter((file) => (file.indexingLevel ?? 'structural') === 'structural');
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  const relevantFiles = [...changedFiles.map((file) => fileByPath.get(file)), ...indexedTests]
    .filter((file): file is FileRecord => file !== undefined);
  const limitations = new Set<string>();

  if (health.extraction.state !== 'complete') limitations.add('INDEX_NOT_COMPLETE');
  if (!health.extraction.accounting) limitations.add('INDEX_ACCOUNTING_UNAVAILABLE');
  if ((health.extraction.accounting?.failed ?? 0) > 0) limitations.add('EXTRACTION_FAILURES_PRESENT');
  if (health.compatibility.reindexRecommended) limitations.add('EXTRACTION_VERSION_STALE');
  if (health.pendingChanges.state !== 'CURRENT') limitations.add('INDEX_FRESHNESS_UNPROVEN');
  if (health.gitFreshness.state === 'MISSING' || health.gitFreshness.state === 'INVALID' || health.gitFreshness.state === 'STALE') {
    limitations.add('INDEX_FRESHNESS_UNPROVEN');
  }
  if (changedFiles.some((file) => {
    const record = fileByPath.get(file);
    return !record || (record.indexingLevel ?? 'structural') !== 'structural';
  })) limitations.add('CHANGED_FILE_NOT_STRUCTURALLY_INDEXED');
  if (indexedTests.some((file) => (file.indexingLevel ?? 'structural') !== 'structural')) {
    limitations.add('TEST_COVERAGE_NOT_STRUCTURAL');
  }
  if (relevantFiles.some((file) => file.errors?.some((entry) => entry.severity === 'error'))) {
    limitations.add('RELEVANT_EXTRACTION_ERRORS');
  }

  const stableLimitations = [...limitations].sort();
  const evidenceSufficient = stableLimitations.length === 0;
  let emptyReason: EmptyAffectedTestsReason | null = null;
  if (result.affectedTests.length === 0) {
    emptyReason = !evidenceSufficient
      ? 'INSUFFICIENT_GRAPH_EVIDENCE'
      : indexedTests.length === 0
        ? 'NO_INDEXED_TESTS'
        : 'NO_REACHABLE_INDEXED_TESTS';
  }

  return {
    emptyReason,
    evidenceSufficient,
    indexedTestFiles: indexedTests.length,
    structurallyIndexedTestFiles: structuralTests.length,
    limitations: stableLimitations,
  };
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
