/**
 * Cross-project daemon directory — the discovery layer `afyx-graph list` and
 * `afyx-graph stop [--all]` read from.
 *
 * A daemon's OWN lockfile at `<root>/.afyx-graph/daemon.pid` is authoritative
 * for that one project, but there's nowhere central to enumerate every daemon
 * across every project, which is exactly what `list`/`stop --all` need. So
 * every daemon additionally drops a small record under
 * `~/.afyx-graph/daemons/` when it binds, and removes it again on a graceful
 * exit.
 *
 * This directory is discovery-only, never authoritative — a live pid always
 * wins. A daemon killed with SIGKILL never gets to remove its own record, so
 * every reader prunes any entry whose pid has died. All reads and writes here
 * are best-effort by design: a registry hiccup must never take down the
 * daemon or a CLI command over it; the worst case is `list` briefly missing
 * or over-reporting one entry, self-correcting on the next liveness sweep.
 *
 * Portable by construction — nothing here beyond plain files and
 * `process.kill(pid, signal)`, which behaves the same in spirit on
 * macOS/Linux (a real signal) and Windows (mapped internally to
 * TerminateProcess). Exercised live on all three platforms.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  getDaemonPidPath,
  getDaemonSocketCandidates,
  decodeLockInfo,
  canProbeDaemonIdentity,
  probeDaemonIdentity,
  type DaemonLockInfo,
} from './daemon-paths';
import { readWriterLock, releaseWriterLock, tryAcquireWriterLock } from './writer-lock';
import { isValidPidAlive } from './process-liveness';

export interface DaemonRecord {
  /** Realpath'd project root the daemon serves. */
  root: string;
  pid: number;
  version: string;
  socketPath: string;
  /** Epoch ms when the daemon bound its socket. */
  startedAt: number;
}

/**
 * The registry directory itself, `~/.afyx-graph/daemons`, keyed off the home
 * directory — genuinely global, unlike the per-project index dir: setting
 * `AFYX_GRAPH_DIR` renames that one, but has no effect here.
 */
export function getRegistryDir(): string {
  return path.join(os.homedir(), '.afyx-graph', 'daemons');
}

function recordPath(root: string): string {
  const hash = crypto.createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 16);
  return path.join(getRegistryDir(), `${hash}.json`);
}

/**
 * Liveness check for a pid pulled out of a registry record. Guards against a
 * non-positive or non-integer value outright: a record here is parsed
 * straight from on-disk JSON with nothing else validating it, so a corrupt
 * or hand-edited entry must read as dead (and get pruned) rather than alive.
 * The same probe backs the PPID watchdog (#277) and daemon-lock arbitration.
 */
export const isProcessAlive = isValidPidAlive;

/** Drop a discovery record for this daemon so `list`/`stop --all` can find it. Best-effort. */
export function registerDaemon(rec: DaemonRecord): void {
  try {
    fs.mkdirSync(getRegistryDir(), { recursive: true });
    fs.writeFileSync(recordPath(rec.root), JSON.stringify(rec, null, 2) + '\n', { mode: 0o600 });
  } catch {
    /* a missing record is fine — the next liveness prune just won't see it */
  }
}

/** Remove this daemon's discovery record on a graceful shutdown. Best-effort. */
export function deregisterDaemon(root: string): void {
  try {
    fs.unlinkSync(recordPath(root));
  } catch {
    /* already gone */
  }
}

function readRegistryFile(fullPath: string): DaemonRecord | null {
  try {
    const rec = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as DaemonRecord;
    return typeof rec.pid === 'number' && typeof rec.root === 'string' ? rec : null;
  } catch {
    return null;
  }
}

/**
 * Every registered daemon whose process is still alive, newest first. As a
 * side effect (unless `prune` is false) this deletes any dead or garbage
 * record it finds along the way, keeping the registry self-healing.
 */
