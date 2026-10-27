/** Versioned provider-capability and provider-neutral engineering contracts. */

export const PROVIDER_CAPABILITY_CONTRACT = 'ProviderCapability/v1';
export const PROVIDER_NEGOTIATION_CONTRACT = 'ProviderCapabilityNegotiation/v1';
export const ENGINEERING_TASK_CONTRACT = 'AfyxEngineeringTask/v1';
export const ENGINEERING_RESULT_CONTRACT = 'AfyxEngineeringResult/v1';

const ACCEPTANCE_STATES = new Set(['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN']);
const COMPLETENESS_STATES = new Set(['COMPLETE', 'PARTIAL', 'UNKNOWN']);
const RESULT_STATES = new Set(['SUCCEEDED', 'FAILED', 'BLOCKED', 'UNSUPPORTED', 'NOT_RUN']);
const SEVERITIES = new Set(['INFO', 'WARNING', 'ERROR']);
const VERIFICATION_LEVELS = new Set(['DECLARED', 'RUNTIME']);
const INTEGRATION_COMPONENTS = new Set(['afyx-graph', 'afyx-context']);
const KNOWN_CAPABILITIES = Object.freeze([
  'configuration', 'hooks', 'instructions', 'lifecycle', 'mcp', 'provider-routing', 'skills',
  'scope:cli-global', 'scope:global', 'scope:ide-global', 'scope:workspace',
  'surface:cli', 'surface:ide',
]);

export class ContractValidationError extends Error {
  constructor(path, message) {
    super(`${path}: ${message}`);
    this.name = 'ContractValidationError';
    this.code = 'INVALID_CONTRACT';
    this.path = path;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function object(value, path, allowed) {
  if (!isObject(value)) throw new ContractValidationError(path, 'must be an object');
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new ContractValidationError(path, `contains unknown field ${unknown.sort()[0]}`);
  return value;
}

function text(value, path, max = 512) {
  if (typeof value !== 'string' || value.length === 0 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new ContractValidationError(path, 'must be a non-empty printable string');
  }
  if (Buffer.byteLength(value, 'utf8') > max) throw new ContractValidationError(path, `exceeds ${max} bytes`);
  return value;
}

function optionalText(value, path, max = 512) {
  return value === undefined || value === null ? null : text(value, path, max);
}

function choice(value, path, allowed) {
  if (!allowed.has(value)) throw new ContractValidationError(path, `has unsupported value ${String(value)}`);
  return value;
}

function boolean(value, path, fallback = undefined) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'boolean') throw new ContractValidationError(path, 'must be boolean');
  return value;
}

function list(value, path, maximum = 256) {
  if (!Array.isArray(value)) throw new ContractValidationError(path, 'must be an array');
  if (value.length > maximum) throw new ContractValidationError(path, `exceeds ${maximum} items`);
  return value;
}

function split(value) {
  return typeof value === 'string' ? value.split(';').filter(Boolean) : [];
}

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

function stableValue(value, path = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item, index) => stableValue(item, `${path}[${index}]`));
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key], `${path}.${key}`)]));
  }
  throw new ContractValidationError(path, 'must contain only JSON-compatible values');
}

export function serializeContract(value) {
  return JSON.stringify(stableValue(value));
}

function malformedDiscovery(definition, diagnostic) {
  return freeze({
    contract: PROVIDER_CAPABILITY_CONTRACT,
    provider: { id: String(definition?.provider || 'unknown'), name: String(definition?.name || 'Unknown') },
    status: 'BLOCKED',
    host: { commands: [], detected: null, command: null, version: null, status: 'BLOCKED', evidence: 'NONE', runtimeVerified: false },
    surfaces: [],
    scopes: { lifecycle: [], mcp: [], skills: [] },
    ownership: { class: 'USER', configurationPolicy: 'observe-only' },
    capabilities: [],
    acceptance: 'NOT_RUN',
    mutationAuthorized: false,
    diagnostics: [{ code: diagnostic, severity: 'ERROR', message: 'Capability metadata failed validation.' }],
  });
}

