import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  AFYX_CAPABILITY_REQUEST_CONTRACT,
  AFYX_CAPABILITY_RESULT_CONTRACT,
  PRIMARY_COMPONENT_IDS,
  discoverAfyxCapabilities,
  executeAfyxCapabilityRoute,
  resolveAfyxCapabilityRoute,
} from '../afyx-capability-orchestrator.mjs';

const SOURCE = 'candidate-307';

function state(availableIds = PRIMARY_COMPONENT_IDS) {
  return Object.fromEntries(PRIMARY_COMPONENT_IDS.map((id) => [id, {
    installed: availableIds.includes(id),
    enabled: true,
    healthy: availableIds.includes(id),
    compatible: availableIds.includes(id),
    authorized: availableIds.includes(id),
    sourceIdentity: availableIds.includes(id) ? SOURCE : null,
    ...(id === 'afyx-graph' && availableIds.includes(id) ? { indexReady: true, indexFresh: true } : {}),
    observationSource: 'TEST_FIXTURE',
  }]));
}

function options(task, availableIds = PRIMARY_COMPONENT_IDS, extra = {}) {
  return {
    task: {
      id: `task-${task.taskType ?? 'generic'}`,
      workspaceIdentity: 'fixture/repository',
      sourceRevision: 'abc123',
      ...task,
    },
    provider: 'codex',
    componentStates: state(availableIds),
    ...extra,
  };
}

test('versioned request and result schemas are present and identify v1 contracts', () => {
  const requestSchema = JSON.parse(readFileSync(new URL('../contracts/afyx-capability-request-v1.schema.json', import.meta.url)));
  const resultSchema = JSON.parse(readFileSync(new URL('../contracts/afyx-capability-result-v1.schema.json', import.meta.url)));
  assert.equal(requestSchema.$id, AFYX_CAPABILITY_REQUEST_CONTRACT);
  assert.equal(resultSchema.$id, AFYX_CAPABILITY_RESULT_CONTRACT);
});

test('known-file string replacement uses direct source with zero runtime invocation', async () => {
  let calls = 0;
  const result = await executeAfyxCapabilityRoute({
    ...options({ taskType: 'string-replacement', knownFile: true }),
    adapters: Object.fromEntries(PRIMARY_COMPONENT_IDS.map((id) => [id, () => { calls += 1; return { status: 'SUCCESS' }; }])),
  });
  assert.equal(result.directSourceFastPath, true);
  assert.equal(result.executionStatus, 'DIRECT_SOURCE');
  assert.equal(result.metrics.selectedCapabilities, 0);
  assert.equal(result.metrics.executedCapabilities, 0);
  assert.equal(calls, 0);
});

test('each single-component installation can execute its advertised standalone route', async () => {
  const cases = [
    ['efficient-coding', { taskType: 'implementation' }],
    ['odoo-engineering', { taskType: 'odoo-fix', project: { isOdoo: true } }],
    ['afyx-engineering-expert', { taskType: 'architecture' }],
    ['afyx-graph', { taskType: 'relationship-analysis', needsRelationalEvidence: true }],
    ['afyx-context', { taskType: 'large-context', needsContextOptimization: true }],
    ['afyx-forge', { taskType: 'forge-advice', forgeAdvice: true }],
  ];
  for (const [componentId, task] of cases) {
    const provider = componentId === 'afyx-forge' ? null : 'codex';
    const result = await executeAfyxCapabilityRoute({
      ...options(task, [componentId], {
        provider,
        providerPermissions: componentId === 'afyx-forge' ? { 'afyx-forge': true } : {},
      }),
      adapters: { [componentId]: () => ({ status: 'SUCCESS', output: componentId }) },
    });
    assert.equal(result.metrics.executedCapabilities, 1, componentId);
    assert.equal(result.results[0].componentId, componentId);
    assert.equal(result.results[0].output, componentId);
  }
});

test('missing optional Graph degrades to direct source without preventing useful output', async () => {
  const result = await executeAfyxCapabilityRoute(options(
    { taskType: 'impact-analysis', needsRelationalEvidence: true },
    ['efficient-coding'],
  ));
  assert.equal(result.status, 'DEGRADED');
  assert.equal(result.executionStatus, 'NOT_RUN');
  assert.deepEqual(result.degradations.map((item) => item.componentId), ['afyx-graph']);
  assert.equal(result.degradations[0].fallback, 'DIRECT_SOURCE');
});

test('relevant Odoo relationship task retains Odoo authority and exchanges Graph evidence', async () => {
  const sequence = [];
  const result = await executeAfyxCapabilityRoute({
    ...options({
      taskType: 'odoo-impact-analysis',
      project: { isOdoo: true },
      needsRelationalEvidence: true,
    }, ['odoo-engineering', 'afyx-graph']),
    adapters: {
      'odoo-engineering': (request) => {
        sequence.push(request.targetComponentId);
        return { status: 'SUCCESS', evidence: [{ kind: 'odoo-version', value: 17 }] };
      },
      'afyx-graph': (request) => {
        sequence.push(request.targetComponentId);
        return { status: 'SUCCESS', evidence: [{ kind: 'source-edge', path: 'models/a.py' }] };
      },
    },
  });
  assert.equal(result.domainAuthorities['odoo-framework-authority'], 'odoo-engineering');
  assert.equal(result.domainAuthorities['repository-graph-evidence'], 'afyx-graph');
  assert.deepEqual(sequence, ['odoo-engineering', 'afyx-graph']);
  assert.equal(result.results.every((item) => item.provenance.sourceRevision === 'abc123'), true);
});

