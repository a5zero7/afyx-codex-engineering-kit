/**
 * Real-SQLite concurrency tests for the WAL checkpoint valve (Phase 3B.4C §13):
 * the deterministic contract in `wal-policy-contract.test.ts` drives the valve against a
 * fake connection, which proves its DECISION logic but cannot prove the thing that logic
 * exists for — that a real reader transaction actually pins WAL frames the way the valve
 * assumes, and that a real `backpressure()` pause actually resolves once that reader lets
 * go. These tests use a real on-disk SQLite database (WAL mode, exactly as the engine
 * configures it), a real second connection holding an open read transaction to pin frames,
 * and the real off-thread `PRAGMA wal_checkpoint` worker — no fake timers, no mocked I/O.
 *
 * Golden-free: these assert real SQLite's documented checkpoint semantics (a passive
 * checkpoint cannot advance past a reader's snapshot; releasing the reader lets a
 * subsequent checkpoint complete), not a recorded contract — the same semantics hold for
 * both the pre-rewrite and Afyx-native valve, since neither one touches SQLite's own WAL
 * mechanics.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseConnection } from '../src/db';
import { QueryBuilder } from '../src/db/queries';
import { WalCheckpointValve } from '../src/db/wal-valve';

const { DatabaseSync } = require('node:sqlite');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Race a promise against a real delay; tells us whether it was STILL pending after that delay. */
async function isStillPendingAfter<T>(promise: Promise<T>, ms: number): Promise<boolean> {
  const marker = Symbol('pending');
  const result = await Promise.race([promise, sleep(ms).then(() => marker)]);
  return result === marker;
}

function insertBatch(q: QueryBuilder, fileIndex: number, count: number): void {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const id = `f${fileIndex}:n${i}`;
    nodes.push({
      id, kind: 'function', name: `sym${fileIndex}_${i}`, qualifiedName: `file${fileIndex}.ts::sym${fileIndex}_${i}`,
      filePath: `src/file${fileIndex}.ts`, language: 'typescript', startLine: i + 1, endLine: i + 2,
      startColumn: 0, endColumn: 1, docstring: `A modest docstring for symbol ${fileIndex}_${i} to give each row real bytes on disk.`,
      updatedAt: Date.now(),
    });
  }
  q.insertNodes(nodes);
}

