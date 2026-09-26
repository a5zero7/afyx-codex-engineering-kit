#!/usr/bin/env node
/**
 * Afyx Graph semantic-preservation baseline (zero-model, deterministic).
 *
 * Indexes small deterministic fixture projects with the BUILT engine and compares
 * a structural snapshot against tests/semantic-baseline.json, which was frozen
 * from the last pre-independence implementation. Identity changes are allowed;
 * any difference in analysis output is a FAILURE:
 *   files, symbols/nodes, edges, dependencies, inheritance, search results with
 *   score and order, callers, callees, impact, affected tests, context/query.
 *
 * Usage:
 *   node scripts/semantic-baseline.mjs            compare against the frozen snapshot
 *   node scripts/semantic-baseline.mjs --write    (re)freeze from the engine in ./dist
 *
 * Freezing is only legitimate from the pre-independence implementation (see
 * tests/semantic-baseline.meta.json); set AFYX_SEMANTIC_CLI to that build's CLI.
 * AFYX_SEMANTIC_EXPECTED overrides the snapshot path (used to prove the gate fails
 * on a tampered snapshot).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

process.env.AFYX_GRAPH_NO_WATCH ??= '1';
process.env.AFYX_GRAPH_NO_DAEMON ??= '1';
process.env.AFYX_GRAPH_ALLOW_UNSAFE_NODE ??= '1';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afyx-graph-semantic-'));
const distRoot = path.resolve('dist');
const cliPath = path.resolve(process.env.AFYX_SEMANTIC_CLI ?? 'dist/bin/afyx-graph.js');
const expectedPath = path.resolve(process.env.AFYX_SEMANTIC_EXPECTED ?? 'tests/semantic-baseline.json');

const fixtures = {
  typescript: {
    search: 'parseToken',
    symbol: 'parseToken',
    caller: 'authenticate',
    subclass: 'ApiService',
    servicePath: 'src/service.ts',
    changed: ['src/parser.ts'],
    task: 'authenticate a token with parseToken',
    files: {
      'src/parser.ts': 'export function parseToken(raw: string) { return raw.trim(); }\n',
      'src/service.ts': "import { parseToken } from './parser';\nexport class BaseService { authenticate(raw: string) { return parseToken(raw); } }\nexport class ApiService extends BaseService {}\n",
      'test/service.test.ts': "import { ApiService } from '../src/service';\nexport const service = new ApiService();\n",
    },
  },
  javascript: {
    search: 'parseToken',
    symbol: 'parseToken',
    caller: 'authenticate',
    subclass: 'ApiService',
    servicePath: 'src/service.js',
    changed: ['src/parser.js'],
    task: 'authenticate a token with parseToken',
    files: {
      'src/parser.js': 'export function parseToken(raw) { return raw.trim(); }\n',
      'src/service.js': "import { parseToken } from './parser.js';\nexport class BaseService { authenticate(raw) { return parseToken(raw); } }\nexport class ApiService extends BaseService {}\n",
      'test/service.test.js': "import { ApiService } from '../src/service.js';\nexport const service = new ApiService();\n",
    },
  },
  python: {
    search: 'parse_token',
    symbol: 'parse_token',
    caller: 'authenticate',
    subclass: 'ApiService',
    servicePath: 'service.py',
    changed: ['parser.py'],
    task: 'authenticate a token with parse_token',
    files: {
      'parser.py': 'def parse_token(raw):\n    return raw.strip()\n',
      'service.py': 'from parser import parse_token\n\nclass BaseService:\n    def authenticate(self, raw):\n        return parse_token(raw)\n\nclass ApiService(BaseService):\n    pass\n',
      'test_service.py': 'from service import ApiService\n\ndef test_service():\n    assert ApiService().authenticate(" x ") == "x"\n',
    },
  },
  java: {
    search: 'Formatter',
    symbol: 'format',
    caller: 'render',
    subclass: 'UpperFormatter',
    servicePath: 'src/main/java/app/Renderer.java',
    changed: ['src/main/java/app/Formatter.java'],
    task: 'render a value with the formatter',
    files: {
      'src/main/java/app/Formatter.java': 'package app;\n\npublic interface Formatter {\n    String format(String value);\n}\n',
      'src/main/java/app/UpperFormatter.java': 'package app;\n\npublic class UpperFormatter implements Formatter {\n    public String format(String value) {\n        return value.toUpperCase();\n    }\n}\n',
      'src/main/java/app/Renderer.java': 'package app;\n\npublic class Renderer {\n    private final Formatter formatter = new UpperFormatter();\n    public String render(String value) {\n        return formatter.format(value);\n    }\n}\n',
      'src/test/java/app/RendererTest.java': 'package app;\n\npublic class RendererTest {\n    public void testRender() {\n        new Renderer().render("x");\n    }\n}\n',
    },
  },
  go: {
    search: 'Normalize',
    symbol: 'Normalize',
    caller: 'Handle',
    subclass: null,
    servicePath: 'service/service.go',
    changed: ['text/text.go'],
    task: 'handle a request by normalizing text',
    files: {
      'go.mod': 'module example.com/app\n\ngo 1.21\n',
      'text/text.go': 'package text\n\nimport "strings"\n\nfunc Normalize(raw string) string {\n\treturn strings.TrimSpace(raw)\n}\n',
      'service/service.go': 'package service\n\nimport "example.com/app/text"\n\nfunc Handle(raw string) string {\n\treturn text.Normalize(raw)\n}\n',
      'service/service_test.go': 'package service\n\nimport "testing"\n\nfunc TestHandle(t *testing.T) {\n\tif Handle(" x ") != "x" {\n\t\tt.Fatal("mismatch")\n\t}\n}\n',
    },
  },
  // Odoo-style repository: regression coverage of GENERIC graph behaviour on a
  // realistic Odoo layout. No Odoo-specific algorithm is asserted or required.
  odoo: {
    search: 'compute_loyalty',
    symbol: 'compute_loyalty',
    caller: 'action_reward',
    subclass: 'ResPartnerExt',
    servicePath: 'addons/dep_mod/models/partner_ext.py',
    changed: ['addons/base_mod/models/partner.py'],
    task: 'compute partner loyalty points',
    files: {
      'addons/base_mod/__manifest__.py': "{'name': 'Base Mod', 'version': '17.0.1.0.0', 'depends': ['base'], 'data': ['views/partner_views.xml']}\n",
      'addons/base_mod/__init__.py': 'from . import models\n',
      'addons/base_mod/models/__init__.py': 'from . import partner\n',
      'addons/base_mod/models/partner.py': "from odoo import api, fields, models\n\n\nclass ResPartner(models.Model):\n    _inherit = 'res.partner'\n\n    loyalty = fields.Integer(compute='_compute_loyalty')\n\n    @api.depends('name')\n    def _compute_loyalty(self):\n        for record in self:\n            record.loyalty = record.compute_loyalty()\n\n    def compute_loyalty(self):\n        return self._bonus()\n\n    def _bonus(self):\n        return 1\n\n    def action_reward(self):\n        return self.compute_loyalty()\n",
      'addons/base_mod/views/partner_views.xml': '<odoo>\n    <record id="view_partner_form_loyalty" model="ir.ui.view">\n        <field name="name">res.partner.form.loyalty</field>\n        <field name="model">res.partner</field>\n        <field name="inherit_id" ref="base.view_partner_form"/>\n        <field name="arch" type="xml">\n            <field name="name" position="after">\n                <field name="loyalty"/>\n            </field>\n        </field>\n    </record>\n</odoo>\n',
      'addons/base_mod/tests/__init__.py': 'from . import test_partner\n',
      'addons/base_mod/tests/test_partner.py': "from odoo.tests import TransactionCase\n\n\nclass TestPartner(TransactionCase):\n    def test_loyalty(self):\n        partner = self.env['res.partner'].create({'name': 'A'})\n        self.assertEqual(partner.compute_loyalty(), 1)\n",
      'addons/dep_mod/__manifest__.py': "{'name': 'Dep Mod', 'version': '17.0.1.0.0', 'depends': ['base_mod']}\n",
      'addons/dep_mod/__init__.py': 'from . import models\n',
      'addons/dep_mod/models/__init__.py': 'from . import partner_ext\n',
      'addons/dep_mod/models/partner_ext.py': "from odoo import models\n\n\nclass ResPartnerExt(models.Model):\n    _inherit = 'res.partner'\n\n    def compute_loyalty(self):\n        result = super().compute_loyalty()\n        return result + 1\n",
    },
  },
};

function writeFixture(name, files) {
  const dir = path.join(root, name);
  for (const [relative, source] of Object.entries(files)) {
    const target = path.join(dir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source);
  }
  return dir;
}

const byJson = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b));

function nodes(items) {
  const values = items instanceof Map ? [...items.values()] : items;
  return values
    .map((item) => {
      const node = item.node ?? item;
      return { name: node.name, kind: node.kind, filePath: node.filePath };
    })
    .sort(byJson);
}

function edges(items) {
  return [...items].map(({ source, target, kind }) => ({ source, target, kind })).sort(byJson);
}

function context(value) {
  return {
    focal: value.focal ? nodes([value.focal]) : [],
    ancestors: nodes(value.ancestors),
    children: nodes(value.children),
    incomingRefs: value.incomingRefs.map(({ node, edge }) => ({ node: nodes([node])[0], edge: edges([edge])[0] })),
    outgoingRefs: value.outgoingRefs.map(({ node, edge }) => ({ node: nodes([node])[0], edge: edges([edge])[0] })),
    types: nodes(value.types),
    imports: nodes(value.imports),
  };
}

function label(graph, id) {
  const node = graph.getNode(id);
  return node ? `${node.kind}:${node.name}@${node.filePath}:${node.startLine}` : `?:${id}`;
}

function affectedTests(dir, changed) {
  const result = spawnSync(process.execPath, [cliPath, 'affected', '--json', '--path', dir, ...changed], {
    cwd: dir,
    env: { ...process.env, NO_COLOR: '1' },
    encoding: 'utf8',
    timeout: 120_000,
  });
  assert.equal(result.status, 0, `affected failed: ${result.stderr || result.stdout}`);
  const parsed = JSON.parse(result.stdout);
  return { changedFiles: parsed.changedFiles, affectedTests: parsed.affectedTests, totalDependentsTraversed: parsed.totalDependentsTraversed };
}

async function capture(name, fixture) {
  const dir = writeFixture(name, fixture.files);
  const mod = await import(pathToFileURL(path.join(distRoot, 'index.js')).href);
  const Graph = mod.default?.default ?? mod.default;
  const graph = await Graph.init(dir);
  await graph.indexAll();
  const stats = graph.getStats();
  const searchResults = graph.searchNodes(fixture.search, { limit: 20 });
  const search = searchResults.map(({ node, score }) => ({ name: node.name, kind: node.kind, filePath: node.filePath, score }));
  const symbol = searchResults.find(({ node }) => node.name === fixture.symbol)?.node;
  const caller = graph.searchNodes(fixture.caller, { limit: 20 }).find(({ node }) => node.name === fixture.caller)?.node;
  const subclass = fixture.subclass ? graph.searchNodes(fixture.subclass, { limit: 20 }).find(({ node }) => node.name === fixture.subclass)?.node : null;
  const file = graph.getFile(fixture.servicePath);
  const hierarchy = subclass ? graph.getTypeHierarchy(subclass.id) : { nodes: [], edges: [] };

  const files = graph.getFiles().map((record) => ({ path: record.path, language: record.language })).sort(byJson);
  const allNodes = [];
  const allEdges = [];
  for (const record of graph.getFiles()) {
    for (const node of graph.getNodesInFile(record.path)) {
      allNodes.push({ kind: node.kind, name: node.name, filePath: node.filePath, startLine: node.startLine, endLine: node.endLine });
      for (const edge of graph.getOutgoingEdges(node.id)) {
        allEdges.push({ kind: edge.kind, source: label(graph, edge.source), target: label(graph, edge.target) });
      }
    }
  }
  const relevant = await graph.findRelevantContext(fixture.task, { searchLimit: 5, traversalDepth: 1 });

  const result = {
    files: stats.fileCount,
    nodes: stats.nodeCount,
    edges: stats.edgeCount,
    relations: Object.fromEntries(Object.entries(stats.edgesByKind).sort(([a], [b]) => a.localeCompare(b))),
    languages: Object.fromEntries(Object.entries(stats.filesByLanguage).sort(([a], [b]) => a.localeCompare(b))),
    fileList: files,
    nodeList: allNodes.sort(byJson),
    edgeList: allEdges.sort(byJson),
    search,
    symbolLookup: symbol ? nodes([graph.getNode(symbol.id)]).at(0) : null,
    fileLookup: file ? { path: file.path, language: file.language } : null,
    dependencies: graph.getFileDependencies(fixture.servicePath).sort(),
    dependents: fixture.changed.map((changed) => ({ file: changed, dependents: graph.getFileDependents(changed).sort() })),
    inheritance: { nodes: nodes(hierarchy.nodes), edges: edges(hierarchy.edges) },
    context: symbol ? context(graph.getContext(symbol.id)) : null,
    callers: symbol ? nodes(graph.getCallers(symbol.id)) : [],
    callees: caller ? nodes(graph.getCallees(caller.id)) : [],
    impact: symbol ? nodes(graph.getImpactRadius(symbol.id, 3).nodes) : [],
    relevantContext: { nodes: nodes(relevant.nodes), edges: edges(relevant.edges) },
    affectedTests: affectedTests(dir, fixture.changed),
    status: { indexState: graph.getIndexState(), backend: graph.getBackend(), journalMode: graph.getJournalMode() },
  };
  graph.close();
  return result;
}

try {
  assert.ok(fs.existsSync(path.join(distRoot, 'index.js')), 'dist/ is not built: run `npm run build:clean` first');
  assert.ok(fs.existsSync(cliPath), `CLI not found: ${cliPath}`);
  const result = {};
  for (const [name, fixture] of Object.entries(fixtures)) result[name] = await capture(name, fixture);
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(expectedPath), { recursive: true });
    fs.writeFileSync(expectedPath, JSON.stringify(result, null, 2) + '\n');
    console.log(`Semantic baseline written: ${expectedPath}`);
  } else {
    const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
    for (const name of Object.keys(fixtures)) {
      assert.deepEqual(result[name], expected[name], `semantic baseline differs for fixture "${name}"`);
    }
    assert.deepEqual(Object.keys(result), Object.keys(expected), 'fixture set differs from the frozen baseline');
    console.log(`Afyx Graph semantic baseline: PASS (${Object.keys(fixtures).length} fixtures)`);
  }
} finally {
  try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* Windows file handles may outlive test cleanup. */ }
}