test('Graph is selected only for beneficial relational work', () => {
  const ordinary = resolveAfyxCapabilityRoute(options({ taskType: 'implementation' }, ['efficient-coding', 'afyx-graph']));
  const relational = resolveAfyxCapabilityRoute(options({ taskType: 'impact-analysis', needsRelationalEvidence: true }, ['efficient-coding', 'afyx-graph']));
  assert.deepEqual(ordinary.requests.map((request) => request.targetComponentId), ['efficient-coding']);
  assert.equal(ordinary.requests.some((request) => request.targetComponentId === 'afyx-graph'), false);
  assert.equal(relational.requests.some((request) => request.targetComponentId === 'afyx-graph'), true);
});

test('Context is selective, returns exact adapter recovery, and explicit OFF wins', async () => {
  const payload = 'byte-exact:\u0000:\ud83d\udca1';
  const selected = await executeAfyxCapabilityRoute({
    ...options({ taskType: 'large-context', needsContextOptimization: true }, ['afyx-context']),
    adapters: {
      'afyx-context': () => ({ status: 'SUCCESS', output: payload, contextBytes: Buffer.byteLength(payload) }),
    },
  });
  assert.equal(selected.results[0].output, payload);
  assert.equal(selected.metrics.contextBytes, Buffer.byteLength(payload));

  const disabled = await executeAfyxCapabilityRoute({
    ...options({ taskType: 'large-context', needsContextOptimization: true }, ['afyx-context']),
    environment: { AFYX_CONTEXT_OPT_IN: '0' },
    adapters: { 'afyx-context': () => { throw new Error('must not execute'); } },
  });
  assert.equal(disabled.metrics.executedCapabilities, 0);
  assert.equal(
    disabled.degradations.find((item) => item.componentId === 'afyx-context')?.reason,
    'EXPLICITLY_DISABLED',
  );
});

test('duplicate and cyclic follow-ups are suppressed without repeated execution', async () => {
  let graphCalls = 0;
  let contextCalls = 0;
  const result = await executeAfyxCapabilityRoute({
    ...options({ taskType: 'impact-analysis', needsRelationalEvidence: true }, ['afyx-graph', 'afyx-context']),
    adapters: {
      'afyx-graph': () => {
        graphCalls += 1;
        return {
          status: 'SUCCESS',
          followUpRequests: [{ targetComponentId: 'afyx-context', invocationReason: 'optimize evidence' }],
        };
      },
      'afyx-context': () => {
        contextCalls += 1;
        return {
          status: 'SUCCESS',
          followUpRequests: [{ targetComponentId: 'afyx-graph', invocationReason: 'cycle back' }],
        };
      },
    },
  });
  assert.equal(graphCalls, 1);
  assert.equal(contextCalls, 1);
  assert.equal(result.metrics.duplicateInvocationsAvoided, 1);
  assert.equal(result.results.at(-1).reason, 'DUPLICATE_REQUEST');
});

test('failed adapters are counted as attempted calls and never relabeled executed', async () => {
  const result = await executeAfyxCapabilityRoute({
    ...options({ taskType: 'implementation' }, ['efficient-coding']),
    adapters: { 'efficient-coding': () => { throw new Error('adapter failure'); } },
  });
  assert.equal(result.status, 'FAILED');
  assert.equal(result.executionStatus, 'NOT_RUN');
  assert.equal(result.metrics.toolCalls, 1);
  assert.equal(result.metrics.executedCapabilities, 0);
  assert.equal(result.results[0].executionStatus, 'FAILED');
});

test('non-cooperative adapter is bounded by execution timeout and reported failed', async () => {
  const result = await executeAfyxCapabilityRoute({
    ...options({ taskType: 'implementation' }, ['efficient-coding']),
    budgetLimits: { maxExecutionMs: 10 },
    adapters: { 'efficient-coding': () => new Promise(() => {}) },
  });
  assert.equal(result.metrics.toolCalls, 1);
  assert.equal(result.results[0].executionStatus, 'FAILED');
  assert.equal(result.results[0].reason, 'EXECUTION_TIME_BUDGET_EXHAUSTED');
  assert.equal(result.metrics.elapsedMs < 250, true);
});

