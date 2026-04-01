import type { Bounds3D } from '../gameplay/world.ts';

export interface ChunkTraversalWaypoint {
  readonly x: number;
  readonly z: number;
}

export function chunkKeyFromCoordinates(chunkX: number, chunkZ: number): string {
  return `${chunkX},${chunkZ}`;
}

export function chunkCoordinatesFromKey(key: string): {
  readonly chunkX: number;
  readonly chunkZ: number;
} {
  const [chunkX, chunkZ] = key.split(',').map(Number);
  return { chunkX, chunkZ };
}

function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

function sortChunkKeys(keys: Iterable<string>): string[] {
  return [...keys].sort((left, right) => {
    const leftCoordinates = chunkCoordinatesFromKey(left);
    const rightCoordinates = chunkCoordinatesFromKey(right);

    return leftCoordinates.chunkX - rightCoordinates.chunkX ||
      leftCoordinates.chunkZ - rightCoordinates.chunkZ;
  });
}

export function getVisibleChunkKeys(bounds: Bounds3D, chunkSize: number): string[] {
  const minChunkX = floorDiv(bounds.minX, chunkSize);
  const maxChunkX = floorDiv(bounds.maxX, chunkSize);
  const minChunkZ = floorDiv(bounds.minZ, chunkSize);
  const maxChunkZ = floorDiv(bounds.maxZ, chunkSize);
  const keys: string[] = [];

  for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
    for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += 1) {
      keys.push(chunkKeyFromCoordinates(chunkX, chunkZ));
    }
  }

  return keys;
}

export function planChunkMeshUpdates(input: {
  readonly currentVisibleChunkKeys: Iterable<string>;
  readonly nextVisibleChunkKeys: Iterable<string>;
  readonly dirtyChunkKeys: Iterable<string>;
}): {
  readonly rebuildChunkKeys: string[];
  readonly removeChunkKeys: string[];
} {
  const currentVisible = new Set(input.currentVisibleChunkKeys);
  const nextVisible = new Set(input.nextVisibleChunkKeys);
  const dirty = new Set(input.dirtyChunkKeys);
  const rebuildChunkKeys = new Set<string>();
  const removeChunkKeys = new Set<string>();

  for (const key of currentVisible) {
    if (!nextVisible.has(key)) {
      removeChunkKeys.add(key);
    }
  }

  for (const key of nextVisible) {
    if (!currentVisible.has(key) || dirty.has(key)) {
      rebuildChunkKeys.add(key);
    }
  }

  return {
    rebuildChunkKeys: sortChunkKeys(rebuildChunkKeys),
    removeChunkKeys: sortChunkKeys(removeChunkKeys),
  };
}

export function getChunkKeysNeedingRefreshForBlock(x: number, z: number, chunkSize: number): string[] {
  const chunkX = floorDiv(x, chunkSize);
  const chunkZ = floorDiv(z, chunkSize);
  const localX = ((x % chunkSize) + chunkSize) % chunkSize;
  const localZ = ((z % chunkSize) + chunkSize) % chunkSize;
  const keys = new Set<string>([chunkKeyFromCoordinates(chunkX, chunkZ)]);
  const neighborChunkXs = [chunkX];
  const neighborChunkZs = [chunkZ];

  if (localX === 0) {
    neighborChunkXs.push(chunkX - 1);
  }

  if (localX === chunkSize - 1) {
    neighborChunkXs.push(chunkX + 1);
  }

  if (localZ === 0) {
    neighborChunkZs.push(chunkZ - 1);
  }

  if (localZ === chunkSize - 1) {
    neighborChunkZs.push(chunkZ + 1);
  }

  for (const candidateChunkX of neighborChunkXs) {
    for (const candidateChunkZ of neighborChunkZs) {
      keys.add(chunkKeyFromCoordinates(candidateChunkX, candidateChunkZ));
    }
  }

  return sortChunkKeys(keys);
}

export function buildChunkTraversalRoute(input: {
  readonly centerChunkX: number;
  readonly centerChunkZ: number;
  readonly chunkRadius: number;
  readonly chunkSize: number;
  readonly samplesPerChunk?: number;
}): ChunkTraversalWaypoint[] {
  const chunkRadius = Math.max(0, Math.floor(input.chunkRadius));
  const samplesPerChunk = Math.max(1, Math.floor(input.samplesPerChunk ?? 3));
  const widthChunks = chunkRadius * 2 + 1;
  const rowSamples = widthChunks * samplesPerChunk;
  const minChunkX = input.centerChunkX - chunkRadius;
  const minChunkZ = input.centerChunkZ - chunkRadius;
  const route: ChunkTraversalWaypoint[] = [];

  for (let rowIndex = 0; rowIndex < widthChunks; rowIndex += 1) {
    const z = (minChunkZ + rowIndex + 0.5) * input.chunkSize;
    const leftToRight = rowIndex % 2 === 0;

    for (let sampleIndex = 0; sampleIndex < rowSamples; sampleIndex += 1) {
      const normalizedX = (sampleIndex + 0.5) / rowSamples;
      const chunkOffset = normalizedX * widthChunks;
      const x = leftToRight
        ? (minChunkX + chunkOffset) * input.chunkSize
        : (minChunkX + widthChunks - chunkOffset) * input.chunkSize;

      route.push({
        x,
        z,
      });
    }
  }

  return route;
}
