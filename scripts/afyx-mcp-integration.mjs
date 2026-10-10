#!/usr/bin/env node
/** Consent-safe Codex MCP registration through the native `codex mcp` CLI. */
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { basename, extname, normalize, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function normalized(value) {
  return normalize(String(value || '')).toLowerCase();
}

export function classifyEntry(existing, expected) {
  if (!existing) return 'MCP_NOT_CONFIGURED';
  const transport = existing.transport || {};
  const args = Array.isArray(transport.args) ? transport.args : [];
  const expectedNode = normalized(expected.node);
  const actualNode = normalized(transport.command);
  const executableName = (value) => basename(value).replace(/\.exe$/i, '');
  const nodeMatches = actualNode === expectedNode || executableName(actualNode) === executableName(expectedNode);
  const afyxShape = transport.type === 'stdio' && args.length === 3 &&
    /(?:^|[\\/])lib[\\/]dist[\\/]bin[\\/]afyx-graph\.js$/i.test(String(args[0])) &&
    args[1] === 'serve' && args[2] === '--mcp';
  if (!afyxShape) return 'MCP_BLOCKED';
  if (nodeMatches && normalized(args[0]) === normalized(expected.entry)) return 'MCP_CONFIGURED';
  return 'MCP_STALE_OWNED';
}

class McpIntegrationError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}

const cmdMetaCharacters = /([()\][%!^"`<>&|;, *?])/g;

function escapeCmdCommand(value) {
  return String(value).replace(cmdMetaCharacters, '^$1');
}

function escapeCmdArgument(value) {
  let escaped = String(value)
    .replace(/(?=(\\+?)?)\1"/g, '$1$1\\"')
    .replace(/(?=(\\+?)?)\1$/, '$1$1');
  escaped = `"${escaped}"`.replace(cmdMetaCharacters, '^$1');
  // npm .cmd shims add a second cmd.exe parsing boundary.
  return escaped.replace(cmdMetaCharacters, '^$1');
}

function codexRun(codex, codexHome, args) {
  const isWindowsCmd = process.platform === 'win32' && extname(codex).toLowerCase() === '.cmd';
  const command = isWindowsCmd ? (process.env.ComSpec || process.env.COMSPEC || 'cmd.exe') : codex;
  const commandArgs = isWindowsCmd
    ? ['/d', '/s', '/c', `"${[escapeCmdCommand(codex), ...args.map(escapeCmdArgument)].join(' ')}"`]
    : args;
  return spawnSync(command, commandArgs, {
    encoding: 'utf8',
    env: { ...process.env, CODEX_HOME: codexHome },
    windowsHide: true,
    windowsVerbatimArguments: isWindowsCmd,
  });
}

function commandDiagnostic(result) {
  return String(result.stderr || result.stdout || result.error?.message || '').trim();
}

function requireCodexSuccess(result, action) {
  if (result.error || result.status === null) {
    throw new McpIntegrationError(
      'CODEX_LAUNCH_FAILED',
      `${action} could not launch Codex CLI: ${commandDiagnostic(result) || 'unknown process launch failure'}`,
    );
  }
  if (result.status !== 0) {
    throw new McpIntegrationError(
      'MCP_REGISTRATION_FAILED',
      `${action} failed with exit code ${result.status}: ${commandDiagnostic(result) || 'no diagnostic output'}`,
    );
  }
  return result;
}

function readExisting(codex, codexHome) {
  const result = codexRun(codex, codexHome, ['mcp', 'get', 'afyx_graph', '--json']);
  if (result.error || result.status === null) {
    throw new McpIntegrationError(
      'CODEX_LAUNCH_FAILED',
      `Codex MCP inspection could not launch: ${commandDiagnostic(result) || 'unknown process launch failure'}`,
    );
  }
  if (result.status !== 0) {
    const diagnostic = commandDiagnostic(result);
    if (/not found|not configured|no mcp server named/i.test(diagnostic)) {
      return { existing: null, reason: 'MCP_ENTRY_NOT_FOUND' };
    }
    throw new McpIntegrationError(
      'MCP_INSPECTION_FAILED',
      `Codex MCP inspection failed with exit code ${result.status}: ${diagnostic || 'no diagnostic output'}`,
    );
  }
  try {
    return { existing: JSON.parse(result.stdout), reason: '' };
  } catch {
    throw new McpIntegrationError('MCP_INVALID_CONFIGURATION', 'Codex returned invalid MCP configuration JSON.');
  }
}

function backupConfig(codexHome) {
  const config = resolve(codexHome, 'config.toml');
  if (!existsSync(config)) return { config, backup: null, existed: false };
  const backup = `${config}.afyx-backup`;
  copyFileSync(config, backup);
  return { config, backup, existed: true };
}

function restoreBackup(backup) {
  if (!backup) return;
  if (backup.existed) {
    copyFileSync(backup.backup, backup.config);
    rmSync(backup.backup, { force: true });
  } else {
    rmSync(backup.config, { force: true });
  }
}

function removeBackup(backup) {
  if (backup?.backup) rmSync(backup.backup, { force: true });
}

async function handshake(node, entry) {
  return await new Promise((resolveHandshake) => {
    const child = spawn(node, [entry, 'serve', '--mcp'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      // Keep the installed daemon policy: an additional Codex client should
      // proxy the shared daemon instead of contending for its writer lock.
      env: { ...process.env, AFYX_GRAPH_NO_WATCH: '1', NO_COLOR: '1' },
    });
    let buffer = '';
    let stderr = '';
    let initialized = false;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      resolveHandshake(result);
    };
    const configuredTimeout = Number.parseInt(process.env.AFYX_MCP_HANDSHAKE_TIMEOUT_MS || '', 10);
    const timeoutMs = Number.isSafeInteger(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 15_000;
    const timer = setTimeout(() => finish({ ok: false, detail: 'MCP initialize/tool discovery timed out.' }), timeoutMs);
    child.on('error', (error) => finish({ ok: false, detail: error.message }));
    child.on('exit', (code) => finish({ ok: false, detail: `MCP process exited with ${code}: ${stderr.trim() || 'no diagnostic output'}` }));
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk.toString('utf8')}`.slice(-2_000); });
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      for (;;) {
        const newline = buffer.indexOf('\n');
        if (newline < 0) break;
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let message;
        try { message = JSON.parse(line); } catch { continue; }
        if (message.id === 1 && !initialized) {
          initialized = true;
          child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`);
          child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`);
        } else if (message.id === 2) {
          const names = message.result?.tools?.map((tool) => tool.name) || [];
          finish(names.includes('afyx_graph_explore')
            ? { ok: true, detail: `${names.length} tools discovered.` }
            : { ok: false, detail: 'MCP tools/list did not expose afyx_graph_explore.' });
        }
      }
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'afyx-installer', version: '1.0.0' } } })}\n`);
  });
}

