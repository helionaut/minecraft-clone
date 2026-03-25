import { describe, expect, it } from 'vitest';

import type { SolidBlockType } from '../../src/gameplay/world.ts';
import { getLookDirection, traceVoxelTarget } from '../../src/rendering/voxelRaycast.ts';

describe('traceVoxelTarget', () => {
  it('hits the first occupied cell and returns the empty placement cell before it', () => {
    const blocks = new Map<string, SolidBlockType>([
      ['0,1,-2', 'grass'],
      ['0,1,-3', 'stone'],
    ]);
    const result = traceVoxelTarget(
      { x: 0.5, y: 1.6, z: 0.5 },
      { x: 0, y: 0, z: -1 },
      6,
      (x, y, z) => blocks.get(`${x},${y},${z}`) ?? null,
    );

    expect(result.target).toEqual({ x: 0, y: 1, z: -2, type: 'grass' });
    expect(result.placement).toEqual({ x: 0, y: 1, z: -1 });
  });

  it('returns no target when the ray never reaches an occupied cell', () => {
    const result = traceVoxelTarget(
      { x: 0.5, y: 1.6, z: 0.5 },
      { x: 0, y: 0, z: -1 },
      2,
      () => null,
    );

    expect(result.target).toBeNull();
    expect(result.placement).toBeNull();
  });

  it('tracks upward aim against the raised block instead of cells below the player', () => {
    const blocks = new Map<string, SolidBlockType>([
      ['0,2,-2', 'grass'],
      ['0,0,-2', 'stone'],
    ]);
    const result = traceVoxelTarget(
      { x: 0.5, y: 1.6, z: 0.5 },
      getLookDirection(0, 0.45),
      6,
      (x, y, z) => blocks.get(`${x},${y},${z}`) ?? null,
    );

    expect(result.target).toEqual({ x: 0, y: 2, z: -2, type: 'grass' });
  });
});

describe('getLookDirection', () => {
  it('starts slightly downward at the default spawn orientation', () => {
    const direction = getLookDirection(0, -0.12);

    expect(direction.y).toBeLessThan(0);
    expect(direction.z).toBeLessThan(0);
  });

  it('treats positive pitch as upward camera aim', () => {
    const direction = getLookDirection(0, 0.2);

    expect(direction.y).toBeGreaterThan(0);
    expect(direction.z).toBeLessThan(0);
  });
});
