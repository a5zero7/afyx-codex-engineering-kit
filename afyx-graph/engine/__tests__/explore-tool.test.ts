import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import AfyxGraph from '../src/index';
import {
  allocateExploreBudget,
  getExploreBudget,
  getExploreOutputBudget,
  normalizeQuerySpelling,
  ToolHandler,
} from '../src/mcp/tools';
import { executeExploreTool } from '../src/mcp/explore-tool';
import {
  EXPLORE_EMISSION_KEY,
  EXPLORE_SESSION_VIEW_ARG,
  type ExploreEmission,
} from '../src/mcp/explore-session-state';

type OracleEntry = {
  id: string;
  args: Record<string, unknown>;
  env: Record<string, string | undefined>;
  result: unknown;
  serialized_bytes: number;
  sha256: string;
};

const budgetPoints = [0, 149, 150, 499, 500, 4999, 5000, 14999, 15000, 30000];

function normalizeRoot(value: unknown, root: string): unknown {
  const serialized = JSON.stringify(value)
    .replaceAll(root.replace(/\\/g, '/'), '<ROOT>')
    .replaceAll(root.replace(/\\/g, '\\\\'), '<ROOT>');
  return JSON.parse(serialized);
}

function setEnv(values: Record<string, string | undefined>): () => void {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

describe('MCP Explore adapter ground truth', () => {
  let root: string;
  let graph: AfyxGraph;
  let handler: ToolHandler;
  const records: OracleEntry[] = [];

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'afyx-explore-oracle-'));
    fs.mkdirSync(path.join(root, 'src', 'generated'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'auth.ts'), [
      'export class AuthService {',
      '  validate(token: string) { return token.length > 3; }',
      '  login(token: string) { return this.validate(token); }',
      '}',
      'export function authenticate(token: string) {',
      '  return new AuthService().login(token);',
      '}',
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'src', 'api.ts'), [
      "import { authenticate } from './auth';",
      'export function requestHandler(token: string) {',
      '  return authenticate(token);',
      '}',
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'src', 'worker.ts'), [
      "import { requestHandler } from './api';",
      'export function processJob(token: string) {',
      '  return requestHandler(token);',
      '}',
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'src', 'generated', 'client.generated.ts'), [
      'export function requestHandler(token: string) {',
      '  return token;',
      '}',
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'tests', 'auth.test.ts'), [
      "import { authenticate } from '../src/auth';",
      "export function authSpec() { return authenticate('token'); }",
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'config', 'settings.json'), '{"apiKey":"DO_NOT_LEAK","feature":true}\n');
    graph = AfyxGraph.initSync(root, { config: { include: ['**/*.ts', '**/*.json'], exclude: [] } });
    await graph.indexAll();
    handler = new ToolHandler(graph);
  }, 30_000);

  afterAll(() => {
    try { graph.close(); } catch { /* best effort */ }
    fs.rmSync(root, { recursive: true, force: true });
  });

  async function capture(
    id: string,
    args: Record<string, unknown>,
    env: Record<string, string | undefined> = {},
  ): Promise<OracleEntry> {
    const restore = setEnv(env);
    try {
      const result = await (handler as unknown as {
        handleExplore(input: Record<string, unknown>): Promise<unknown>;
      }).handleExplore(args);
      const normalized = normalizeRoot(result, root);
      const serialized = JSON.stringify(normalized);
      const entry = {
        id,
        args: normalizeRoot(args, root) as Record<string, unknown>,
        env,
        result: normalized,
        serialized_bytes: Buffer.byteLength(serialized),
        sha256: createHash('sha256').update(serialized).digest('hex'),
      };
      records.push(entry);
      return entry;
    } finally {
      restore();
    }
  }

  it('freezes exported policy helpers and allocation fundamentals', () => {
    const budgets = budgetPoints.map((fileCount) => ({
      fileCount,
      calls: getExploreBudget(fileCount),
      output: getExploreOutputBudget(fileCount),
    }));
    expect(budgets.map(({ calls }) => calls)).toEqual([1, 1, 1, 1, 2, 2, 3, 3, 4, 5]);
    expect(budgets.map(({ output }) => output.maxOutputChars)).toEqual([
      13000, 13000, 18000, 18000, 24000, 24000, 24000, 24000, 24000, 24000,
    ]);
    expect(budgets.map(({ output }) => output.defaultMaxFiles)).toEqual([
      4, 4, 5, 5, 8, 8, 8, 8, 8, 8,
    ]);
    expect(normalizeQuerySpelling('cowboy_stream_h:request_process/3')).toBe('cowboy_stream_h.request_process');
    expect(normalizeQuerySpelling('path:src/2fa/api.ts name:requestHandler')).toBe('path:src/2fa/api.ts name:requestHandler');

    const allocation = allocateExploreBudget([
      { path: 'pinned.ts', score: 1, worth: 1, pinned: true, spine: false },
      { path: 'spine.ts', score: 20, worth: 1, pinned: false, spine: true },
      { path: 'weak.ts', score: 0.01, worth: 1, pinned: false, spine: false },
    ], getExploreOutputBudget(1000), 3);
    expect([...allocation.allowances.keys()]).toEqual(['pinned.ts', 'spine.ts']);
    expect(allocation.allowances.get('pinned.ts')).toBe(allocation.allowances.get('spine.ts'));
    expect(allocation.cliffed).toContain('weak.ts');

    const artifact = process.env.AFYX_EXPLORE_POLICY_OUT;
    if (artifact) fs.writeFileSync(artifact, JSON.stringify({ budgets, allocation: {
      ...allocation,
      allowances: [...allocation.allowances],
    } }, null, 2));
  });

  it('captures request, path, maxFiles, adaptive and line-number behavior', async () => {
    const cases: Array<[string, Record<string, unknown>, Record<string, string | undefined>?]> = [
      ['normal', { query: 'authentication request handler' }],
      ['erlang-arity', { query: 'requestHandler/3' }],
      ['erlang-qualified', { query: 'api:requestHandler' }],
      ['field-prefix', { query: 'path:src/api.ts name:requestHandler' }],
      ['pure-path', { query: 'src/auth.ts' }],
      ['path-and-symbol', { query: 'src/auth.ts authenticate' }],
      ['multiple-paths', { query: 'src/auth.ts src/api.ts requestHandler' }],
      ['windows-path', { query: 'src\\auth.ts authenticate' }],
      ['unresolved-path', { query: 'src/missing.ts authenticate' }],
      ['numeric-path', { query: 'src/2fa/missing.ts authenticate' }],
      ['maxfiles-omitted', { query: 'authentication' }],
      ['maxfiles-zero', { query: 'authentication', maxFiles: 0 }],
      ['maxfiles-one', { query: 'authentication', maxFiles: 1 }],
      ['maxfiles-twenty', { query: 'authentication', maxFiles: 20 }],
      ['maxfiles-over', { query: 'authentication', maxFiles: 21 }],
      ['maxfiles-negative', { query: 'authentication', maxFiles: -2 }],
      ['maxfiles-numeric-string', { query: 'authentication', maxFiles: '3' }],
      ['maxfiles-invalid-string', { query: 'authentication', maxFiles: 'bad' }],
      ['maxfiles-nan', { query: 'authentication', maxFiles: Number.NaN }],
      ['line-numbers-default', { query: 'authenticate' }],
      ['line-numbers-off', { query: 'authenticate' }, { AFYX_GRAPH_EXPLORE_LINENUMS: '0' }],
      ['adaptive-default', { query: 'authenticate' }],
      ['adaptive-off', { query: 'authenticate' }, { AFYX_GRAPH_ADAPTIVE_EXPLORE: '0' }],
      ['generated-ranking', { query: 'requestHandler' }],
      ['test-ranking', { query: 'authenticate auth spec' }],
      ['config-secret', { query: 'config/settings.json apiKey' }],
      ['empty', { query: 'symbolThatCannotPossiblyExist' }],
    ];
    for (const [id, args, env] of cases) await capture(id, args, env);

    const configText = JSON.stringify(records.find(({ id }) => id === 'config-secret')!.result);
    expect(configText).not.toContain('DO_NOT_LEAK');
    expect(records.find(({ id }) => id === 'empty')!.result).toHaveProperty(EXPLORE_EMISSION_KEY);
  }, 30_000);

  it('executes through the Afyx-owned seam with host capabilities injected', async () => {
    const args = { query: 'authenticate' };
    const facade = await (handler as unknown as {
      handleExplore(input: Record<string, unknown>): Promise<unknown>;
    }).handleExplore(args);
    const direct = await executeExploreTool(graph, 'authenticate', args, {
      isFileStaleOnDisk: () => false,
      numberSourceLines: (slice, firstLineNumber) => slice
        .split('\n')
        .map((line, index) => `${firstLineNumber + index}\t${line}`)
        .join('\n'),
      synthEdgeNote: () => null,
    });
    expect(normalizeRoot(direct, root)).toEqual(normalizeRoot(facade, root));
  });

  it('captures stale source and cross-call dedup/emission behavior', async () => {
    const first = await capture('dedup-first', { query: 'authenticate' }, { AFYX_GRAPH_EXPLORE_DEDUP: '1' });
    const firstResult = first.result as Record<string, unknown>;
    const emission = firstResult[EXPLORE_EMISSION_KEY] as ExploreEmission;
    expect(emission.files.length).toBeGreaterThan(0);

    const sessionView = {
      projects: [{
        projectRoot: root,
        callCount: 1,
        responseBytes: emission.responseBytes,
        calls: [{ ...emission, index: 1 }],
      }],
    };
    await capture('dedup-repeat', {
      query: 'authenticate',
      [EXPLORE_SESSION_VIEW_ARG]: sessionView,
    }, { AFYX_GRAPH_EXPLORE_DEDUP: '1' });
    await capture('dedup-disabled', {
      query: 'authenticate',
      [EXPLORE_SESSION_VIEW_ARG]: sessionView,
    }, { AFYX_GRAPH_EXPLORE_DEDUP: '0' });
    await capture('other-project-session', {
      query: 'authenticate',
      [EXPLORE_SESSION_VIEW_ARG]: { projects: [{ ...sessionView.projects[0], projectRoot: path.join(root, 'other') }] },
    }, { AFYX_GRAPH_EXPLORE_DEDUP: '1' });

    fs.appendFileSync(path.join(root, 'src', 'auth.ts'), '\nexport const changedAfterIndex = true;\n');
    await capture('stale-file', { query: 'src/auth.ts authenticate' });
    await capture('changed-source-reserved', {
      query: 'authenticate',
      [EXPLORE_SESSION_VIEW_ARG]: sessionView,
    }, { AFYX_GRAPH_EXPLORE_DEDUP: '1' });

    const outputPath = process.env.AFYX_EXPLORE_ORACLE_OUT;
    if (outputPath) fs.writeFileSync(outputPath, JSON.stringify({
      phase: process.env.AFYX_EXPLORE_ORACLE_PHASE ?? 'OLD',
      cases: records,
    }, null, 2));
  }, 30_000);
});
