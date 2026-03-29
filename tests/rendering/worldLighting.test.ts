import { describe, expect, it } from 'vitest';

import { getBlockFaceBrightness, getWorldLightingRigState } from '../../src/rendering/worldLighting.ts';

describe('getBlockFaceBrightness', () => {
  it('keeps top faces brighter than side and bottom faces for the same block brightness', () => {
    expect(getBlockFaceBrightness('stone', 0.78, 'py')).toBeGreaterThan(
      getBlockFaceBrightness('stone', 0.78, 'px'),
    );
    expect(getBlockFaceBrightness('stone', 0.78, 'px')).toBeGreaterThan(
      getBlockFaceBrightness('stone', 0.78, 'ny'),
    );
  });

  it('keeps water readable instead of letting it fall into terrain-dark values', () => {
    expect(getBlockFaceBrightness('water', 0.2, 'ny')).toBeGreaterThanOrEqual(0.42);
  });
});

describe('getWorldLightingRigState', () => {
  it('centers the sunlight target on the player and keeps a stable shadow frustum', () => {
    const state = getWorldLightingRigState(14, -6, 32);

    expect(state.targetPosition).toEqual({ x: 14, y: 6, z: -6 });
    expect(state.sunPosition.x).toBeGreaterThan(state.targetPosition.x);
    expect(state.sunPosition.z).toBeGreaterThan(state.targetPosition.z);
    expect(state.shadowBounds.left).toBeLessThan(0);
    expect(state.shadowBounds.right).toBeGreaterThan(0);
    expect(state.shadowBounds.top).toBe(-state.shadowBounds.bottom);
    expect(state.shadowBounds.far).toBeGreaterThan(state.shadowBounds.right);
  });
});
