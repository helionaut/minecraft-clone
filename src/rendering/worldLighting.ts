import type { WorldBlockType } from '../gameplay/blocks.ts';

export type LightingFace = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

export interface WorldLightingRigState {
  readonly cycleProgress: number;
  readonly daylight: number;
  readonly horizonGlow: number;
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
  readonly ambientSkyColor: number;
  readonly ambientGroundColor: number;
  readonly ambientIntensity: number;
  readonly sunColor: number;
  readonly sunIntensity: number;
  readonly exposure: number;
}

export const DAY_NIGHT_CYCLE_DURATION_SECONDS = 180;

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

function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

function lerpColor(start: number, end: number, factor: number): number {
  const clampedFactor = clamp(factor, 0, 1);
  const startR = (start >> 16) & 0xff;
  const startG = (start >> 8) & 0xff;
  const startB = start & 0xff;
  const endR = (end >> 16) & 0xff;
  const endG = (end >> 8) & 0xff;
  const endB = end & 0xff;
  const red = Math.round(lerp(startR, endR, clampedFactor));
  const green = Math.round(lerp(startG, endG, clampedFactor));
  const blue = Math.round(lerp(startB, endB, clampedFactor));

  return (red << 16) | (green << 8) | blue;
}

export function getDayNightCycleProgress(elapsedSeconds: number): number {
  const normalizedElapsed = ((elapsedSeconds % DAY_NIGHT_CYCLE_DURATION_SECONDS) + DAY_NIGHT_CYCLE_DURATION_SECONDS)
    % DAY_NIGHT_CYCLE_DURATION_SECONDS;

  return (normalizedElapsed / DAY_NIGHT_CYCLE_DURATION_SECONDS + 0.25) % 1;
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
  elapsedSeconds = 0,
): WorldLightingRigState {
  const cycleProgress = getDayNightCycleProgress(elapsedSeconds);
  const orbitAngle = cycleProgress * Math.PI * 2 - Math.PI / 6;
  const solarElevation = Math.sin(cycleProgress * Math.PI * 2);
  const daylight = clamp((solarElevation + 0.16) / 1.16, 0, 1);
  const horizonGlow = Math.pow(clamp(1 - Math.abs(solarElevation) * 1.7, 0, 1), 1.3);
  const shadowRadius = Math.max(22, Math.round(visibleRadius * 0.9));
  const orbitX = Math.cos(orbitAngle) * 26;
  const orbitZ = Math.sin(orbitAngle) * 18;

  return {
    cycleProgress,
    daylight,
    horizonGlow,
    sunPosition: {
      x: playerX + orbitX,
      y: lerp(-18, 34, (solarElevation + 1) / 2),
      z: playerZ + orbitZ,
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
    ambientSkyColor: lerpColor(0x5b6f94, 0xdbefff, daylight),
    ambientGroundColor: lerpColor(0x3a342c, 0x7f684f, daylight),
    ambientIntensity: lerp(0.82, 1.45, daylight),
    sunColor: lerpColor(0xc9d6ff, 0xfff1c2, Math.max(daylight, horizonGlow * 0.7)),
    sunIntensity: lerp(0.55, 2.8, daylight),
    exposure: lerp(1.08, 1.18, daylight),
  };
}
