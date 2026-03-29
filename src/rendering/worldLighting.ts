import type { WorldBlockType } from '../gameplay/blocks.ts';

export type LightingFace = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

export interface WorldLightingRigState {
  readonly sunPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly targetPosition: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly shadowBounds: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
    readonly near: number;
    readonly far: number;
  };
}

const FACE_LIGHT_MULTIPLIERS: Record<LightingFace, number> = {
  px: 0.88,
  nx: 0.76,
  py: 1.08,
  ny: 0.52,
  pz: 0.82,
  nz: 0.94,
};

const SURFACE_LIGHT_RESPONSE: Partial<Record<WorldBlockType, number>> = {
  water: 1.08,
  lava: 1.04,
  snow: 1.06,
  sand: 1.02,
  sandstone: 1.02,
  'oak-leaves': 0.96,
  deepslate: 0.94,
  bedrock: 0.9,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getBlockFaceBrightness(
  type: WorldBlockType,
  brightness: number,
  face: LightingFace,
): number {
  const baseBrightness = clamp(brightness, 0.18, 1);
  const faceBrightness = baseBrightness * FACE_LIGHT_MULTIPLIERS[face] * (SURFACE_LIGHT_RESPONSE[type] ?? 1);
  const minimumBrightness = type === 'water' ? 0.42 : type === 'lava' ? 0.6 : 0.18;
  const maximumBrightness = type === 'water' ? 1.08 : type === 'lava' ? 1.15 : 1;

  return clamp(faceBrightness, minimumBrightness, maximumBrightness);
}

export function getWorldLightingRigState(
  playerX: number,
  playerZ: number,
  visibleRadius: number,
): WorldLightingRigState {
  const shadowRadius = Math.max(22, Math.round(visibleRadius * 0.9));

  return {
    sunPosition: {
      x: playerX + 26,
      y: 34,
      z: playerZ + 18,
    },
    targetPosition: {
      x: playerX,
      y: 6,
      z: playerZ,
    },
    shadowBounds: {
      left: -shadowRadius,
      right: shadowRadius,
      top: shadowRadius,
      bottom: -shadowRadius,
      near: 1,
      far: shadowRadius * 3,
    },
  };
}