test('Forge advice is bounded but autonomous or campaign execution remains A8-blocked', async () => {
  let calls = 0;
  const advice = await executeAfyxCapabilityRoute({
    ...options({ taskType: 'forge-advice', intent: 'Afyx Forge advice', forgeAdvice: true }, ['afyx-forge'], {
      provider: null,
      providerPermissions: { 'afyx-forge': true },
    }),
    adapters: { 'afyx-forge': () => { calls += 1; return { status: 'SUCCESS', output: 'advice' }; } },
  });
  assert.equal(advice.executionStatus, 'EXECUTED');
  const blocked = await executeAfyxCapabilityRoute({
    ...options({ taskType: 'forge-campaign', autonomousExecution: true }, ['afyx-forge'], {
      provider: null,
      providerPermissions: { 'afyx-forge': true },
    }),
    adapters: { 'afyx-forge': () => { calls += 1; return { status: 'SUCCESS' }; } },
  });
  assert.equal(blocked.status, 'BLOCKED');
  assert.equal(blocked.executionStatus, 'BLOCKED');
  assert.equal(calls, 1);
});

test('existing host authorization refusal propagates and prevents adapter execution', async () => {
  let calls = 0;
  const result = await executeAfyxCapabilityRoute({
    ...options({ taskType: 'impact-analysis', needsRelationalEvidence: true }, ['afyx-graph']),
    hostAuthorizations: {
      mcpEnabled: false,
      attemptedCliBypass: true,
      cliBypassAllowed: false,
    },
    adapters: { 'afyx-graph': () => { calls += 1; return { status: 'SUCCESS' }; } },
  });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.executionStatus, 'BLOCKED');
  assert.equal(result.diagnostics.some((item) => item.code === 'CLI_BYPASS_REFUSED'), true);
  assert.equal(calls, 0);
});

test('all 63 non-empty component masks route deterministically', () => {
  const taskCases = [
    { taskType: 'implementation' },
    { taskType: 'odoo-impact-analysis', project: { isOdoo: true }, needsRelationalEvidence: true },
    { taskType: 'architecture' },
    { taskType: 'large-context', needsContextOptimization: true },
    { taskType: 'forge-advice', forgeAdvice: true },
  ];
  for (let mask = 1; mask < 64; mask += 1) {
    const installed = PRIMARY_COMPONENT_IDS.filter((_, index) => (mask & (1 << index)) !== 0);
    for (const task of taskCases) {
      const first = resolveAfyxCapabilityRoute(options(task, installed));
      const second = resolveAfyxCapabilityRoute(options(task, installed));
      const projection = (route) => ({
        status: route.status,
        requests: route.requests.map((request) => request.targetComponentId),
        degradations: route.degradations,
        states: Object.fromEntries(Object.entries(route.discovery.capabilities).map(([id, value]) => [id, value.reason])),
      });
      assert.deepEqual(projection(first), projection(second), `mask ${mask} task ${task.taskType}`);
    }
  }
});

test('discovery fails closed for health, compatibility, authorization, and provider permission', () => {
  const componentStates = state(['afyx-graph']);
  componentStates['afyx-graph'] = { ...componentStates['afyx-graph'], compatible: false };
  let discovery = discoverAfyxCapabilities({ componentStates, provider: 'codex' });
  assert.equal(discovery.capabilities['afyx-graph'].reason, 'INCOMPATIBLE_OR_UNVERIFIED');
  componentStates['afyx-graph'] = { ...componentStates['afyx-graph'], compatible: true };
  discovery = discoverAfyxCapabilities({
    componentStates,
    provider: 'codex',
    providerPermissions: { 'afyx-graph': false },
  });
  assert.equal(discovery.capabilities['afyx-graph'].reason, 'UNAUTHORIZED_OR_UNVERIFIED');
});

test('Graph freshness and component source identity require positive evidence', () => {
  const componentStates = state(['afyx-graph']);
  componentStates['afyx-graph'] = { ...componentStates['afyx-graph'], indexFresh: false };
  let discovery = discoverAfyxCapabilities({ componentStates, provider: 'codex' });
  assert.equal(discovery.capabilities['afyx-graph'].reason, 'GRAPH_INDEX_NOT_READY_OR_FRESH');
  componentStates['afyx-graph'] = {
    ...componentStates['afyx-graph'],
    indexFresh: true,
    sourceIdentity: null,
  };
  discovery = discoverAfyxCapabilities({ componentStates, provider: 'codex' });
  assert.equal(discovery.capabilities['afyx-graph'].reason, 'SOURCE_IDENTITY_UNVERIFIED');
});

test('tool, capability, and context budgets are enforced honestly', async () => {
  const result = await executeAfyxCapabilityRoute({
    ...options({
      taskType: 'odoo-impact-analysis',
      project: { isOdoo: true },
      needsRelationalEvidence: true,
      needsContextOptimization: true,
    }, ['odoo-engineering', 'afyx-graph', 'afyx-context']),
    budgetLimits: { maxToolCalls: 1, maxCapabilities: 2, maxContextBytes: 8, maxExecutionMs: 5000, maxHops: 1 },
    adapters: {
      'odoo-engineering': () => ({ status: 'SUCCESS', contextBytes: 9 }),
      'afyx-graph': () => ({ status: 'SUCCESS' }),
      'afyx-context': () => ({ status: 'SUCCESS' }),
    },
  });
  assert.equal(result.metrics.executedCapabilities, 1);
  assert.equal(result.metrics.contextBytes, 9);
  assert.equal(result.degradations.some((item) => item.reason === 'CAPABILITY_BUDGET_EXHAUSTED'), true);
});
