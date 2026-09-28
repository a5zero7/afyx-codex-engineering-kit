import { createHash } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MCPSession, PROTOCOL_VERSION, SERVER_INFO } from '../src/mcp/session';
import { ToolHandler, getStaticTools, tools, type ToolResult } from '../src/mcp/tools';
import {
  ErrorCodes,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcTransport,
  type MessageHandler,
} from '../src/mcp/transport';
import type { MCPEngine } from '../src/mcp/engine';

const MCP_TOOLS_ENV = 'AFYX_GRAPH_MCP_TOOLS';
const EXPECTED_TOOL_NAMES = [
  'afyx_graph_search',
  'afyx_graph_callers',
  'afyx_graph_callees',
  'afyx_graph_impact',
  'afyx_graph_node',
  'afyx_graph_explore',
  'afyx_graph_status',
  'afyx_graph_files',
];

class RecordingTransport implements JsonRpcTransport {
  private handler: MessageHandler | null = null;
  readonly responses: JsonRpcResponse[] = [];

  start(handler: MessageHandler): void { this.handler = handler; }
  stop(): void { this.handler = null; }
  send(response: JsonRpcResponse): void { this.responses.push(response); }
  notify(): void { /* server notifications are not used by MCPSession */ }
  request(): Promise<unknown> { return Promise.resolve({ roots: [] }); }
  sendResult(id: string | number, result: unknown): void {
    this.send({ jsonrpc: '2.0', id, result });
  }
  sendError(id: string | number | null, code: number, message: string, data?: unknown): void {
    this.send({ jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } });
  }

  async receive(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    if (!this.handler) throw new Error('transport not started');
    await this.handler(message);
  }
}

function sessionHarness() {
  const transport = new RecordingTransport();
  const result: ToolResult = { content: [{ type: 'text', text: 'handled' }] };
  const handler = {
    getTools: vi.fn(() => tools),
    execute: vi.fn(async () => result),
  };
  const engine = {
    hasDefaultAfyxGraph: vi.fn(() => true),
    getProjectPath: vi.fn(() => null),
    getToolHandler: vi.fn(() => handler),
    ensureInitialized: vi.fn(async () => undefined),
    retryInitializeSync: vi.fn(),
  } as unknown as MCPEngine;
  const session = new MCPSession(transport, engine);
  session.start();
  return { transport, handler };
}

describe('MCP public semantic contract', () => {
  const originalToolsEnv = process.env[MCP_TOOLS_ENV];

  afterEach(() => {
    if (originalToolsEnv === undefined) delete process.env[MCP_TOOLS_ENV];
    else process.env[MCP_TOOLS_ENV] = originalToolsEnv;
  });

  it('freezes the complete tool catalog, schemas, descriptions, annotations, and metadata', () => {
    expect(tools.map((tool) => tool.name)).toEqual(EXPECTED_TOOL_NAMES);
    expect(createHash('sha256').update(JSON.stringify(tools)).digest('hex'))
      .toBe('4eaa5a29a1f93bcee7d6b9a77605aa221f53c5767ba26cf0c6d150a0b43d6b3a');

    delete process.env[MCP_TOOLS_ENV];
    expect(getStaticTools().map((tool) => tool.name)).toEqual(['afyx_graph_explore']);
  });

  it('returns the negotiated server identity and tool capability on initialize', async () => {
    const { transport } = sessionHarness();
    await transport.receive({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2099-01-01', capabilities: {} },
    });

    const result = transport.responses[0]?.result as Record<string, unknown>;
    expect(result.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(result.serverInfo).toEqual(SERVER_INFO);
    expect(result.capabilities).toEqual({ tools: {} });
    expect(typeof result.instructions).toBe('string');
  });

  it('lists the handler surface and dispatches a valid tool call unchanged', async () => {
    const { transport, handler } = sessionHarness();
    await transport.receive({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(transport.responses[0]).toEqual({ jsonrpc: '2.0', id: 2, result: { tools } });

    const args = { query: 'AuthService', maxFiles: 4 };
    await transport.receive({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'afyx_graph_explore', arguments: args },
    });
    expect(handler.execute).toHaveBeenCalledWith(
      'afyx_graph_explore', args, expect.anything(),
    );
    expect(transport.responses[1]).toEqual({
      jsonrpc: '2.0', id: 3,
      result: { content: [{ type: 'text', text: 'handled' }] },
    });
  });

  it('normalizes omitted or null tool arguments to an empty object', async () => {
    const { transport, handler } = sessionHarness();
    await transport.receive({
      jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: { name: 'afyx_graph_status', arguments: null },
    });
    expect(handler.execute).toHaveBeenCalledWith(
      'afyx_graph_status', {}, expect.anything(),
    );
  });

  it('returns exact JSON-RPC errors for missing names, unknown tools, and methods', async () => {
    const { transport, handler } = sessionHarness();
    await transport.receive({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: {} });
    await transport.receive({
      jsonrpc: '2.0', id: 6, method: 'tools/call',
      params: { name: 'afyx_graph_missing', arguments: {} },
    });
    await transport.receive({ jsonrpc: '2.0', id: 7, method: 'unknown/method' });

    expect(transport.responses).toEqual([
      { jsonrpc: '2.0', id: 5, error: { code: ErrorCodes.InvalidParams, message: 'Missing tool name' } },
      { jsonrpc: '2.0', id: 6, error: { code: ErrorCodes.InvalidParams, message: 'Unknown tool: afyx_graph_missing' } },
      { jsonrpc: '2.0', id: 7, error: { code: ErrorCodes.MethodNotFound, message: 'Method not found: unknown/method' } },
    ]);
    expect(handler.execute).not.toHaveBeenCalled();
  });

  it('answers standard capability probes and ping with stable empty shapes', async () => {
    const { transport } = sessionHarness();
    await transport.receive({ jsonrpc: '2.0', id: 8, method: 'ping' });
    await transport.receive({ jsonrpc: '2.0', id: 9, method: 'resources/list' });
    await transport.receive({ jsonrpc: '2.0', id: 10, method: 'resources/templates/list' });
    await transport.receive({ jsonrpc: '2.0', id: 11, method: 'prompts/list' });

    expect(transport.responses.map((response) => response.result)).toEqual([
      {}, { resources: [] }, { resourceTemplates: [] }, { prompts: [] },
    ]);
  });

  it('keeps invalid arguments and engine failures inside ToolResult semantics', async () => {
    const invalid = await new ToolHandler(null).execute('afyx_graph_search', {});
    expect(invalid).toEqual({
      content: [{ type: 'text', text: 'Error: query must be a non-empty string' }],
      isError: true,
    });

    const failingGraph = {
      reopenIfReplaced: () => false,
      searchNodes: () => { throw new Error('database exploded'); },
    };
    const failed = await new ToolHandler(failingGraph as never).execute(
      'afyx_graph_search', { query: 'x' },
    );
    expect(failed).toEqual({
      content: [{
        type: 'text',
        text: 'Error: Tool execution failed: database exploded. This is an internal afyx-graph error — retry the call once; if it persists, continue without afyx-graph for this task.',
      }],
      isError: true,
    });

    const unindexed = await new ToolHandler(null).execute('afyx_graph_search', { query: 'x' });
    expect(unindexed.isError).toBeUndefined();
    expect(unindexed.content[0]?.text).toContain('No Afyx Graph project is loaded for this session.');
  });
});
