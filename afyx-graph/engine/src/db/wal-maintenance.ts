/**
 * WAL upkeep for one database: checkpoints, oversized-log healing, post-write maintenance.
 *
 * All of the heavy work runs on a worker thread with its own connection. On a
 * multi-gigabyte index a checkpoint or `PRAGMA optimize` is minutes of synchronous I/O,
 * long enough to trip the 60 s liveness watchdog (#850) and get a healthy — even a
 * finished — index killed. The main thread only awaits a message, so the event loop and
 * the watchdog heartbeat keep turning. Checkpointing from a second connection is
 * ordinary SQLite, and `optimize` persists its statistics in `sqlite_stat*`, which the
 * main connection then uses too. Everything here is best effort: a failure degrades to
 * "nothing happened", never to an exception.
 */

import * as fs from 'fs';
import type { SqliteDatabase } from './sqlite-adapter';
import { WAL_HEAL_THRESHOLD_BYTES } from './connection-tuning';

/** `PRAGMA wal_checkpoint` outcome: `log === checkpointed` with `busy === 0` means the whole log was folded back. */
export interface CheckpointResult {
  busy: number;
  log: number;
  checkpointed: number;
}

export interface WalHealResult {
  healed: boolean;
  beforeBytes: number;
  afterBytes: number;
}

type CheckpointMode = 'PASSIVE' | 'TRUNCATE';

const checkpointOutcome = (row: Record<string, number> | null | undefined): CheckpointResult | null =>
  row ? { busy: Number(row.busy), log: Number(row.log), checkpointed: Number(row.checkpointed) } : null;

/** Worker body for one checkpoint: open, checkpoint, close, report the row or the error. */
const CHECKPOINT_WORKER = `
  const { workerData, parentPort } = require('node:worker_threads');
  let row = null;
  let err = null;
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(workerData.dbPath);
    const mode = workerData.mode === 'TRUNCATE' ? 'TRUNCATE' : 'PASSIVE';
    try {
      // A truncate that loses a race with a reader should give up quickly, not stall.
      if (mode === 'TRUNCATE') db.exec('PRAGMA busy_timeout = 2000');
      row = db.prepare('PRAGMA wal_checkpoint(' + mode + ')').get();
    } catch (e) { err = String(e && e.message || e); }
    try { db.close(); } catch {}
  } catch (e) { err = err || String(e && e.message || e); }
  parentPort.postMessage({ row, err });
`;

/** Worker body for a list of best-effort pragmas. */
const PRAGMA_WORKER = `
  const { workerData, parentPort } = require('node:worker_threads');
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(workerData.dbPath);
    for (const pragma of workerData.pragmas) { try { db.exec(pragma); } catch {} }
    try { db.close(); } catch {}
  } catch {}
  parentPort.postMessage('done');
`;

export class WalMaintenance {
  private healing: Promise<WalHealResult> | null = null;

  constructor(
    private readonly db: SqliteDatabase,
    private readonly dbPath: string
  ) {}

  private get isMemory(): boolean {
    return !this.dbPath || this.dbPath === ':memory:';
  }

  /** Size of the `-wal` sidecar; 0 when absent (non-WAL mode, in-memory, or nothing written since the last reset). */
  walSizeBytes(): number {
    if (this.isMemory) return 0;
    try {
      return fs.statSync(`${this.dbPath}-wal`).size;
    } catch {
      return 0;
    }
  }

  /** Checkpoint off-thread. Null on any failure, including worker threads being unavailable. */
  async checkpoint(mode: CheckpointMode): Promise<CheckpointResult | null> {
    if (this.isMemory) {
      try {
        return checkpointOutcome(this.db.prepare(`PRAGMA wal_checkpoint(${mode})`).get() as Record<string, number> | undefined);
      } catch {
        return null;
      }
    }
    try {
      const { Worker } = await import('node:worker_threads');
      return await new Promise<CheckpointResult | null>((resolve) => {
        let settled = false;
        const settle = (row?: Record<string, number> | null): void => {
          if (settled) return;
          settled = true;
          resolve(checkpointOutcome(row));
        };
        try {
          const worker = new Worker(CHECKPOINT_WORKER, { eval: true, workerData: { dbPath: this.dbPath, mode } });
          worker.once('message', (message: { row?: Record<string, number> | null; err?: string | null }) => {
            if (message?.err && process.env.AFYX_GRAPH_WAL_VALVE_DEBUG) console.error(`[wal-valve] checkpoint worker (${mode}): ${message.err}`);
            void worker.terminate();
            settle(message?.row ?? null);
          });
          worker.once('error', () => { void worker.terminate(); settle(null); });
          worker.once('exit', () => settle(null));
        } catch {
          settle(null);
        }
      });
    } catch {
      return null;
    }
  }

