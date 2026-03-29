import { describe, expect, it } from 'vitest';

import {
  DAY_NIGHT_CYCLE_DURATION_SECONDS,
  getBlockFaceBrightness,
  getDayNightCycleProgress,
  getWorldLightingRigState,
} from '../../src/rendering/worldLighting.ts';

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
  it('uses a slower full day-night duration for a more natural pace', () => {
    expect(DAY_NIGHT_CYCLE_DURATION_SECONDS).toBe(600);
    expect(getDayNightCycleProgress(150)).toBeCloseTo(0.5);
  });

  it('centers the sunlight target on the player and keeps a stable shadow frustum', () => {
    const state = getWorldLightingRigState(14, -6, 32);

    expect(state.targetPosition).toEqual({ x: 14, y: 6, z: -6 });
    expect(Math.abs(state.sunPosition.x - state.targetPosition.x)).toBeGreaterThan(10);
    expect(Math.abs(state.sunPosition.z - state.targetPosition.z)).toBeGreaterThan(6);
    expect(state.shadowBounds.left).toBeLessThan(0);
    expect(state.shadowBounds.right).toBeGreaterThan(0);
    expect(state.shadowBounds.top).toBe(-state.shadowBounds.bottom);
    expect(state.shadowBounds.far).toBeGreaterThan(state.shadowBounds.right);
  });

  it('moves the sun below the horizon at night and dims the scene lighting', () => {
    const noon = getWorldLightingRigState(0, 0, 32, 0);
    const dusk = getWorldLightingRigState(0, 0, 32, DAY_NIGHT_CYCLE_DURATION_SECONDS / 4);
    const midnight = getWorldLightingRigState(0, 0, 32, DAY_NIGHT_CYCLE_DURATION_SECONDS / 2);

    expect(noon.daylight).toBeGreaterThan(0.95);
    expect(dusk.horizonGlow).toBeGreaterThan(0.8);
    expect(midnight.daylight).toBeLessThan(0.05);
    expect(noon.sunPosition.y).toBeGreaterThan(dusk.sunPosition.y);
    expect(dusk.sunPosition.y).toBeGreaterThan(midnight.sunPosition.y);
    expect(noon.ambientIntensity).toBeGreaterThan(midnight.ambientIntensity);
    expect(noon.sunIntensity).toBeGreaterThan(midnight.sunIntensity);
    expect(noon.exposure).toBeGreaterThan(midnight.exposure);
  });
});
