import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [root, distRoot] = process.argv.slice(2);
if (!root || !distRoot) process.exit(2);
const mod = await import(pathToFileURL(path.join(distRoot, 'index.js')).href);
const CodeGraph = mod.default?.default ?? mod.default ?? mod.CodeGraph;
const graph = await CodeGraph.init(root);
await graph.indexAll();
const stats = graph.getStats();
const search = graph.searchNodes('parseToken', { limit: 20 }).map((row) => ({
  name: row.node.name,
  kind: row.node.kind,
  filePath: row.node.filePath,
  score: row.score,
}));
const target = search.find((row) => row.name === 'parseToken');
const node = target ? graph.searchNodes('parseToken', { limit: 20 }).find((row) => row.node.name === 'parseToken')?.node : null;
const normalizeNodes = (items) => {
  const nodes = items instanceof Map ? [...items.values()] : items.map((item) => item.node ?? item);
  return nodes
    .map((item) => ({ name: item.name, kind: item.kind, filePath: item.filePath }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
};
const result = {
  stats: { fileCount: stats.fileCount, nodeCount: stats.nodeCount, edgeCount: stats.edgeCount },
  search,
  callers: node ? normalizeNodes(graph.getCallers(node.id)) : [],
  callees: node ? normalizeNodes(graph.getCallees(node.id)) : [],
  impact: node ? normalizeNodes(graph.getImpactRadius(node.id, 3).nodes) : [],
};
graph.close();
fs.writeFileSync(path.join(root, 'equivalence-result.json'), JSON.stringify(result));
