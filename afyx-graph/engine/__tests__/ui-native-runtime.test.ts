import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createViewport } from '../ui/src/native/viewport';

describe('native UI viewport', () => {
  let host: HTMLDivElement;
  let group: SVGGElement;

  beforeEach(() => {
    host = document.createElement('div');
    Object.defineProperty(host, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON() {} }),
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.append(group);
    host.append(svg);
    document.body.append(host);
  });

  afterEach(() => host.remove());

  it('fits, resets and clamps wheel zoom to finite bounds', () => {
    const viewport = createViewport(host, group, { width: 1600, height: 900 }, { minScale: 0.4, maxScale: 2 });
    viewport.fit();
    expect(viewport.state.scale).toBeGreaterThanOrEqual(0.4);
    expect(viewport.state.scale).toBeLessThanOrEqual(2);
    host.dispatchEvent(new WheelEvent('wheel', { deltaY: -100_000, clientX: 400, clientY: 300, bubbles: true, cancelable: true }));
    expect(viewport.state.scale).toBe(2);
    expect(group.getAttribute('transform')).not.toContain('NaN');
    expect(group.getAttribute('transform')).not.toContain('Infinity');
    viewport.reset();
    expect(viewport.state).toEqual({ x: 0, y: 0, scale: 1 });
    viewport.dispose();
  });
});

