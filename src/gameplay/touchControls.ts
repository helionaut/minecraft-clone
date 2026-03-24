import type { InputState } from './player.ts';

export interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

export interface TouchVector {
  readonly x: number;
  readonly y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeStickVector(
  origin: TouchPoint,
  point: TouchPoint,
  maxRadius: number,
): TouchVector {
  if (maxRadius <= 0) {
    return { x: 0, y: 0 };
  }

  const deltaX = point.x - origin.x;
  const deltaY = point.y - origin.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance === 0) {
    return { x: 0, y: 0 };
  }

  const limitedDistance = Math.min(distance, maxRadius);
  const factor = limitedDistance / distance / maxRadius;

  return {
    x: clamp(deltaX * factor, -1, 1),
    y: clamp(deltaY * factor, -1, 1),
  };
}

export function movementInputFromTouchVector(
  vector: TouchVector,
  deadzone = 0.24,
): Pick<InputState, 'forward' | 'backward' | 'left' | 'right'> {
  return {
    forward: vector.y < -deadzone,
    backward: vector.y > deadzone,
    left: vector.x < -deadzone,
    right: vector.x > deadzone,
  };
}
