import { describe, expect, it } from 'vitest';

import { DEFAULT_WORLD_CONFIG } from '../../src/gameplay/world.ts';
import { getVisibleBoundsForPlayer } from '../../src/rendering/renderBounds.ts';

describe('getVisibleBoundsForPlayer', () => {
  it('keeps the render volume centered on the player chunk while clamping vertical range', () => {
    const bounds = getVisibleBoundsForPlayer(
      { x: 0.5, y: 12.6, z: 0.5 },
      DEFAULT_WORLD_CONFIG,
      1,
    );

    expect(bounds.minX).toBe(-16);
    expect(bounds.maxX).toBe(31);
    expect(bounds.minZ).toBe(-16);
    expect(bounds.maxZ).toBe(31);
    expect(bounds.minY).toBe(0);
    expect(bounds.maxY).toBe(33);
  });

  it('never renders below or above the configured world limits', () => {
    const lowBounds = getVisibleBoundsForPlayer(
      { x: 0.5, y: -44.1, z: 0.5 },
      DEFAULT_WORLD_CONFIG,
      1,
    );
    const highBounds = getVisibleBoundsForPlayer(
      { x: 0.5, y: 54.9, z: 0.5 },
      DEFAULT_WORLD_CONFIG,
      1,
    );

    expect(lowBounds.minY).toBe(DEFAULT_WORLD_CONFIG.minY);
    expect(highBounds.maxY).toBe(DEFAULT_WORLD_CONFIG.maxY + 1);
  });
});
