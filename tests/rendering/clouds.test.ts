import { describe, expect, it } from 'vitest';

import { buildCloudLayouts } from '../../src/rendering/clouds.ts';

describe('buildCloudLayouts', () => {
  it('returns deterministic cloud positions and shapes for the same inputs', () => {
    const first = buildCloudLayouts(12.5, -8.25, 18, { seed: 42 });
    const second = buildCloudLayouts(12.5, -8.25, 18, { seed: 42 });

    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
  });

  it('keeps clouds inside the configured field while placing them high above the terrain', () => {
    const layouts = buildCloudLayouts(0, 0, 0, {
      seed: 7,
      gridRadius: 2,
      tileSize: 24,
      density: 1,
    });

    expect(layouts.length).toBeGreaterThan(0);

    for (const layout of layouts) {
      expect(layout.x).toBeGreaterThanOrEqual(-51);
      expect(layout.x).toBeLessThanOrEqual(51);
      expect(layout.z).toBeGreaterThanOrEqual(-48);
      expect(layout.z).toBeLessThanOrEqual(48);
      expect(layout.y).toBe(34);
      expect(layout.segments.length).toBeGreaterThanOrEqual(3);
      expect(layout.segments.length).toBeLessThanOrEqual(5);
      for (const segment of layout.segments) {
        expect(segment.offsetY).toBe(0);
        expect(segment.scaleY).toBe(0.7);
      }
    }
  });

  it('moves clouds over time without changing which nearby cells are populated', () => {
    const atStart = buildCloudLayouts(4, 4, 0, { seed: 99, tileSize: 28, gridRadius: 3 });
    const afterDrift = buildCloudLayouts(4, 4, 4, { seed: 99, tileSize: 28, gridRadius: 3 });

    expect(afterDrift.map((layout) => layout.key)).toEqual(atStart.map((layout) => layout.key));
    expect(afterDrift.some((layout, index) => layout.x !== atStart[index]?.x)).toBe(true);
  });

  it('uses a sparse field so the sky stays readable between cloud clusters', () => {
    const layouts = buildCloudLayouts(0, 0, 0, {
      seed: 11,
      gridRadius: 4,
      density: 0.38,
    });

    expect(layouts.length).toBeGreaterThan(8);
    expect(layouts.length).toBeLessThan(45);
  });
});
