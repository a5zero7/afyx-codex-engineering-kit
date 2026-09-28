/**
 * Decision logic behind the PPID watchdog (issues #277, #692): detect that
 * whatever this process depends on for supervision — its parent, or an MCP
 * host reached past an intermediate launcher shim — has died, so an orphaned
 * proxy or direct-mode server shuts itself down instead of leaking forever.
 *
 * A parent's death is visible in a different way on each OS, and getting
 * that distinction wrong is exactly what let daemons/proxies leak unbounded
 * on Windows (#692, #576):
 *
 *   - On **POSIX**, an orphan gets reparented to init (pid 1), so
 *     `process.ppid` changes the instant the parent goes away — that
 *     divergence is the original #277 signal.
 *   - **Windows** never reparents at all: `process.ppid` keeps naming the
 *     original, now-dead parent forever, so a change-based check can never
 *     fire there. The only option on Windows is polling that original
 *     parent's liveness directly.
 *
 * That liveness fallback stays gated to Windows specifically: on POSIX, a
 * double-forked grandparent can legitimately outlive the reparent step, so a
 * dead `originalPpid` there is NOT proof of orphaning — the ppid-change check
 * is already the correct, sufficient signal on POSIX, and layering a
 * liveness check on top would risk a false-positive shutdown.
 */
export interface SupervisionState {
  /** `process.ppid` as captured at process startup. */
  originalPpid: number;
  /** `process.ppid` as of right now. */
  currentPpid: number;
  /**
   * The MCP host's pid, threaded through an intermediate launcher shim via
   * `AFYX_GRAPH_HOST_PPID`, or null when there wasn't one to thread — e.g.
   * the standalone bundle, which pre-bakes `--liftoff-only` and so never runs
   * the relaunch step that would have set it.
   */
  hostPpid: number | null;
  /** Liveness probe: `process.kill(pid, 0)` for real, a stub in tests. */
  isAlive: (pid: number) => boolean;
  /** Defaults to `process.platform` when omitted. */
  platform?: NodeJS.Platform;
}

/**
 * The reason supervision was lost, if it was — a human-readable string once
 * this process should shut down, or null while still supervised.
 */
export function supervisionLostReason(state: SupervisionState): string | null {
  const { originalPpid, currentPpid, hostPpid, isAlive } = state;
  const platform = state.platform ?? process.platform;

  // The reparent-on-death signal — POSIX only, since ppid never moves on Windows.
  if (currentPpid !== originalPpid) {
    return `ppid ${originalPpid} -> ${currentPpid}`;
  }
  // The Windows fallback: ppid can't move, so its liveness stands in for it.
  // Pids 0 and 1 ("unknown" and init) are excluded — neither is ever a real
  // Windows parent, and probing them must never be able to trigger a shutdown.
  if (platform === 'win32' && originalPpid > 1 && !isAlive(originalPpid)) {
    return `parent pid ${originalPpid} exited`;
  }
  // Applies on either platform: the host pid threaded past a launcher shim has died.
  if (hostPpid !== null && !isAlive(hostPpid)) {
    return `host pid ${hostPpid} exited`;
  }
  return null;
}

/** Default poll cadence for the watchdog, in ms — shared by the MCP server and the CLI's own command supervision. */
export const DEFAULT_PPID_POLL_MS = 5000;

/**
 * Resolve the watchdog's poll interval from its env override
 * (`AFYX_GRAPH_PPID_POLL_MS`). `0` is the explicit escape hatch that disables
 * the watchdog entirely — for an embedded scenario where the parent
 * deliberately re-parents the process on purpose. Anything non-numeric or
 * negative just falls back to the default cadence.
 */
export function parsePpidPollMs(raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_PPID_POLL_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_PPID_POLL_MS;
  if (parsed < 0) return DEFAULT_PPID_POLL_MS;
  return Math.floor(parsed);
}

/**
 * Parse the host pid carried across the `--liftoff-only` re-exec
 * (`AFYX_GRAPH_HOST_PPID`). A positive integer pid, or null when unset or
 * invalid — the direct-launch path, where the watchdog has nothing to fall
 * back on but plain `process.ppid` divergence. Pids 0 and 1 are rejected (0
 * is "unknown", 1 is init — i.e. already orphaned), so the watchdog can never
 * latch onto init itself as if it were a real host.
 */
export function parseHostPpid(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 1) return null;
  return parsed;
}

export interface PpidWatchdogOptions {
  /** `process.ppid` (or the CLI entry's earliest capture) at startup. */
  originalPpid: number;
  /** The threaded host pid (`AFYX_GRAPH_HOST_PPID`), or null when unknown. */
  hostPpid: number | null;
  /** Liveness probe — `process.kill(pid, 0)` in production, stubbed in tests. */
  isAlive: (pid: number) => boolean;
  /** Raw `AFYX_GRAPH_PPID_POLL_MS` value to parse; omit to use the default cadence. */
  pollMsRaw?: string;
}

/**
 * Install the live PPID-watchdog timer: poll at the configured cadence and
 * invoke `onLost(reason)` the moment {@link supervisionLostReason} reports
 * one. Returns null (no timer armed) when polling is disabled
 * (`AFYX_GRAPH_PPID_POLL_MS=0`) — the caller then has nothing to clear.
 * Unref'd so it never keeps the event loop alive on its own. Shared by every
 * consumer that needs the live timer (the direct-mode server, both proxy
 * variants) so the wiring — not just the decision logic above — has one home.
 */
export function installPpidWatchdog(
  onLost: (reason: string) => void,
  opts: PpidWatchdogOptions,
): NodeJS.Timeout | null {
  const pollMs = parsePpidPollMs(opts.pollMsRaw);
  if (pollMs <= 0) return null;
  const timer = setInterval(() => {
    const reason = supervisionLostReason({
      originalPpid: opts.originalPpid,
      currentPpid: process.ppid,
      hostPpid: opts.hostPpid,
      isAlive: opts.isAlive,
    });
    if (reason) onLost(reason);
  }, pollMs);
  timer.unref?.();
  return timer;
}
