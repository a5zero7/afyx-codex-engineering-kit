import { parentPort } from 'node:worker_threads';
import { AfyxContextEngine } from './engine.js';
import { createOptionalIntegrationAdapter } from './integrations.js';

if (!parentPort) throw new Error('Graph–ACE integration worker requires a parent port');

parentPort.once('message', (message) => {
  try {
    if (message?.operation === 'reduce') {
      const adapter = createOptionalIntegrationAdapter({ component: 'graph' });
      parentPort.postMessage(adapter.process(message.request));
      return;
    }
    if (message?.operation === 'retrieve') {
      const engine = new AfyxContextEngine({
        stateDir: message.stateDir,
        ownerId: message.ownerId,
        sessionId: message.sessionId,
      });
      parentPort.postMessage({ status: 'recovered', record: engine.retrieveRecord(message.reference) });
      return;
    }
    parentPort.postMessage({ status: 'error', failureCode: 'INVALID_INTEGRATION', message: 'unknown worker operation' });
  } catch (error) {
    parentPort.postMessage({
      status: 'error',
      failureCode: typeof error?.code === 'string' ? error.code : 'ACE_UNAVAILABLE',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
