import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env.AFYX_GRAPH_PRODUCT = '1';
  delete process.env.AFYX_GRAPH_DIR;
  delete process.env.CODEGRAPH_DIR;
  delete process.env.CODEGRAPH_MCP_TOOLS;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('Afyx Graph compatibility surface', () => {
  it('publishes the canonical MCP identity and tool prefix', async () => {
    const [{ SERVER_INFO }, { getStaticTools }, { engineToolName, publicToolName }] = await Promise.all([
      import('../src/mcp/session'),
      import('../src/mcp/tools'),
      import('../src/product'),
    ]);
    expect(SERVER_INFO.name).toBe('afyx_graph');
    expect(getStaticTools().length).toBeGreaterThan(0);
    expect(getStaticTools().every((tool) => tool.name.startsWith('afyx_graph_'))).toBe(true);
    expect(engineToolName('afyx_graph_explore')).toBe('codegraph_explore');
    expect(engineToolName('codegraph_explore')).toBe('codegraph_explore');
    expect(publicToolName('codegraph_explore')).toBe('afyx_graph_explore');
  });

  it('maps canonical environment settings without overriding legacy settings', async () => {
    process.env.AFYX_GRAPH_DIR = '.canonical-state';
    process.env.CODEGRAPH_DIR = '.legacy-explicit';
    const { codeGraphDirName } = await import('../src/directory');
    expect(codeGraphDirName()).toBe('.legacy-explicit');
  });

  it('prefers .afyx-graph but adopts an existing .codegraph in place', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afyx-graph-state-'));
    try {
      const { getCodeGraphDir } = await import('../src/directory');
      expect(getCodeGraphDir(root)).toBe(path.join(root, '.afyx-graph'));
      fs.mkdirSync(path.join(root, '.codegraph'));
      expect(getCodeGraphDir(root)).toBe(path.join(root, '.codegraph'));
      fs.mkdirSync(path.join(root, '.afyx-graph'));
      expect(getCodeGraphDir(root)).toBe(path.join(root, '.afyx-graph'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
