import { describe, expect, it } from 'vitest';

import {
  computeGodRayVisibility,
  getGodRayBeamLayouts,
  getGodRayState,
} from '../../src/rendering/godRays.ts';

describe('getGodRayBeamLayouts', () => {
  it('returns a deterministic beam stack with varied widths and depths', () => {
    const beams = getGodRayBeamLayouts();

    expect(beams).toHaveLength(6);
    expect(beams.map((beam) => beam.width)).toEqual([6.8, 5.6, 7.4, 4.8, 6.1, 4.2]);
    expect(new Set(beams.map((beam) => beam.depth))).toHaveLength(beams.length);
  });
});

describe('computeGodRayVisibility', () => {
  it('gets brighter when the camera looks toward the sun', () => {
    const towardSun = computeGodRayVisibility(
      { x: 0, y: 10, z: 0 },
      { x: 0.68, y: 0.42, z: 0.6 },
      { x: 24, y: 30, z: 22 },
    );
    const awayFromSun = computeGodRayVisibility(
      { x: 0, y: 10, z: 0 },
      { x: -0.68, y: -0.1, z: -0.6 },
      { x: 24, y: 30, z: 22 },
    );

    expect(towardSun).toBeGreaterThan(0.4);
    expect(awayFromSun).toBe(0);
  });

  it('suppresses the effect when the sun falls below the horizon line', () => {
    const visibility = computeGodRayVisibility(
      { x: 0, y: 16, z: 0 },
      { x: 0, y: 0.6, z: 1 },
      { x: 0, y: 12, z: 28 },
    );

    expect(visibility).toBe(0);
  });
});

describe('getGodRayState', () => {
  it('anchors the beams between the player and sun while preserving the sun direction', () => {
    const state = getGodRayState({
      playerPosition: { x: 4, y: 8, z: -3 },
      cameraPosition: { x: 4, y: 9.6, z: -3 },
      cameraDirection: { x: 0.74, y: 0.26, z: 0.62 },
      sunPosition: { x: 30, y: 34, z: 18 },
      targetPosition: { x: 4, y: 6, z: -3 },
    });

    expect(state.visibility).toBeGreaterThan(0);
    expect(state.anchorPosition.x).toBeGreaterThan(10);
    expect(state.anchorPosition.x).toBeLessThan(24);
    expect(state.anchorPosition.y).toBeGreaterThan(18);
    expect(state.anchorPosition.y).toBeLessThan(30);
    expect(state.direction.x).toBeGreaterThan(0.5);
    expect(state.direction.y).toBeGreaterThan(0.5);
    expect(state.direction.z).toBeGreaterThan(0.4);
  });
});