function hostObservation(value) {
  if (value === undefined) return { detected: null, command: null, version: null, evidence: 'NONE' };
  const host = object(value, 'host', ['detected', 'command', 'version', 'evidence']);
  const detected = host.detected === undefined ? null : boolean(host.detected, 'host.detected');
  const command = optionalText(host.command, 'host.command', 256);
  const version = optionalText(host.version, 'host.version', 256);
  const evidence = host.evidence === undefined ? 'NONE' : choice(host.evidence, 'host.evidence', new Set(['NONE', 'CALLER', 'FILESYSTEM']));
  if (detected === true && command === null) throw new ContractValidationError('host.command', 'is required when detected is true');
  return { detected, command, version, evidence };
}

function capabilityRecord(id, declared, host) {
  if (id === 'surface:cli' && declared) {
    if (host.detected === false) return { id, declared: true, status: 'BLOCKED', runtimeVerified: false, evidence: host.evidence };
    if (host.detected === null) return { id, declared: true, status: 'UNVERIFIED', runtimeVerified: false, evidence: 'DECLARED' };
    return { id, declared: true, status: 'UNVERIFIED', runtimeVerified: false, evidence: host.evidence };
  }
  if (id === 'surface:ide' && declared) {
    return { id, declared: true, status: 'UNVERIFIED', runtimeVerified: false, evidence: 'DECLARED' };
  }
  return declared
    ? { id, declared: true, status: 'SUPPORTED', runtimeVerified: false, evidence: 'DECLARED' }
    : { id, declared: false, status: 'UNSUPPORTED', runtimeVerified: false, evidence: 'REGISTRY' };
}

export function discoverProviderCapabilities(definition, adapterCapabilities, options = {}) {
  try {
    object(options, 'options', ['host']);
    const provider = text(definition?.provider, 'provider.provider', 128);
    const name = text(definition?.name, 'provider.name', 256);
    const ownershipClass = choice(definition?.ownership_class, 'provider.ownership_class', new Set(['AFYX', 'EXTERNAL', 'USER']));
    const configurationPolicy = choice(
      definition?.configuration_policy,
      'provider.configuration_policy',
      new Set(['merge-afyx-owned-entries-only', 'observe-only']),
    );
    const commands = split(definition?.host_commands).map((item, index) => text(item, `provider.host_commands[${index}]`, 256));
    const surfaces = split(definition?.surfaces).map((item, index) => text(item, `provider.surfaces[${index}]`, 128));
    const lifecycleScopes = (adapterCapabilities?.scopes || []).map((item, index) => text(item, `adapter.scopes[${index}]`, 128));
    const mcpScopes = split(definition?.mcp_scopes).map((item, index) => text(item, `provider.mcp_scopes[${index}]`, 128));
    const skillScopes = split(definition?.skill_scopes).map((item, index) => text(item, `provider.skill_scopes[${index}]`, 128));
    const instructionScopes = split(definition?.instruction_scopes).map((item, index) => text(item, `provider.instruction_scopes[${index}]`, 128));
    const host = hostObservation(options.host);
    const declared = new Set([
      ...split(definition?.capabilities),
      ...surfaces.map((item) => `surface:${item}`),
      ...[...new Set([...lifecycleScopes, ...mcpScopes, ...skillScopes, ...instructionScopes])].map((item) => `scope:${item}`),
      'configuration',
      'lifecycle',
    ]);
    const capabilities = KNOWN_CAPABILITIES.map((id) => capabilityRecord(id, declared.has(id), host));
    const hostStatus = host.detected === false ? 'BLOCKED' : 'UNVERIFIED';
    return freeze({
      contract: PROVIDER_CAPABILITY_CONTRACT,
      provider: { id: provider, name },
      status: hostStatus,
      host: { commands, ...host, status: hostStatus, runtimeVerified: false },
      surfaces,
      scopes: { lifecycle: lifecycleScopes, mcp: mcpScopes, skills: skillScopes, instructions: instructionScopes },
      ownership: { class: ownershipClass, configurationPolicy },
      capabilities,
      acceptance: 'NOT_RUN',
      mutationAuthorized: false,
      diagnostics: [],
    });
  } catch (error) {
    return malformedDiscovery(definition, error instanceof ContractValidationError ? 'MALFORMED_CAPABILITY_METADATA' : 'CAPABILITY_DISCOVERY_FAILED');
  }
}