describe('WAL policy: real-SQLite concurrency (Phase 3B.4C §13)', () => {
  let dir: string;
  let dbPath: string;
  let conn: DatabaseConnection;
  let q: QueryBuilder;

  afterEach(async () => {
    try { conn?.close(); } catch { /* already closed */ }
    await sleep(50); // a just-terminated checkpoint worker can hold the dir briefly on Windows
    try { if (dir) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* best-effort scratch cleanup */ }
  });

  function openWriter(): void {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'afyx-wal-concurrency-'));
    dbPath = path.join(dir, 'graph.db');
    conn = DatabaseConnection.initialize(dbPath);
    q = new QueryBuilder(conn.getDb());
    expect(conn.getJournalMode()).toBe('wal');
  }

  it('a passive checkpoint cannot fully backfill past a reader holding an open read transaction', async () => {
    openWriter();
    insertBatch(q, 0, 200);
    // Pin the WAL at its current tail with a real second connection.
    const reader = new DatabaseSync(dbPath);
    reader.exec('BEGIN;');
    reader.prepare('SELECT COUNT(*) AS n FROM nodes').get();

    insertBatch(q, 1, 400); // writer keeps going past the reader's pinned snapshot
    expect(conn.getWalSizeBytes()).toBeGreaterThan(0);

    const result = await conn.checkpointWalPassive();
    expect(result).not.toBeNull();
    // Real SQLite: with a reader pinning an older snapshot, PASSIVE cannot check every
    // frame back into the main file — it is not a full backfill (log > checkpointed),
    // which is exactly the signal `WalCheckpointValve` relies on to keep retrying.
    expect(result!.log).toBeGreaterThan(result!.checkpointed);

    reader.exec('COMMIT;');
    reader.close();
    const after = await conn.checkpointWalPassive();
    expect(after).not.toBeNull();
    expect(after!.log).toBe(after!.checkpointed); // reader gone: now a full backfill
  }, 20_000);

  it("backpressure() actually stays pending while a reader pins the WAL, and resolves once it lets go", async () => {
    openWriter();
    const valve = new WalCheckpointValve(conn, 0.02); // ~20KB soft -> hard = 40KB, file cap = 80KB
    const reader = new DatabaseSync(dbPath);
    reader.exec('BEGIN;');
    reader.prepare('SELECT COUNT(*) AS n FROM nodes').get();

    insertBatch(q, 0, 2000); // push well past the (tiny) hard cap while the reader pins frames

    const pause = valve.backpressure();
    expect(pause).not.toBeNull();
    await expect(isStillPendingAfter(pause!, 500)).resolves.toBe(true);

    reader.exec('COMMIT;');
    reader.close();
    await expect(pause).resolves.toBeUndefined(); // now resolves for real, no fake clock involved
  }, 20_000);

  it('multiple concurrent readers: ANY one of them still pinning is enough to fail closed; only releasing ALL of them recovers', async () => {
    openWriter();
    const valve = new WalCheckpointValve(conn, 0.02);
    const readers = [0, 1, 2].map(() => {
      const r = new DatabaseSync(dbPath);
      r.exec('BEGIN;');
      r.prepare('SELECT COUNT(*) AS n FROM nodes').get();
      return r;
    });

    insertBatch(q, 0, 2000);
    // Release two of three readers before pausing: a single survivor is still enough to pin
    // every frame, so the real 20-pass retry budget exhausts and the valve fails closed —
    // proving partial reader release does NOT fool the backfill loop.
    readers[0].exec('COMMIT;'); readers[0].close();
    readers[1].exec('COMMIT;'); readers[1].close();
    await expect(valve.backpressure()).rejects.toThrow(/reader is pinning the WAL|checkpoint cannot progress/);

    // Now release the last one and try again: with no reader left, a fresh pause resolves.
    readers[2].exec('COMMIT;'); readers[2].close();
    await expect(valve.backpressure()).resolves.toBeUndefined();
  }, 20_000);

  it('shutdown after concurrent use: stop() + drain() settles cleanly with a live timer and a real pause in flight', async () => {
    openWriter();
    const valve = new WalCheckpointValve(conn, 0.02, 40); // 40ms tick: several real timer fires during the test
    const reader = new DatabaseSync(dbPath);
    reader.exec('BEGIN;');
    reader.prepare('SELECT COUNT(*) AS n FROM nodes').get();

    valve.start();
    insertBatch(q, 0, 2000);
    await sleep(150); // let a few real timer ticks fire and start a passive pass against the pinned reader

    const pause = valve.backpressure(); // now also parks the writer behind the same pinned reader
    valve.stop(); // "close while pressure exists": stop the timer without waiting for anything to settle

    reader.exec('COMMIT;');
    reader.close();
    await valve.drain(); // must settle: no leaked pending pause/inflight after the reader lets go
    if (pause) await pause;

    expect(() => conn.close()).not.toThrow(); // the connection closes cleanly afterward
  }, 20_000);

  it('Windows file-handle lifecycle: open, write past soft, checkpoint-or-defer, close, delete, reopen, replace', async () => {
    openWriter();
    const valve = new WalCheckpointValve(conn, 0.02, 2000);
    valve.start();
    insertBatch(q, 0, 500); // past the tiny soft threshold: a background PASSIVE pass gets scheduled
    await valve.foldNow(); // fold whatever's pending before we start closing/deleting handles
    valve.stop();
    await valve.drain();

    expect(() => conn.close()).not.toThrow(); // close while no reader/writer handle is outstanding

    // Delete the WAL/SHM sidecars (a killed-process / manual-cleanup scenario) then reopen: the
    // main .db file alone must still open cleanly, with no dangling handle from the closed
    // connection blocking the delete (Windows: an open handle makes unlink fail; #925's territory).
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${dbPath}${suffix}`;
      if (fs.existsSync(sidecar)) expect(() => fs.unlinkSync(sidecar)).not.toThrow();
    }
    const reopened = DatabaseConnection.open(dbPath);
    expect(reopened.getSchemaVersion()).not.toBeNull();
    reopened.close();

    // Replace-after-close: delete the whole DB and initialize a fresh one at the same path,
    // proving the prior connection's close() left no handle pinning the old inode either.
    fs.rmSync(dbPath, { force: true });
    fs.rmSync(`${dbPath}-wal`, { force: true });
    fs.rmSync(`${dbPath}-shm`, { force: true });
    const fresh = DatabaseConnection.initialize(dbPath);
    // A brand-new file already has a little schema-creation WAL activity, so at this tiny
    // 20KB soft threshold backpressure() may briefly pause rather than return null outright;
    // either way it must settle cleanly, never throw or hang.
    const freshValve = new WalCheckpointValve(fresh, 0.02);
    const freshPause = freshValve.backpressure();
    if (freshPause) await freshPause; // must settle cleanly either way; a throw here fails the test
    fresh.close();
    conn = fresh; // let afterEach's conn?.close() no-op cleanly (already closed)
  }, 20_000);
});