export async function integrate(options) {
  const result = {
    graph: existsSync(options.entry) ? 'GRAPH_INSTALLED' : 'GRAPH_NOT_INSTALLED',
    cli: existsSync(options.entry) && existsSync(options.node) ? 'CLI_REACHABLE' : 'CLI_BLOCKED',
    mcp: 'MCP_BLOCKED',
    changed: false,
    reason: '',
    detail: '',
  };
  if (result.cli !== 'CLI_REACHABLE') {
    result.reason = 'GRAPH_RUNTIME_UNAVAILABLE';
    result.detail = 'Installed entry point or Node.js executable is unavailable.';
    return result;
  }
  if (!options.codex || !existsSync(options.codex)) {
    result.reason = 'CODEX_UNAVAILABLE';
    result.detail = 'Codex CLI is unavailable; Graph runtime remains healthy.';
    return result;
  }
  mkdirSync(options.codexHome, { recursive: true });
  let inspection;
  try {
    inspection = readExisting(options.codex, options.codexHome);
  } catch (error) {
    result.reason = error instanceof McpIntegrationError ? error.reason : 'MCP_INSPECTION_FAILED';
    result.detail = `Graph runtime is installed; MCP integration failed: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }
  let existing = inspection.existing;
  result.reason = inspection.reason;
  let state = classifyEntry(existing, options);
  result.mcp = state;
  if (state === 'MCP_BLOCKED') {
    result.reason = 'MCP_INVALID_CONFIGURATION';
    result.detail = 'Conflicting or unproven afyx_graph entry was preserved.';
    return result;
  }
  if (!options.apply && state !== 'MCP_CONFIGURED') {
    result.detail = 'Registration is available but was not consented.';
    return result;
  }
  if (options.apply && state !== 'MCP_CONFIGURED') {
    const backup = backupConfig(options.codexHome);
    try {
      if (state === 'MCP_STALE_OWNED') {
        const removed = codexRun(options.codex, options.codexHome, ['mcp', 'remove', 'afyx_graph']);
        requireCodexSuccess(removed, 'Codex MCP removal');
      }
      const added = codexRun(options.codex, options.codexHome, ['mcp', 'add', 'afyx_graph', '--', options.node, options.entry, 'serve', '--mcp']);
      requireCodexSuccess(added, 'Codex MCP registration');
      inspection = readExisting(options.codex, options.codexHome);
      existing = inspection.existing;
      state = classifyEntry(existing, options);
      if (state !== 'MCP_CONFIGURED') throw new Error('Codex MCP registration did not persist the expected direct-Node entry.');
      result.changed = true;
      result.reason = '';
      removeBackup(backup);
    } catch (error) {
      restoreBackup(backup);
      result.mcp = 'MCP_BLOCKED';
      result.reason = error instanceof McpIntegrationError ? error.reason : 'MCP_REGISTRATION_FAILED';
      result.detail = `Graph runtime is installed; MCP registration failed and configuration was restored: ${error instanceof Error ? error.message : String(error)}`;
      return result;
    }
  }
  const probe = await handshake(options.node, options.entry);
  result.mcp = probe.ok ? 'MCP_REACHABLE' : 'MCP_HANDSHAKE_FAILED';
  result.reason = probe.ok ? '' : 'MCP_HANDSHAKE_FAILED';
  result.detail = probe.detail;
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const options = {
    node: resolve(argument('--node')),
    entry: resolve(argument('--entry')),
    codex: argument('--codex') ? resolve(argument('--codex')) : '',
    codexHome: resolve(argument('--codex-home')),
    apply: process.argv.includes('--apply'),
  };
  integrate(options).then((result) => {
    console.log(JSON.stringify(result));
    if (result.mcp === 'MCP_BLOCKED' || result.mcp === 'MCP_HANDSHAKE_FAILED') process.exitCode = 2;
  }).catch((error) => {
    console.error(`[mcp-integration] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