export function negotiateProviderCapabilities(discovery, requirements) {
  const blocked = (code, message) => freeze({
    contract: PROVIDER_NEGOTIATION_CONTRACT,
    provider: typeof discovery?.provider?.id === 'string' ? discovery.provider.id : 'unknown',
    status: 'BLOCKED',
    requirements: [],
    mutationAuthorized: false,
    diagnostics: [{ code, severity: 'ERROR', message }],
  });
  try {
    if (!isObject(discovery) || discovery.contract !== PROVIDER_CAPABILITY_CONTRACT || !Array.isArray(discovery.capabilities)) {
      return blocked('MALFORMED_DISCOVERY', 'Capability discovery is invalid.');
    }
    if (discovery.status === 'BLOCKED') {
      return blocked('DISCOVERY_BLOCKED', 'Capability discovery is blocked.');
    }
    const requested = list(requirements, 'requirements', 128).map((requirement, index) => {
      const path = `requirements[${index}]`;
      const item = object(requirement, path, ['capability', 'required', 'verification']);
      return {
        capability: text(item.capability, `${path}.capability`, 128),
        required: boolean(item.required, `${path}.required`, true),
        verification: item.verification === undefined ? 'DECLARED' : choice(item.verification, `${path}.verification`, VERIFICATION_LEVELS),
      };
    });
    const available = new Map(discovery.capabilities.map((item) => [item.id, item]));
    const evaluated = requested.map((requirement) => {
      const capability = available.get(requirement.capability);
      let status = 'BLOCKED';
      let reason = capability ? '' : 'UNKNOWN_CAPABILITY';
      if (capability) {
        if (!capability.declared) status = 'UNSUPPORTED';
        else if (requirement.verification === 'DECLARED') status = 'SUPPORTED';
        else if (capability.runtimeVerified) status = 'SUPPORTED';
        else if (capability.status === 'BLOCKED') status = 'BLOCKED';
        else {
          status = 'UNVERIFIED';
          reason = 'RUNTIME_EVIDENCE_ABSENT';
        }
      }
      return { ...requirement, status, ...(reason ? { reason } : {}) };
    });
    const required = evaluated.filter((item) => item.required);
    const status = required.some((item) => item.status === 'BLOCKED') ? 'BLOCKED'
      : required.some((item) => item.status === 'UNSUPPORTED') ? 'UNSUPPORTED'
        : required.some((item) => item.status === 'UNVERIFIED') ? 'UNVERIFIED' : 'SUPPORTED';
    return freeze({
      contract: PROVIDER_NEGOTIATION_CONTRACT,
      provider: discovery.provider.id,
      status,
      requirements: evaluated,
      mutationAuthorized: false,
      diagnostics: evaluated.filter((item) => item.reason).map((item) => ({ code: item.reason, severity: 'WARNING', message: `Capability ${item.capability} is not runtime-verified.` })),
    });
  } catch {
    return blocked('MALFORMED_REQUIREMENTS', 'Capability requirements failed validation.');
  }
}

function provenance(value, path) {
  const item = object(value, path, ['source', 'reference', 'digest']);
  return {
    source: text(item.source, `${path}.source`, 256),
    ...(item.reference === undefined ? {} : { reference: text(item.reference, `${path}.reference`, 32_767) }),
    ...(item.digest === undefined ? {} : { digest: text(item.digest, `${path}.digest`, 256) }),
  };
}

function capabilityRequirements(value, path) {
  return list(value, path, 128).map((requirement, index) => {
    const at = `${path}[${index}]`;
    const item = object(requirement, at, ['capability', 'required', 'verification']);
    return {
      capability: text(item.capability, `${at}.capability`, 128),
      required: boolean(item.required, `${at}.required`, true),
      verification: item.verification === undefined ? 'DECLARED' : choice(item.verification, `${at}.verification`, VERIFICATION_LEVELS),
    };
  });
}

function integrations(value, path) {
  if (value === undefined) return [];
  return list(value, path, 8).map((integration, index) => {
    const at = `${path}[${index}]`;
    const item = object(integration, at, ['component', 'contract', 'status', 'reference']);
    return {
      component: choice(item.component, `${at}.component`, INTEGRATION_COMPONENTS),
      contract: text(item.contract, `${at}.contract`, 256),
      status: choice(item.status, `${at}.status`, new Set(['AVAILABLE', 'UNAVAILABLE', 'BLOCKED', 'NOT_RUN'])),
      ...(item.reference === undefined ? {} : { reference: text(item.reference, `${at}.reference`, 32_767) }),
    };
  });
}

