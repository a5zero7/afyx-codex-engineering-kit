/**
 * Index freshness — a cheap, read-only answer to "can I trust this index right now?".
 *
 * After every successful index/sync the engine records a tiny sidecar,
 * `<state-dir>/freshness.json`:
 *   { "schema_version": 1, "indexed_at": ISO-8601, "git_head": "<sha>"|null, "tracked_clean": true|false|null }
 *
 * `getFreshness` compares that record with the working tree using only local git
 * and never opens the database, so it is safe for doctors, status and hooks.
 *
 *   MISSING  no database
 *   INVALID  database is not a SQLite file, or the sidecar is unreadable
 *   UNKNOWN  no sidecar yet, not a git working tree, or no recorded head
 *   STALE    HEAD moved, tracked files changed, or the index was built from uncommitted edits
 *   FRESH    same HEAD, clean tracked tree, and the index was built from a clean tree
 *
 * scripts/afyx-doctor.{ps1,sh} implement the same rules over the same file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { getAfyxGraphDir, getDatabasePath } from './directory';

export type FreshnessState = 'MISSING' | 'FRESH' | 'STALE' | 'INVALID' | 'UNKNOWN';

export interface FreshnessReport {
  state: FreshnessState;
  detail: string;
}

export const FRESHNESS_FILE_NAME = 'freshness.json';
const SQLITE_MAGIC = 'SQLite format 3\0';

function git(rootDir: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: rootDir, encoding: 'utf-8', timeout: 10_000, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true,
    });
  } catch {
    return null;
  }
}

function gitHead(rootDir: string): string | null {
  const out = git(rootDir, ['rev-parse', 'HEAD']);
  return out ? out.trim() || null : null;
}

/** True when no tracked file differs from HEAD; null when git cannot say. */
function trackedTreeClean(rootDir: string): boolean | null {
  const out = git(rootDir, ['status', '--porcelain', '--untracked-files=no']);
  return out === null ? null : out.trim() === '';
}

/** Record what the index was just built from. Best effort: never throws, never fails an index. */
export function writeFreshness(rootDir: string): void {
  try {
    const dir = getAfyxGraphDir(rootDir);
    if (!fs.existsSync(dir)) return;
    const inGit = fs.existsSync(path.join(rootDir, '.git'));
    const record = {
      schema_version: 1,
      indexed_at: new Date().toISOString(),
      git_head: inGit ? gitHead(rootDir) : null,
      tracked_clean: inGit ? trackedTreeClean(rootDir) : null,
    };
    const target = path.join(dir, FRESHNESS_FILE_NAME);
    const temp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(record, null, 2) + '\n');
    fs.renameSync(temp, target);
  } catch {
    /* freshness is advisory */
  }
}

function hasSqliteHeader(dbPath: string): boolean {
  let fd: number | undefined;
  try {
    fd = fs.openSync(dbPath, 'r');
    const header = Buffer.alloc(16);
    const read = fs.readSync(fd, header, 0, 16, 0);
    return read === 16 && header.toString('latin1') === SQLITE_MAGIC;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* ignore */ }
  }
}

/** Read-only freshness verdict for a project root. */
export function getFreshness(rootDir: string): FreshnessReport {
  const dbPath = getDatabasePath(rootDir);
  if (!fs.existsSync(dbPath)) return { state: 'MISSING', detail: 'no Afyx Graph database; run "afyx-graph init"' };
  if (!hasSqliteHeader(dbPath)) return { state: 'INVALID', detail: 'database is not a SQLite file' };

  const metaPath = path.join(getAfyxGraphDir(rootDir), FRESHNESS_FILE_NAME);
  if (!fs.existsSync(metaPath)) {
    return { state: 'UNKNOWN', detail: 'index metadata not recorded yet; run "afyx-graph sync"' };
  }
  let meta: { schema_version?: unknown; git_head?: unknown; tracked_clean?: unknown };
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  } catch {
    return { state: 'INVALID', detail: 'freshness.json is not valid JSON' };
  }
  if (!meta || meta.schema_version !== 1) return { state: 'INVALID', detail: 'freshness.json has an unsupported schema' };

  if (!fs.existsSync(path.join(rootDir, '.git'))) {
    return { state: 'UNKNOWN', detail: 'not a git working tree; freshness cannot be proven cheaply' };
  }
  const recorded = typeof meta.git_head === 'string' ? meta.git_head : '';
  if (!recorded) return { state: 'UNKNOWN', detail: 'index metadata has no git head' };

  const head = gitHead(rootDir);
  if (head === null) return { state: 'UNKNOWN', detail: 'git could not report HEAD' };
  if (head !== recorded) return { state: 'STALE', detail: 'git HEAD changed since the last index' };
  const clean = trackedTreeClean(rootDir);
  if (clean === null) return { state: 'UNKNOWN', detail: 'git could not report the working tree state' };
  if (!clean) return { state: 'STALE', detail: 'tracked files changed since the last index' };
  if (meta.tracked_clean !== true) return { state: 'STALE', detail: 'the index was built while tracked files had uncommitted changes' };
  return { state: 'FRESH', detail: 'matches git HEAD with a clean tracked tree' };
}
