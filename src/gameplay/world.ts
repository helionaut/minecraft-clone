import type { BlockType } from './blocks.ts';

export type SolidBlockType = Exclude<BlockType, 'highlight'>;

export interface Block {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly type: SolidBlockType;
}

export interface WorldConfig {
  readonly radius: number;
  readonly baseHeight: number;
  readonly maxHeight: number;
  readonly seed: number;
}

export interface WorldMutation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly type: SolidBlockType | null;
}

export interface WorldPersistence {
  readonly version: 1;
  readonly seed: number;
  readonly radius: number;
  readonly mutations: readonly WorldMutation[];
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  radius: 12,
  baseHeight: 3,
  maxHeight: 6,
  seed: 1337,
};

type BlockMap = Map<string, SolidBlockType>;

function createBlockKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function normalizeCoordinate(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function splitBlockKey(key: string): [number, number, number] {
  const [x, y, z] = key.split(',').map(Number);
  return [x, y, z];
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function sampleNoise(seed: number, x: number, z: number): number {
  const sample = Math.sin(x * 127.1 + z * 311.7 + seed * 17.17) * 43758.5453;
  return fract(sample);
}

function getColumnHeight(config: WorldConfig, x: number, z: number): number {
  const distance = Math.hypot(x, z);

  if (distance <= 2) {
    return config.baseHeight + 1;
  }

  const ridge =
    sampleNoise(config.seed, x, z) * 1.9 +
    sampleNoise(config.seed + 19, Math.floor(x / 2), Math.floor(z / 2)) * 1.1;
  const falloff = Math.max(0, distance - 2) * 0.16;
  const height = Math.round(config.baseHeight + ridge - falloff);

  return Math.max(1, Math.min(config.maxHeight, height));
}

function createBaseBlockMap(config: WorldConfig): BlockMap {
  const blocks: BlockMap = new Map();

  for (let x = -config.radius; x <= config.radius; x += 1) {
    for (let z = -config.radius; z <= config.radius; z += 1) {
      const height = getColumnHeight(config, x, z);

      for (let y = 0; y < height; y += 1) {
        const type: SolidBlockType =
          y === height - 1 ? 'grass' : y >= height - 2 ? 'dirt' : 'stone';
        blocks.set(createBlockKey(x, y, z), type);
      }
    }
  }

  return blocks;
}

function cloneBlockMap(source: BlockMap): BlockMap {
  return new Map(source);
}

function sortedBlocksFromMap(blocks: BlockMap): Block[] {
  return [...blocks.entries()]
    .map(([key, type]) => {
      const [x, y, z] = splitBlockKey(key);
      return { x, y, z, type };
    })
    .sort((left, right) => {
      if (left.x !== right.x) {
        return left.x - right.x;
      }

      if (left.z !== right.z) {
        return left.z - right.z;
      }

      return left.y - right.y;
    });
}

export function generateFlatWorld(config: {
  readonly radius: number;
  readonly plateauHeight: number;
}): Block[] {
  const blocks: Block[] = [];

  for (let x = -config.radius; x <= config.radius; x += 1) {
    for (let z = -config.radius; z <= config.radius; z += 1) {
      for (let y = 0; y < config.plateauHeight; y += 1) {
        const type: SolidBlockType =
          y === config.plateauHeight - 1 ? 'grass' : y > 0 ? 'dirt' : 'stone';
        blocks.push({
          x: normalizeCoordinate(x),
          y,
          z: normalizeCoordinate(z),
          type,
        });
      }
    }
  }

  return blocks;
}

export function generateWorld(config: WorldConfig = DEFAULT_WORLD_CONFIG): Block[] {
  return sortedBlocksFromMap(createBaseBlockMap(config));
}

export class VoxelWorld {
  readonly config: WorldConfig;
  readonly storageKey: string;
  #baseBlocks: BlockMap;
  #blocks: BlockMap;

  constructor(
    config: WorldConfig = DEFAULT_WORLD_CONFIG,
    persistence?: WorldPersistence | null,
  ) {
    this.config = config;
    this.storageKey = `minecraft-clone:world:v1:${config.seed}:${config.radius}`;
    this.#baseBlocks = createBaseBlockMap(config);
    this.#blocks = cloneBlockMap(this.#baseBlocks);

    if (persistence) {
      this.applyPersistence(persistence);
    }
  }

  hasBlock(x: number, y: number, z: number): boolean {
    return this.#blocks.has(createBlockKey(x, y, z));
  }

  getBlock(x: number, y: number, z: number): SolidBlockType | null {
    return this.#blocks.get(createBlockKey(x, y, z)) ?? null;
  }

  setBlock(x: number, y: number, z: number, type: SolidBlockType | null): void {
    if (type === null) {
      this.#blocks.delete(createBlockKey(x, y, z));
      return;
    }

    this.#blocks.set(createBlockKey(x, y, z), type);
  }

  removeBlock(x: number, y: number, z: number): boolean {
    const key = createBlockKey(x, y, z);

    if (!this.#blocks.has(key)) {
      return false;
    }

    this.#blocks.delete(key);
    return true;
  }

  placeBlock(x: number, y: number, z: number, type: SolidBlockType): boolean {
    if (y < 0 || this.hasBlock(x, y, z)) {
      return false;
    }

    this.#blocks.set(createBlockKey(x, y, z), type);
    return true;
  }

  reset(): void {
    this.#blocks = cloneBlockMap(this.#baseBlocks);
  }

  toBlocks(): Block[] {
    return sortedBlocksFromMap(this.#blocks);
  }

  getPersistence(): WorldPersistence {
    const keys = new Set<string>([
      ...this.#baseBlocks.keys(),
      ...this.#blocks.keys(),
    ]);
    const mutations: WorldMutation[] = [];

    for (const key of keys) {
      const baseType = this.#baseBlocks.get(key) ?? null;
      const currentType = this.#blocks.get(key) ?? null;

      if (baseType === currentType) {
        continue;
      }

      const [x, y, z] = splitBlockKey(key);
      mutations.push({ x, y, z, type: currentType });
    }

    mutations.sort((left, right) => {
      if (left.x !== right.x) {
        return left.x - right.x;
      }

      if (left.z !== right.z) {
        return left.z - right.z;
      }

      return left.y - right.y;
    });

    return {
      version: 1,
      seed: this.config.seed,
      radius: this.config.radius,
      mutations,
    };
  }

  applyPersistence(persistence: WorldPersistence): void {
    if (
      persistence.version !== 1 ||
      persistence.seed !== this.config.seed ||
      persistence.radius !== this.config.radius
    ) {
      return;
    }

    for (const mutation of persistence.mutations) {
      this.setBlock(mutation.x, mutation.y, mutation.z, mutation.type);
    }
  }
}

export function parseWorldPersistence(
  value: string | null,
): WorldPersistence | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as WorldPersistence;

    if (
      parsed.version !== 1 ||
      typeof parsed.seed !== 'number' ||
      typeof parsed.radius !== 'number' ||
      !Array.isArray(parsed.mutations)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
