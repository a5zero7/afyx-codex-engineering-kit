/**
 * Path and identity helpers for the shared daemon's IPC surface (issue #411).
 *
 * One daemon per project root means every cooperating process needs a
 * stable, project-keyed way to find it. That surface is exactly two paths:
 *
 *   - `daemon.sock` — the Unix-domain socket (a named pipe on Windows) the
 *     daemon listens on.
 *   - `daemon.pid` — the atomically-created lockfile holding its pid and version.
 *
 * Both live under `.afyx-graph/`, so a project-scoped `afyx-graph uninit`
 * sweeps them up for free, with no special-casing needed.
 *
 * Two platform hazards complicate the socket path specifically:
 *
 *   1. Unix-domain socket paths have a hard length ceiling (roughly 104 bytes
 *      on macOS, 108 on Linux). When the in-project path would exceed it,
 *      binding falls back to a hashed path under `os.tmpdir()` instead. The
 *      pidfile has no such limit and always stays in the project, acting as
 *      the authoritative record of whichever socket path the daemon actually
 *      chose.
 *   2. Some filesystems can't host an AF_UNIX node at all — ExFAT/FAT
 *      external volumes, some network mounts, WSL2 DrvFs — and `listen()`
 *      there throws ENOTSUP/EACCES regardless of path length (#997, #974).
 *      Telling those apart from an ordinary volume ahead of time isn't
 *      cheap, so rather than guess, {@link getDaemonSocketCandidates}
 *      exposes an ORDERED list: the in-project path first, the deterministic
 *      tmpdir path as the last resort. The daemon binds the first candidate
 *      that works, relocating past anything that fails for a capability
 *      reason; the proxy connects to the first one that answers. Both walk
 *      the exact same list, so they converge on whichever the daemon
 *      actually bound with no coordination between them at all.
 */

import * as crypto from 'crypto';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { getAfyxGraphDir } from '../directory';

/** Soft ceiling for an in-project socket path before it's considered too long to risk. */
const POSIX_SOCKET_PATH_LIMIT = 100;

/** Short, stable, project-scoped identifier — the basis for both the tmpdir path and the Windows pipe name. */
function projectHash(projectRoot: string): string {
  return crypto.createHash('sha256').update(path.resolve(projectRoot)).digest('hex').slice(0, 16);
}

function windowsPipeName(projectRoot: string): string {
  return `\\\\.\\pipe\\afyx-graph-${projectHash(projectRoot)}`;
}

/**
 * The deterministic tmpdir socket path for `projectRoot` — the fallback for
 * an in-project location that can't host a socket (too long a path, or a
 * filesystem without AF_UNIX support). Being a pure function of the project
 * root, purely hash-derived, means the daemon and every proxy compute the
 * identical path independently, without ever needing to tell each other
 * what they picked.
 */
function tmpdirSocketPath(projectRoot: string): string {
  return path.join(os.tmpdir(), `afyx-graph-${projectHash(projectRoot)}.sock`);
}

function inProjectSocketPath(projectRoot: string): string {
  return path.join(getAfyxGraphDir(projectRoot), 'daemon.sock');
}

/**
 * The ordered list of socket (or named-pipe) paths the daemon should try to
 * bind, and the proxy should try to connect, for `projectRoot` — most
 * preferred first. A pure function of the root, so independent processes
 * converge on the same choice with no coordination, even when the preferred
 * candidate turns out to be unusable and both fall through to the same
 * fallback:
 *
 *   - **Windows** gets exactly one candidate: a named pipe. It lives in the
 *     kernel's own pipe namespace rather than on the project's filesystem,
 *     so neither the length limit nor the ExFAT hazard below applies to it.
 *   - A **short in-project path** yields `[daemon.sock, <tmpdir path>]` — try
 *     the project location first, fall back to tmpdir only if that
 *     filesystem can't host a socket at all (#997).
 *   - A **long in-project path** (deep monorepos, Bazel-style out dirs)
 *     yields `[<tmpdir path>]` alone — binding it would throw ENAMETOOLONG,
 *     so candidates skip straight to tmpdir instead of trying and failing first.
 */
export function getDaemonSocketCandidates(projectRoot: string): string[] {
  if (process.platform === 'win32') return [windowsPipeName(projectRoot)];
  const inProject = inProjectSocketPath(projectRoot);
  if (inProject.length > POSIX_SOCKET_PATH_LIMIT) return [tmpdirSocketPath(projectRoot)];
  return [inProject, tmpdirSocketPath(projectRoot)];
}

/**
 * The single PREFERRED socket path — candidate 0 — for callers that only
 * want one representative path (the lockfile's informational `socketPath`
 * field, a status display). Binding or connecting should instead walk the
 * full {@link getDaemonSocketCandidates} list, since the daemon may have
 * bound a fallback candidate when this one turned out to be unusable.
 */
export function getDaemonSocketPath(projectRoot: string): string {
  // The candidate list is never empty on any platform, so index 0 is safe.
  return getDaemonSocketCandidates(projectRoot)[0]!;
}

