import { afterEach, describe, expect, it } from 'vitest';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
// @ts-expect-error JavaScript module has no declaration file.
import { createDeterministicArchive } from '../scripts/deterministic-archive.mjs';

const roots: string[] = [];

function fixture(order: string[], timestamp: Date): string {
  const parent = mkdtempSync(join(tmpdir(), 'afyx-archive-'));
  roots.push(parent);
  const root = join(parent, 'afyx-graph-win32-x64');
  mkdirSync(root);
  for (const relative of order) {
    const file = join(root, ...relative.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `content:${relative}\n`);
    chmodSync(file, relative.startsWith('bin/') ? 0o755 : 0o644);
    utimesSync(file, timestamp, timestamp);
  }
  return root;
}

function digest(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('deterministic distribution archives', () => {
  it.each([
    ['win32-x64', 'bundle.zip'],
    ['linux-x64', 'bundle.tar.gz'],
    ['darwin-x64', 'bundle.tar.gz'],
  ])('normalizes order, timestamps and host metadata for %s', (target, name) => {
    const files = ['metadata.json', 'lib/dist/index.js', 'bin/afyx-graph'];
    const first = fixture(files, new Date('2020-01-01T00:00:00Z'));
    const second = fixture([...files].reverse(), new Date('2024-06-01T12:34:56Z'));
    const firstArchive = join(first, '..', `first-${name}`);
    const secondArchive = join(second, '..', `second-${name}`);
    createDeterministicArchive({ source: first, target, output: firstArchive });
    createDeterministicArchive({ source: second, target, output: secondArchive });
    expect(digest(firstArchive)).toBe(digest(secondArchive));
  });

  it.skipIf(process.platform === 'win32')('fails closed when staged content contains a symlink', () => {
    const root = fixture(['metadata.json'], new Date('2020-01-01T00:00:00Z'));
    symlinkSync(join(root, 'metadata.json'), join(root, 'linked-metadata.json'));
    expect(() => createDeterministicArchive({
      source: root,
      target: 'win32-x64',
      output: join(root, '..', 'unsafe.zip'),
    })).toThrow(/must not contain symlinks/);
  });

  it('rejects unsupported targets before writing an archive', () => {
    const root = fixture(['metadata.json'], new Date('2020-01-01T00:00:00Z'));
    expect(() => createDeterministicArchive({
      source: root,
      target: 'unsupported-x64',
      output: join(root, '..', 'unsupported.bin'),
    })).toThrow(/unsupported target/);
  });

  it('rejects output inside the source tree', () => {
    const root = fixture(['metadata.json'], new Date('2020-01-01T00:00:00Z'));
    expect(() => createDeterministicArchive({
      source: root,
      target: 'win32-x64',
      output: join(root, 'self.zip'),
    })).toThrow(/outside the source tree/);
  });
});
