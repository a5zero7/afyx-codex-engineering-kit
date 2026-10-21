import { AfyxContextEngine } from './engine.js';
import { AceError } from './errors.js';

export const ACE_INTEGRATION_CONTRACT = 'ace.integration/v1';
export const SUPPORTED_COMPONENTS = Object.freeze(['graph', 'engineering-expert', 'forge', 'kit']);

function renderOriginal(segments) {
  return segments.map((segment) => `[${segment.id}] ${segment.classification ?? 'normal'}\n${segment.content}`).join('\n\n');
}

/**
 * Optional, dependency-inverted adapter. The caller owns lifecycle and can
 * continue with `renderedContext` even when ACE is absent or fails.
 */
export function createOptionalIntegrationAdapter({ component, createEngine = (options) => new AfyxContextEngine(options) }) {
  if (!SUPPORTED_COMPONENTS.includes(component)) {
    throw new AceError('INVALID_INTEGRATION', `unsupported optional component: ${component}`);
  }
  return {
    contract: ACE_INTEGRATION_CONTRACT,
    component,
    process(request) {
      if (!request || request.contract !== ACE_INTEGRATION_CONTRACT) {
        throw new AceError('INVALID_INTEGRATION', `request contract must be ${ACE_INTEGRATION_CONTRACT}`);
      }
      if (request.component !== component) {
        throw new AceError('INVALID_INTEGRATION', `request component must be ${component}`);
      }
      const original = renderOriginal(request.segments ?? []);
      try {
        const engine = createEngine({ stateDir: request.stateDir, ownerId: request.ownerId, sessionId: request.sessionId });
        const result = engine.reduce(request);
        return { status: 'optimized', result, renderedContext: result.renderedContext };
      } catch (error) {
        return {
          status: 'fallback',
          failureCode: error instanceof AceError ? error.code : 'ACE_UNAVAILABLE',
          renderedContext: original,
        };
      }
    },
  };
}
