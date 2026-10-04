import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initGrammars } from '../src/extraction/grammars';
import { guardsInSource } from '../src/graph/branch-guards';
import type { Language } from '../src/types';

const originalGate = process.env.AFYX_GRAPH_NATIVE_PARSER;

beforeAll(async () => {
  await initGrammars();
});

afterEach(() => {
  if (originalGate === undefined) delete process.env.AFYX_GRAPH_NATIVE_PARSER;
  else process.env.AFYX_GRAPH_NATIVE_PARSER = originalGate;
});

const source = `
function route(mode, ready) {
  if (!ready) return
  if (mode === 'a') {
    first()
  } else {
    second()
  }
  switch (mode) {
    case 'b': third(); break
    default: fourth()
  }
  const value = ready ? yes() : no()
  ready && later()
  try { risky() } catch (error) { report(error) }
}
`;

const sites = ['first()', 'second()', 'third()', 'fourth()', 'yes()', 'no()', 'later()', 'report(error)'];
const languages: readonly Language[] = ['typescript', 'tsx', 'javascript', 'jsx'];

async function results(language: Language, native: boolean) {
  if (native) process.env.AFYX_GRAPH_NATIVE_PARSER = '1';
  else delete process.env.AFYX_GRAPH_NATIVE_PARSER;
  const lines = source.split('\n');
  return Promise.all(sites.map(async (site) => {
    const row = lines.findIndex((line) => line.includes(site));
    const guards = await guardsInSource(source, language, row + 1, lines[row]!.indexOf(site));
    return guards.map(({ text, negated, form, line, branch, armExit, exit }) => ({
      text, negated, form, line, branch, armExit: armExit ?? null, exit: exit ?? null,
    }));
  }));
}

describe('native branch guard differential', () => {
  for (const language of languages) {
    it(`${language}: preserves guard structure and metadata`, async () => {
      const native = await results(language, true);
      const baseline = await results(language, false);
      for (let index = 0; index < sites.length; index += 1) {
        expect(native[index], sites[index]).toEqual(baseline[index]);
      }
    });
  }
});
