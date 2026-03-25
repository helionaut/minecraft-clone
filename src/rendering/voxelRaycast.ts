import type { SolidBlockType } from '../gameplay/world.ts';

export interface Vector3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CellTarget {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly type: SolidBlockType;
}

export interface PlacementCell {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface TargetingResult {
  readonly target: CellTarget | null;
  readonly placement: PlacementCell | null;
}

function floorCell(value: number): number {
  return Math.floor(value);
}

function nextStepDelta(position: number, direction: number, cell: number): number {
  if (direction > 0) {
    return (cell + 1 - position) / direction;
  }

  if (direction < 0) {
    return (position - cell) / -direction;
  }

  return Number.POSITIVE_INFINITY;
}

export function getLookDirection(yaw: number, pitch: number): Vector3Like {
  const cosPitch = Math.cos(pitch);

  return {
    x: -Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cosPitch,
  };
}

export function traceVoxelTarget(
  origin: Vector3Like,
  direction: Vector3Like,
  maxDistance: number,
  getBlock: (x: number, y: number, z: number) => SolidBlockType | null,
): TargetingResult {
  let x = floorCell(origin.x);
  let y = floorCell(origin.y);
  let z = floorCell(origin.z);

  const stepX = Math.sign(direction.x);
  const stepY = Math.sign(direction.y);
  const stepZ = Math.sign(direction.z);

  const deltaX = direction.x === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / direction.x);
  const deltaY = direction.y === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / direction.y);
  const deltaZ = direction.z === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / direction.z);

  let sideX = nextStepDelta(origin.x, direction.x, x);
  let sideY = nextStepDelta(origin.y, direction.y, y);
  let sideZ = nextStepDelta(origin.z, direction.z, z);
  let previousCell: PlacementCell | null = null;

  for (;;) {
    const block = getBlock(x, y, z);

    if (block) {
      return {
        target: { x, y, z, type: block },
        placement: previousCell,
      };
    }

    if (sideX <= sideY && sideX <= sideZ) {
      if (sideX > maxDistance) {
        break;
      }

      previousCell = { x, y, z };
      x += stepX;
      sideX += deltaX;
      continue;
    }

    if (sideY <= sideZ) {
      if (sideY > maxDistance) {
        break;
      }

      previousCell = { x, y, z };
      y += stepY;
      sideY += deltaY;
      continue;
    }

    if (sideZ > maxDistance) {
      break;
    }

    previousCell = { x, y, z };
    z += stepZ;
    sideZ += deltaZ;
  }

  return {
    target: null,
    placement: null,
  };
}
