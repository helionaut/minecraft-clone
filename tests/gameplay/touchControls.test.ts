import { describe, expect, it } from 'vitest';

import {
  movementInputFromTouchVector,
  normalizeStickVector,
} from '../../src/gameplay/touchControls.ts';

describe('normalizeStickVector', () => {
  it('returns a unit-clamped vector relative to the stick origin', () => {
    const vector = normalizeStickVector(
      { x: 100, y: 100 },
      { x: 160, y: 40 },
      40,
    );

    expect(vector.x).toBeCloseTo(0.707, 2);
    expect(vector.y).toBeCloseTo(-0.707, 2);
  });

  it('returns zero when the radius is invalid or the pointer does not move', () => {
    expect(
      normalizeStickVector({ x: 50, y: 50 }, { x: 50, y: 50 }, 64),
    ).toEqual({ x: 0, y: 0 });
    expect(
      normalizeStickVector({ x: 50, y: 50 }, { x: 80, y: 80 }, 0),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe('movementInputFromTouchVector', () => {
  it('maps the touch vector quadrants into movement flags', () => {
    expect(
      movementInputFromTouchVector({ x: -0.8, y: -0.6 }),
    ).toEqual({
      forward: true,
      backward: false,
      left: true,
      right: false,
    });

    expect(
      movementInputFromTouchVector({ x: 0.9, y: 0.7 }),
    ).toEqual({
      forward: false,
      backward: true,
      left: false,
      right: true,
    });
  });

  it('honors the deadzone before engaging movement', () => {
    expect(
      movementInputFromTouchVector({ x: 0.2, y: -0.18 }, 0.24),
    ).toEqual({
      forward: false,
      backward: false,
      left: false,
      right: false,
    });
  });
});