  /**
   * Shrink a WAL a killed session left oversized. Runs a passive fold, then a truncate,
   * both on worker connections with a busy timeout; a racing writer turns the attempt
   * into a no-op that the next open retries. Cost when healthy: one `stat`.
   *
   * Single flight: `open()` fires this without awaiting and callers may also invoke it
   * explicitly, and two concurrent passes defeat each other (each checkpoint sees the
   * other as a busy reader and gives up), so they share one in-flight pass.
   */
  async healOversized(): Promise<WalHealResult> {
    const beforeBytes = this.walSizeBytes();
    if (beforeBytes <= WAL_HEAL_THRESHOLD_BYTES) return { healed: false, beforeBytes, afterBytes: beforeBytes };
    this.healing ??= this.shrink(beforeBytes).finally(() => { this.healing = null; });
    return this.healing;
  }

  private async shrink(beforeBytes: number): Promise<WalHealResult> {
    // A concurrent reader or writer degrades a pass to a busy no-op; retry a few times.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 300));
      await this.checkpoint('PASSIVE');
      await this.checkpoint('TRUNCATE');
      if (this.walSizeBytes() <= WAL_HEAL_THRESHOLD_BYTES) break;
    }
    const afterBytes = this.walSizeBytes();
    if (process.env.AFYX_GRAPH_WAL_VALVE_DEBUG) {
      console.error(`[wal-heal] oversized WAL at open: ${Math.round(beforeBytes / (1024 * 1024))}MB -> ${Math.round(afterBytes / (1024 * 1024))}MB`);
    }
    return { healed: afterBytes < beforeBytes, beforeBytes, afterBytes };
  }

  /**
   * Lightweight upkeep after bulk writes: `PRAGMA optimize` (incremental ANALYZE — freshly
   * loaded tables otherwise have no planner statistics) and a passive checkpoint (the
   * WAL would grow unbounded between auto-checkpoints on a large index run).
   *
   * If worker threads are unavailable, only a bounded in-line `optimize` runs and the
   * checkpoint is skipped; the final close checkpoints after the CLI has disarmed its
   * watchdog.
   */
  async run(): Promise<void> {
    if (this.isMemory) {
      try { this.db.exec('PRAGMA optimize'); } catch { /* best effort */ }
      try { this.db.exec('PRAGMA wal_checkpoint(PASSIVE)'); } catch { /* best effort */ }
      return;
    }
    await this.runOffThread(
      ['PRAGMA analysis_limit=1000', 'PRAGMA optimize', 'PRAGMA wal_checkpoint(PASSIVE)'],
      ['PRAGMA analysis_limit=1000', 'PRAGMA optimize']
    );
  }

  /** Run pragmas on a worker connection; `inline` runs on this connection only when workers are unavailable. */
  private async runOffThread(pragmas: string[], inline: string[]): Promise<void> {
    try {
      const { Worker } = await import('node:worker_threads');
      await new Promise<void>((resolve) => {
        let settled = false;
        const settle = (): void => {
          if (!settled) { settled = true; resolve(); }
        };
        try {
          const worker = new Worker(PRAGMA_WORKER, { eval: true, workerData: { dbPath: this.dbPath, pragmas } });
          worker.once('message', () => { void worker.terminate(); settle(); });
          worker.once('error', () => { void worker.terminate(); settle(); });
          worker.once('exit', settle);
        } catch {
          settle();
        }
      });
    } catch {
      for (const pragma of inline) {
        try { this.db.exec(pragma); } catch { /* best effort */ }
      }
    }
  }
}
