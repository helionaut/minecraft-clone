import { BLOCK_DEFINITIONS, type WorldBlockType } from './blocks.ts';

export interface LightBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface CellLight {
  readonly sunlight: number;
  readonly blocklight: number;
}

export interface VoxelLightResult {
  readonly bounds: LightBounds;
  getCellLight: (x: number, y: number, z: number) => CellLight;
  getBlockBrightness: (x: number, y: number, z: number) => number;
}

export interface VoxelLightingProfiler {
  measureSync<T>(name: string, run: () => T): T;
  recordPhaseMetrics?(name: string, metrics: Readonly<Record<string, number>>): void;
}

interface MutableCellLight {
  sunlight: number;
  blocklight: number;
}

interface QueueEntry {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const CARDINAL_NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function createKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function getLightAttenuation(type: WorldBlockType | null): number {
  return type ? BLOCK_DEFINITIONS[type].lightAttenuation : 0;
}

function isOpaque(type: WorldBlockType | null): boolean {
  return type ? BLOCK_DEFINITIONS[type].opaque : false;
}

export function computeVoxelLighting(
  bounds: LightBounds,
  getBlock: (x: number, y: number, z: number) => WorldBlockType | null,
  profiler?: VoxelLightingProfiler,
): VoxelLightResult {
  const lights = new Map<string, MutableCellLight>();
  const queue: QueueEntry[] = [];
  let lightWrites = 0;
  const expanded = {
    minX: bounds.minX - 1,
    maxX: bounds.maxX + 1,
    minY: bounds.minY,
    maxY: bounds.maxY + 1,
    minZ: bounds.minZ - 1,
    maxZ: bounds.maxZ + 1,
  };

  const inBounds = (x: number, y: number, z: number): boolean =>
    x >= expanded.minX &&
    x <= expanded.maxX &&
    y >= expanded.minY &&
    y <= expanded.maxY &&
    z >= expanded.minZ &&
    z <= expanded.maxZ;

  const setLight = (
    x: number,
    y: number,
    z: number,
    sunlight: number,
    blocklight: number,
  ): void => {
    if (!inBounds(x, y, z)) {
      return;
    }

    const key = createKey(x, y, z);
    const current = lights.get(key) ?? { sunlight: 0, blocklight: 0 };
    const nextSunlight = Math.max(current.sunlight, sunlight);
    const nextBlocklight = Math.max(current.blocklight, blocklight);

    if (nextSunlight === current.sunlight && nextBlocklight === current.blocklight) {
      return;
    }

    lights.set(key, { sunlight: nextSunlight, blocklight: nextBlocklight });
    queue.push({ x, y, z });
    lightWrites += 1;
  };
  const measurePhase = <T,>(name: string, run: () => T): T => profiler ? profiler.measureSync(name, run) : run();

  measurePhase('seed-sunlight-columns', () => {
    const columnCount = (expanded.maxX - expanded.minX + 1) * (expanded.maxZ - expanded.minZ + 1);
    const cellVisits = columnCount * (expanded.maxY - expanded.minY + 1);
    for (let x = expanded.minX; x <= expanded.maxX; x += 1) {
      for (let z = expanded.minZ; z <= expanded.maxZ; z += 1) {
        let sunlight = 15;

        for (let y = expanded.maxY; y >= expanded.minY; y -= 1) {
          const type = getBlock(x, y, z);

          if (isOpaque(type)) {
            sunlight = 0;
            continue;
          }

          if (sunlight > 0) {
            setLight(x, y, z, sunlight, 0);
          }

          sunlight = Math.max(0, sunlight - getLightAttenuation(type));
        }
      }
    }
    profiler?.recordPhaseMetrics?.('seed-sunlight-columns', {
      columnCount,
      cellVisits,
    });
  });

  measurePhase('seed-emissive-blocks', () => {
    let scannedCells = 0;
    let emissiveBlocks = 0;
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
        for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
          scannedCells += 1;
          const type = getBlock(x, y, z);

          if (!type) {
            continue;
          }

          const emittedLight = BLOCK_DEFINITIONS[type].emittedLight;

          if (emittedLight > 0) {
            emissiveBlocks += 1;
            setLight(x, y, z, 0, emittedLight);
          }
        }
      }
    }
    profiler?.recordPhaseMetrics?.('seed-emissive-blocks', {
      scannedCells,
      emissiveBlocks,
    });
  });

  measurePhase('propagate-light-queue', () => {
    const queueSeeds = queue.length;
    let processedEntries = 0;
    let neighborChecks = 0;
    const lightWritesBeforePropagation = lightWrites;
    for (let index = 0; index < queue.length; index += 1) {
      processedEntries += 1;
      const entry = queue[index];
      const source = lights.get(createKey(entry.x, entry.y, entry.z));

      if (!source) {
        continue;
      }

      for (const [dx, dy, dz] of CARDINAL_NEIGHBORS) {
        neighborChecks += 1;
        const x = entry.x + dx;
        const y = entry.y + dy;
        const z = entry.z + dz;

        if (!inBounds(x, y, z)) {
          continue;
        }

        const type = getBlock(x, y, z);

        if (isOpaque(type)) {
          continue;
        }

        const attenuation = 1 + getLightAttenuation(type);
        const sunlight = Math.max(0, source.sunlight - attenuation);
        const blocklight = Math.max(0, source.blocklight - attenuation);

        if (sunlight === 0 && blocklight === 0) {
          continue;
        }

        setLight(x, y, z, sunlight, blocklight);
      }
    }
    profiler?.recordPhaseMetrics?.('propagate-light-queue', {
      queueSeeds,
      processedEntries,
      neighborChecks,
      lightWrites: lightWrites - lightWritesBeforePropagation,
    });
  });

  return {
    bounds,
    getCellLight: (x, y, z) => lights.get(createKey(x, y, z)) ?? { sunlight: 0, blocklight: 0 },
    getBlockBrightness: (x, y, z) => {
      const type = getBlock(x, y, z);

      if (!type) {
        return 0.12;
      }

      let brightest = BLOCK_DEFINITIONS[type].emittedLight;

      for (const [dx, dy, dz] of CARDINAL_NEIGHBORS) {
        const neighbor = lights.get(createKey(x + dx, y + dy, z + dz));

        if (!neighbor) {
          continue;
        }

        brightest = Math.max(brightest, neighbor.sunlight, neighbor.blocklight);
      }

      return 0.18 + (brightest / 15) * 0.82;
    },
  };
}