/** Absolute path to the daemon's pid lockfile for `projectRoot`. */
export function getDaemonPidPath(projectRoot: string): string {
  return path.join(getAfyxGraphDir(projectRoot), 'daemon.pid');
}

/** The structured contents of the pid lockfile. */
export interface DaemonLockInfo {
  pid: number;
  version: string;
  socketPath: string;
  startedAt: number;
}

/** Whether a lock record carries enough identity information to attempt a socket-hello probe at all. */
export function canProbeDaemonIdentity(info: DaemonLockInfo): boolean {
  return Number.isInteger(info.pid) && info.pid > 0 && typeof info.socketPath === 'string' && info.socketPath.length > 0;
}

const IDENTITY_PROBE_TIMEOUT_MS = 1_000;
const IDENTITY_PROBE_MAX_HELLO_BYTES = 4096;

function helloMatchesLockRecord(hello: Record<string, unknown>, info: DaemonLockInfo): boolean {
  return hello.protocol === 1
    && hello.pid === info.pid
    && (info.version === 'unknown' || hello.afyxGraph === info.version);
}

/**
 * Confirm that the process a lockfile names is actually the Afyx Graph
 * daemon serving the socket it claims to. A bare pid-liveness check can't
 * establish this on its own — the OS can and does reuse pids after an
 * OOM-kill or SIGKILL (#1553), so only a real socket hello proves identity.
 */
export function probeDaemonIdentity(info: DaemonLockInfo, timeoutMs = IDENTITY_PROBE_TIMEOUT_MS): Promise<boolean> {
  if (!canProbeDaemonIdentity(info)) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let received = '';
    let socket: net.Socket;

    const settle = (matched: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(matched);
    };

    const onData = (chunk: string): void => {
      received += chunk;
      if (received.length > IDENTITY_PROBE_MAX_HELLO_BYTES) return settle(false);
      const newlineAt = received.indexOf('\n');
      if (newlineAt < 0) return;
      try {
        settle(helloMatchesLockRecord(JSON.parse(received.slice(0, newlineAt)) as Record<string, unknown>, info));
      } catch {
        settle(false);
      }
    };

    const timer = setTimeout(() => settle(false), timeoutMs);
    timer.unref?.();

    try {
      socket = net.createConnection(info.socketPath);
    } catch {
      clearTimeout(timer);
      resolve(false);
      return;
    }
    socket.setEncoding('utf8');
    socket.on('data', onData);
    socket.on('error', () => settle(false));
    socket.on('close', () => settle(false));
  });
}

/**
 * Serialize a {@link DaemonLockInfo} for the pidfile. Pretty-printed JSON —
 * an operator occasionally `cat`s this file directly while debugging, and
 * readability there costs nothing.
 */
export function encodeLockInfo(info: DaemonLockInfo): string {
  return JSON.stringify(info, null, 2) + '\n';
}

function decodeStructuredLockInfo(parsed: unknown): DaemonLockInfo | null {
  if (
    parsed &&
    typeof (parsed as Record<string, unknown>).pid === 'number' &&
    typeof (parsed as Record<string, unknown>).version === 'string' &&
    typeof (parsed as Record<string, unknown>).socketPath === 'string' &&
    typeof (parsed as Record<string, unknown>).startedAt === 'number'
  ) {
    return parsed as DaemonLockInfo;
  }
  return null;
}

/** A bare positive decimal integer — the shape of a pre-#411 plain-pid lockfile, e.g. `"12345"`. */
const LEGACY_PLAIN_PID_PATTERN = /^[1-9]\d*$/;

function decodeLegacyPlainPidLockInfo(trimmed: string): DaemonLockInfo | null {
  if (!LEGACY_PLAIN_PID_PATTERN.test(trimmed)) return null;
  const pid = Number(trimmed);
  if (!Number.isSafeInteger(pid)) return null;
  return { pid, version: 'unknown', socketPath: '', startedAt: 0 };
}

/**
 * Parse a pidfile's contents, tolerating the old plain-decimal-pid format so
 * a newer daemon never trips over a lockfile an older one left behind — such
 * a record decodes as "an unknown-version process", which the caller treats
 * as not safe to share.
 *
 * The legacy parser runs whenever the structured decode comes back null,
 * which happens for two different reasons: the text isn't valid JSON at all,
 * OR it parses fine but isn't shaped like a lock record. That second case
 * matters because a bare `"42"` IS valid JSON — it parses to the number 42
 * without throwing — so the fallback has to trigger on a failed shape match
 * too, not only on a parse exception.
 */
export function decodeLockInfo(raw: string): DaemonLockInfo | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let structured: DaemonLockInfo | null = null;
  try {
    structured = decodeStructuredLockInfo(JSON.parse(trimmed));
  } catch {
    structured = null;
  }
  return structured ?? decodeLegacyPlainPidLockInfo(trimmed);
}
