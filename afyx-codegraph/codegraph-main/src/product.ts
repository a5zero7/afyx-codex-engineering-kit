/**
 * Afyx Graph distribution identity and compatibility aliases.
 *
 * This module deliberately contains presentation/compatibility policy only.
 * The graph engine continues to consume its established CODEGRAPH_* settings;
 * an Afyx-owned launcher selects the branded surface with AFYX_GRAPH_PRODUCT=1.
 */

export const AFYX_GRAPH_MODE = process.env.AFYX_GRAPH_PRODUCT === '1';

// AFYX_GRAPH_* is canonical for the Afyx distribution. Preserve every legacy
// CODEGRAPH_* setting, and never overwrite one the caller explicitly supplied.
for (const [name, value] of Object.entries(process.env)) {
  if (!name.startsWith('AFYX_GRAPH_') || name === 'AFYX_GRAPH_PRODUCT' || value === undefined) continue;
  const legacyName = `CODEGRAPH_${name.slice('AFYX_GRAPH_'.length)}`;
  if (process.env[legacyName] === undefined) process.env[legacyName] = value;
}

export const PRODUCT_NAME = AFYX_GRAPH_MODE ? 'Afyx Graph' : 'CodeGraph';
export const CLI_NAME = AFYX_GRAPH_MODE ? 'afyx-graph' : 'codegraph';
export const MCP_SERVER_NAME = AFYX_GRAPH_MODE ? 'afyx_graph' : 'codegraph';

export function engineToolName(name: string): string {
  return name.replace(/^afyx_graph_/, 'codegraph_');
}

export function publicToolName(name: string): string {
  return AFYX_GRAPH_MODE ? name.replace(/^codegraph_/, 'afyx_graph_') : name;
}

export function shortToolName(name: string): string {
  return name.replace(/^(?:codegraph|afyx_graph)_/, '');
}

export function publicText(text: string): string {
  if (!AFYX_GRAPH_MODE) return text;
  return text
    .replace(/codegraph_/g, 'afyx_graph_')
    .replace(/\bcodegraph\b/g, 'afyx-graph')
    .replace(/CodeGraph/g, 'Afyx Graph')
    .replace(/\.codegraph\//g, '.afyx-graph/');
}