export function listDaemons(opts: { prune?: boolean } = {}): DaemonRecord[] {
  const prune = opts.prune ?? true;
  const dir = getRegistryDir();
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return []; // no registry dir yet
  }

  const live: DaemonRecord[] = [];
  for (const file of files) {
    const full = path.join(dir, file);
    const rec = readRegistryFile(full);
    if (rec && isProcessAlive(rec.pid)) {
      live.push(rec);
    } else if (prune) {
      try { fs.unlinkSync(full); } catch { /* ignore */ }
    }
  }
  return live.sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Registered daemons narrowed to the ones whose socket hello actually proves
 * the recorded process is a real daemon, not just a pid that happens to be
 * alive. Every user-facing list/stop-all path goes through this, so a reused
 * pid can never masquerade as a phantom running daemon (#1553).
 */
export async function listVerifiedDaemons(opts: { prune?: boolean } = {}): Promise<DaemonRecord[]> {
  const prune = opts.prune ?? true;
  const candidates = listDaemons({ prune });
  const checks = await Promise.all(candidates.map(async (rec) => ({
    rec,
    verified: await probeDaemonIdentity(rec),
  })));
  const verified: DaemonRecord[] = [];
  for (const check of checks) {
    if (check.verified) verified.push(check.rec);
    else if (prune) deregisterDaemon(check.rec.root);
  }
  return verified;
}

/** Remove every socket-candidate file for `root`. POSIX only — a Windows named pipe disappears with its process on its own. */
function unlinkSocketCandidates(root: string): void {
  if (process.platform === 'win32') return;
  for (const candidate of getDaemonSocketCandidates(root)) {
    try { fs.unlinkSync(candidate); } catch { /* gone */ }
  }
}

/**
 * Sweep stale artifacts while holding the project's writer slot exclusively.
 * A daemon claims writer.pid before it ever binds or relocates its socket, so
 * holding that same slot here freezes every legitimate artifact writer for
 * the duration of this compare-and-clean.
 */
function cleanupDaemonArtifacts(
  root: string,
  expectedLockContents: string | null,
): boolean {
  const pidPath = getDaemonPidPath(root);
  if (readWriterLock(root)?.pid === process.pid) return false;
  const claim = tryAcquireWriterLock(root, 'cleanup');
  if (claim.kind === 'taken') return false;

  try {
    if (expectedLockContents === null) {
      if (fs.existsSync(pidPath)) return false;
    } else {
      try {
        if (fs.readFileSync(pidPath, 'utf8') !== expectedLockContents) return false;
      } catch {
        return false;
      }
    }
    // Socket candidates go first, daemon.pid last — a successor electing
    // itself mid-sweep must never be able to bind a socket that this same
    // cleanup then rips out from under it.
    unlinkSocketCandidates(root);
    deregisterDaemon(root);
    try { fs.unlinkSync(pidPath); } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') return false;
    }
    return true;
  } finally {
    releaseWriterLock(root);
  }
}

/** Whether a live, non-probeable legacy lock holder should be preserved rather than treated as ambiguous. */
async function isLiveUnprovenLegacyHolder(info: DaemonLockInfo): Promise<boolean> {
  if (!isProcessAlive(info.pid)) return false;
  // A legacy record carries no socket path at all, so there's nothing to
  // probe — inconclusive, not proof of PID reuse, so its lock is preserved
  // rather than risk a second writer on a guess.
  if (!canProbeDaemonIdentity(info)) return true;
  return probeDaemonIdentity(info);
}

/** Remove daemon artifacts, but only once confirming no matching daemon actually answers the socket hello. */
export async function clearStaleDaemonArtifacts(root: string): Promise<boolean> {
  const pidPath = getDaemonPidPath(root);
  const hadArtifacts = fs.existsSync(pidPath) || (
    process.platform !== 'win32' && getDaemonSocketCandidates(root).some((p) => fs.existsSync(p))
  );
  if (!hadArtifacts) return false;

  let info: DaemonLockInfo | null = null;
  let lockContents: string | null = null;
  try {
    lockContents = fs.readFileSync(pidPath, 'utf8');
    info = decodeLockInfo(lockContents);
  } catch { /* missing/corrupt */ }

  if (info && await isLiveUnprovenLegacyHolder(info)) return false;
  return cleanupDaemonArtifacts(root, lockContents);
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function waitForDeath(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return true;
    await sleep(100);
  }
  return !isProcessAlive(pid);
}