export function createEngineeringTask(input) {
  const root = object(input, 'taskContract', ['contract', 'task', 'workspace', 'context', 'requirements', 'integrations']);
  if (root.contract !== undefined && root.contract !== ENGINEERING_TASK_CONTRACT) {
    throw new ContractValidationError('taskContract.contract', 'has an unsupported contract version');
  }
  const task = object(root.task, 'taskContract.task', ['id', 'operation']);
  const workspace = object(root.workspace, 'taskContract.workspace', ['id', 'root', 'revision']);
  const context = object(root.context, 'taskContract.context', ['sources', 'completeness']);
  const sources = list(context.sources, 'taskContract.context.sources', 256).map((source, index) => {
    const at = `taskContract.context.sources[${index}]`;
    const item = object(source, at, ['id', 'type', 'completeness', 'provenance']);
    return {
      id: text(item.id, `${at}.id`, 512),
      type: text(item.type, `${at}.type`, 128),
      completeness: choice(item.completeness, `${at}.completeness`, COMPLETENESS_STATES),
      provenance: provenance(item.provenance, `${at}.provenance`),
    };
  });
  return freeze({
    contract: ENGINEERING_TASK_CONTRACT,
    task: { id: text(task.id, 'taskContract.task.id', 512), operation: text(task.operation, 'taskContract.task.operation', 256) },
    workspace: {
      id: text(workspace.id, 'taskContract.workspace.id', 512),
      ...(workspace.root === undefined ? {} : { root: text(workspace.root, 'taskContract.workspace.root', 32_767) }),
      ...(workspace.revision === undefined ? {} : { revision: text(workspace.revision, 'taskContract.workspace.revision', 512) }),
    },
    context: { sources, completeness: choice(context.completeness, 'taskContract.context.completeness', COMPLETENESS_STATES) },
    requirements: capabilityRequirements(root.requirements, 'taskContract.requirements'),
    integrations: integrations(root.integrations, 'taskContract.integrations'),
  });
}

export function validateEngineeringTask(value) {
  if (!isObject(value) || value.contract !== ENGINEERING_TASK_CONTRACT) {
    throw new ContractValidationError('taskContract.contract', 'must identify AfyxEngineeringTask/v1');
  }
  return createEngineeringTask(value);
}

export function createEngineeringResult(input) {
  const root = object(input, 'resultContract', ['contract', 'taskId', 'status', 'output', 'evidence', 'diagnostics', 'integrations']);
  if (root.contract !== undefined && root.contract !== ENGINEERING_RESULT_CONTRACT) {
    throw new ContractValidationError('resultContract.contract', 'has an unsupported contract version');
  }
  const evidence = list(root.evidence, 'resultContract.evidence', 256).map((entry, index) => {
    const at = `resultContract.evidence[${index}]`;
    const item = object(entry, at, ['id', 'type', 'validation', 'provenance']);
    return {
      id: text(item.id, `${at}.id`, 512),
      type: text(item.type, `${at}.type`, 128),
      validation: choice(item.validation, `${at}.validation`, ACCEPTANCE_STATES),
      provenance: provenance(item.provenance, `${at}.provenance`),
    };
  });
  const diagnostics = list(root.diagnostics, 'resultContract.diagnostics', 256).map((diagnostic, index) => {
    const at = `resultContract.diagnostics[${index}]`;
    const item = object(diagnostic, at, ['code', 'severity', 'message']);
    return {
      code: text(item.code, `${at}.code`, 128),
      severity: choice(item.severity, `${at}.severity`, SEVERITIES),
      message: text(item.message, `${at}.message`, 4096),
    };
  });
  return freeze({
    contract: ENGINEERING_RESULT_CONTRACT,
    taskId: text(root.taskId, 'resultContract.taskId', 512),
    status: choice(root.status, 'resultContract.status', RESULT_STATES),
    ...(root.output === undefined ? {} : { output: stableValue(root.output, 'resultContract.output') }),
    evidence,
    diagnostics,
    integrations: integrations(root.integrations, 'resultContract.integrations'),
  });
}

export function validateEngineeringResult(value) {
  if (!isObject(value) || value.contract !== ENGINEERING_RESULT_CONTRACT) {
    throw new ContractValidationError('resultContract.contract', 'must identify AfyxEngineeringResult/v1');
  }
  return createEngineeringResult(value);
}
