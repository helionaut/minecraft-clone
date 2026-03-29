import { describe, expect, it } from 'vitest';

import { getSkyBackdropTheme } from '../../src/rendering/skyBackdrop.ts';

describe('getSkyBackdropTheme', () => {
  it('returns a brighter sky theme during the day than at night', () => {
    const day = getSkyBackdropTheme(1, 0);
    const night = getSkyBackdropTheme(0, 0);

    expect(day.backgroundColor).not.toBe(night.backgroundColor);
    expect(day.fogFar).toBeGreaterThan(night.fogFar);
    expect(day.layers[0]?.opacity).toBeLessThan(night.layers[0]?.opacity);
  });

  it('warms the horizon near sunrise and sunset', () => {
    const dusk = getSkyBackdropTheme(0.42, 0.9);
    const noon = getSkyBackdropTheme(1, 0);

    expect(dusk.backgroundColor).not.toBe(noon.backgroundColor);
    expect(dusk.layers[1]?.color).not.toBe(noon.layers[1]?.color);
  });
});