export interface StopResult {
  root: string;
  pid: number | null;
  /** 'term' graceful, 'kill' force, 'not-running' stale, 'no-daemon' absent, 'unverified' preserved. */
  outcome: 'term' | 'kill' | 'not-running' | 'no-daemon' | 'unverified';
}

interface ResolvedDaemonIdentity {
  pid: number | null;
  identity: DaemonLockInfo | null;
  lockContents: string | null;
}

/**
 * Resolve `root`'s daemon pid/identity, preferring its lockfile and falling
 * back to the registry whenever the lockfile yields no pid — whether that's
 * because the file is missing or unreadable, or because it read fine but
 * failed to decode. Either way, `lockContents` stays exactly whatever that
 * lockfile read produced (possibly garbled text, possibly null); a registry
 * fallback never resets it, since callers rely on it as the untouched
 * compare-and-delete snapshot.
 */
function resolveDaemonIdentity(root: string): ResolvedDaemonIdentity {
  let identity: DaemonLockInfo | null = null;
  let lockContents: string | null = null;
  try {
    lockContents = fs.readFileSync(getDaemonPidPath(root), 'utf8');
    identity = decodeLockInfo(lockContents);
  } catch {
    /* no lockfile */
  }
  let pid = identity?.pid ?? null;

  if (pid == null) {
    const rec = listDaemons({ prune: false }).find((r) => path.resolve(r.root) === path.resolve(root));
    pid = rec?.pid ?? null;
    if (rec) identity = rec;
  }

  return { pid, identity, lockContents };
}

/**
 * Stop the daemon serving `root` — SIGTERM, wait, escalate to SIGKILL if
 * needed, then sweep its artifacts. `root` must already be realpath'd so it
 * matches how the daemon itself keyed its socket and lockfile. The pid comes
 * from that lockfile when possible, the registry otherwise.
 */
export async function stopDaemonAt(root: string): Promise<StopResult> {
  const { pid, identity, lockContents } = resolveDaemonIdentity(root);

  if (pid == null) {
    cleanupDaemonArtifacts(root, lockContents);
    return { root, pid: null, outcome: 'no-daemon' };
  }
  if (!isProcessAlive(pid)) {
    const removed = cleanupDaemonArtifacts(root, lockContents);
    return { root, pid, outcome: removed ? 'not-running' : 'unverified' };
  }
  // A live pid alone is never enough to justify signaling it — it could be an
  // unrelated process that inherited a reused pid. The socket hello is what
  // actually proves this pid is our daemon (#1553).
  if (!identity || !canProbeDaemonIdentity(identity)) {
    return { root, pid, outcome: 'unverified' };
  }
  if (!await probeDaemonIdentity(identity)) {
    const removed = cleanupDaemonArtifacts(root, lockContents);
    return { root, pid, outcome: removed ? 'not-running' : 'unverified' };
  }

  // SIGTERM drives the daemon's own graceful shutdown on POSIX. Windows maps
  // it to TerminateProcess instead (no graceful path there), so the artifact
  // sweep below always runs itself rather than trust the daemon to have done it.
  try { process.kill(pid, 'SIGTERM'); } catch { /* raced to exit */ }
  let outcome: StopResult['outcome'] = 'term';
  if (!(await waitForDeath(pid, 3000))) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* raced to exit */ }
    await waitForDeath(pid, 2000);
    outcome = 'kill';
  }
  cleanupDaemonArtifacts(root, lockContents);
  return { root, pid, outcome };
}

/** Stop every registered, live daemon. */
export async function stopAllDaemons(): Promise<StopResult[]> {
  const results: StopResult[] = [];
  for (const rec of await listVerifiedDaemons()) {
    results.push(await stopDaemonAt(rec.root));
  }
  return results;
}
