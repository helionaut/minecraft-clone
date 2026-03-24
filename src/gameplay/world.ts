import {
  BLOCK_DEFINITIONS,
  type PlaceableBlockType,
  type WorldBlockType,
} from './blocks.ts';

export type SolidBlockType = WorldBlockType;
export type BiomeType = 'plains' | 'forest' | 'desert' | 'snowfield' | 'mountains' | 'swamp';

export interface Block {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly type: SolidBlockType;
}

export interface WorldConfig {
  readonly radius: number;
  readonly minY: number;
  readonly maxY: number;
  readonly seaLevel: number;
  readonly lavaLevel: number;
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

export interface SpawnPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface ColumnData {
  readonly height: number;
  readonly biome: BiomeType;
  readonly surface: PlaceableBlockType;
  readonly filler: PlaceableBlockType;
  readonly fillerDepth: number;
  readonly flooded: boolean;
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  radius: 18,
  minY: -10,
  maxY: 20,
  seaLevel: 4,
  lavaLevel: -6,
  seed: 1337,
};

type BlockMap = Map<string, SolidBlockType>;
type ColumnMap = Map<string, ColumnData>;

function normalizeCoordinate(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function createBlockKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function createColumnKey(x: number, z: number): string {
  return `${x},${z}`;
}

function splitBlockKey(key: string): [number, number, number] {
  const [x, y, z] = key.split(',').map(Number);
  return [x, y, z];
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function hash(seed: number, x: number, y = 0, z = 0): number {
  const sample =
    Math.sin(
      x * 127.1 +
        y * 311.7 +
        z * 74.7 +
        seed * 53.3158,
    ) * 43758.5453123;
  return fract(sample);
}

function valueNoise2d(seed: number, x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const tx = smoothstep(x - x0);
  const tz = smoothstep(z - z0);

  const a = hash(seed, x0, 0, z0);
  const b = hash(seed, x1, 0, z0);
  const c = hash(seed, x0, 0, z1);
  const d = hash(seed, x1, 0, z1);

  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

function valueNoise3d(seed: number, x: number, y: number, z: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const z1 = z0 + 1;
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const tz = smoothstep(z - z0);

  const c000 = hash(seed, x0, y0, z0);
  const c100 = hash(seed, x1, y0, z0);
  const c010 = hash(seed, x0, y1, z0);
  const c110 = hash(seed, x1, y1, z0);
  const c001 = hash(seed, x0, y0, z1);
  const c101 = hash(seed, x1, y0, z1);
  const c011 = hash(seed, x0, y1, z1);
  const c111 = hash(seed, x1, y1, z1);

  const x00 = lerp(c000, c100, tx);
  const x10 = lerp(c010, c110, tx);
  const x01 = lerp(c001, c101, tx);
  const x11 = lerp(c011, c111, tx);

  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}

function fbm2d(
  seed: number,
  x: number,
  z: number,
  octaves: number,
  lacunarity: number,
  gain: number,
): number {
  let frequency = 1;
  let amplitude = 1;
  let total = 0;
  let weight = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise2d(seed + octave * 13, x * frequency, z * frequency) * amplitude;
    weight += amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
  }

  return total / weight;
}

function fbm3d(
  seed: number,
  x: number,
  y: number,
  z: number,
  octaves: number,
  lacunarity: number,
  gain: number,
): number {
  let frequency = 1;
  let amplitude = 1;
  let total = 0;
  let weight = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise3d(seed + octave * 17, x * frequency, y * frequency, z * frequency) * amplitude;
    weight += amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
  }

  return total / weight;
}

function getBiome(
  height: number,
  seaLevel: number,
  temperature: number,
  humidity: number,
  erosion: number,
): BiomeType {
  if (height >= seaLevel + 8 || erosion < 0.35) {
    return temperature < 0.48 ? 'snowfield' : 'mountains';
  }

  if (height <= seaLevel + 1 && humidity > 0.7) {
    return 'swamp';
  }

  if (temperature > 0.68 && humidity < 0.45) {
    return 'desert';
  }

  if (temperature < 0.33) {
    return 'snowfield';
  }

  if (humidity > 0.56) {
    return 'forest';
  }

  return 'plains';
}

function getBiomeMaterials(biome: BiomeType): {
  readonly surface: PlaceableBlockType;
  readonly filler: PlaceableBlockType;
  readonly fillerDepth: number;
} {
  switch (biome) {
    case 'desert':
      return { surface: 'sand', filler: 'sandstone', fillerDepth: 4 };
    case 'snowfield':
      return { surface: 'snow', filler: 'dirt', fillerDepth: 3 };
    case 'mountains':
      return { surface: 'stone', filler: 'stone', fillerDepth: 2 };
    case 'swamp':
      return { surface: 'grass', filler: 'dirt', fillerDepth: 4 };
    case 'forest':
      return { surface: 'grass', filler: 'dirt', fillerDepth: 4 };
    case 'plains':
    default:
      return { surface: 'grass', filler: 'dirt', fillerDepth: 3 };
  }
}

function getColumnData(config: WorldConfig, x: number, z: number): ColumnData {
  const continentalness = fbm2d(config.seed + 11, x * 0.04, z * 0.04, 4, 2, 0.52);
  const erosion = fbm2d(config.seed + 23, x * 0.075, z * 0.075, 3, 2.4, 0.5);
  const temperature = fbm2d(config.seed + 37, x * 0.03, z * 0.03, 3, 2, 0.55);
  const humidity = fbm2d(config.seed + 53, x * 0.03, z * 0.03, 3, 2, 0.55);
  const ridges = Math.abs(fbm2d(config.seed + 71, x * 0.055, z * 0.055, 4, 2.1, 0.5) - 0.5) * 2;
  const basin = fbm2d(config.seed + 97, x * 0.09, z * 0.09, 2, 2.8, 0.45);
  const islandFalloff =
    Math.max(0, Math.hypot(x, z) - config.radius * 0.42) / (config.radius * 0.95);

  let height =
    config.seaLevel -
    3 +
    continentalness * 12 +
    ridges * 10 -
    erosion * 3 -
    basin * 2 -
    islandFalloff * 8;

  height = Math.round(Math.max(config.minY + 5, Math.min(config.maxY - 1, height)));

  const biome = getBiome(height, config.seaLevel, temperature, humidity, erosion);
  const materials = getBiomeMaterials(biome);
  const flooded =
    height < config.seaLevel ||
    (biome === 'swamp' &&
      height <= config.seaLevel + 1 &&
      fbm2d(config.seed + 109, x * 0.13, z * 0.13, 2, 2.5, 0.5) > 0.56);

  return {
    height,
    biome,
    surface: flooded && biome === 'desert' ? 'sand' : materials.surface,
    filler: flooded && biome === 'desert' ? 'sandstone' : materials.filler,
    fillerDepth: materials.fillerDepth,
    flooded,
  };
}

function buildColumnMap(config: WorldConfig): ColumnMap {
  const columns: ColumnMap = new Map();

  for (let x = -config.radius; x <= config.radius; x += 1) {
    for (let z = -config.radius; z <= config.radius; z += 1) {
      columns.set(createColumnKey(x, z), getColumnData(config, x, z));
    }
  }

  return columns;
}

function getDecorationScore(seed: number, x: number, z: number): number {
  return fbm2d(seed + 211, x * 0.33, z * 0.33, 2, 2.1, 0.55);
}

function isDecorationPeak(seed: number, x: number, z: number): boolean {
  const score = getDecorationScore(seed, x, z);

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dz = -1; dz <= 1; dz += 1) {
      if (dx === 0 && dz === 0) {
        continue;
      }

      if (getDecorationScore(seed, x + dx, z + dz) > score) {
        return false;
      }
    }
  }

  return true;
}

function placeDecorationBlock(
  blocks: BlockMap,
  config: WorldConfig,
  x: number,
  y: number,
  z: number,
  type: SolidBlockType,
): void {
  if (
    y < config.minY ||
    y > config.maxY + 1 ||
    Math.abs(x) > config.radius ||
    Math.abs(z) > config.radius ||
    blocks.has(createBlockKey(x, y, z))
  ) {
    return;
  }

  blocks.set(createBlockKey(x, y, z), type);
}

function placeTree(
  blocks: BlockMap,
  config: WorldConfig,
  x: number,
  groundY: number,
  z: number,
): void {
  const trunkHeight = 4 + Math.floor(hash(config.seed + 307, x, groundY, z) * 2);

  for (let offset = 1; offset <= trunkHeight; offset += 1) {
    placeDecorationBlock(blocks, config, x, groundY + offset, z, 'oak-log');
  }

  const canopyStart = groundY + trunkHeight - 1;

  for (let dy = 0; dy <= 2; dy += 1) {
    const radius = dy === 1 ? 2 : 1;

    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (Math.abs(dx) + Math.abs(dz) > radius + 1) {
          continue;
        }

        if (dx === 0 && dz === 0 && dy < 2) {
          continue;
        }

        placeDecorationBlock(
          blocks,
          config,
          x + dx,
          canopyStart + dy,
          z + dz,
          'oak-leaves',
        );
      }
    }
  }

  placeDecorationBlock(blocks, config, x, canopyStart + 3, z, 'oak-leaves');
}

function placeCactus(
  blocks: BlockMap,
  config: WorldConfig,
  x: number,
  groundY: number,
  z: number,
): void {
  let baseY = groundY;

  while (blocks.get(createBlockKey(x, baseY, z)) === 'water' && baseY > config.minY) {
    baseY -= 1;
  }

  if (
    blocks.get(createBlockKey(x, baseY, z)) !== 'sand' ||
    blocks.has(createBlockKey(x, baseY + 1, z))
  ) {
    return;
  }

  const height = 2 + Math.floor(hash(config.seed + 331, x, groundY, z) * 3);

  for (let offset = 1; offset <= height; offset += 1) {
    placeDecorationBlock(blocks, config, x, baseY + offset, z, 'cactus');
  }
}

function decorateSurface(
  blocks: BlockMap,
  columns: ColumnMap,
  config: WorldConfig,
): void {
  for (let x = -config.radius; x <= config.radius; x += 1) {
    for (let z = -config.radius; z <= config.radius; z += 1) {
      const column = columns.get(createColumnKey(x, z));

      if (!column) {
        continue;
      }

      const topSurface = blocks.get(createBlockKey(x, column.height, z));

      if (
        topSurface === 'sand' &&
        hash(config.seed + 353, x, column.height, z) > 0.55 &&
        (Math.abs(x) > 2 || Math.abs(z) > 2)
      ) {
        placeCactus(blocks, config, x, column.height, z);
        continue;
      }

      if (
        column.flooded ||
        column.height < config.seaLevel ||
        (Math.abs(x) <= 2 && Math.abs(z) <= 2)
      ) {
        continue;
      }

      if (
        Math.abs(x) >= config.radius - 2 ||
        Math.abs(z) >= config.radius - 2
      ) {
        continue;
      }

      if (!isDecorationPeak(config.seed, x, z)) {
        continue;
      }

      if (
        (column.biome === 'forest' && getDecorationScore(config.seed, x, z) > 0.71) ||
        (column.biome === 'plains' && getDecorationScore(config.seed, x, z) > 0.81)
      ) {
        placeTree(blocks, config, x, column.height, z);
        continue;
      }
    }
  }
}

function createBaseBlockMap(config: WorldConfig): BlockMap {
  const blocks: BlockMap = new Map();
  const columns = buildColumnMap(config);

  for (let x = -config.radius; x <= config.radius; x += 1) {
    for (let z = -config.radius; z <= config.radius; z += 1) {
      const column = columns.get(createColumnKey(x, z));

      if (!column) {
        continue;
      }

      for (let y = config.minY; y <= column.height; y += 1) {
        let type: SolidBlockType = 'stone';

        if (y === column.height) {
          type = column.flooded && column.height <= config.seaLevel ? 'sand' : column.surface;
        } else if (y >= column.height - column.fillerDepth) {
          type = column.filler;
        }

        blocks.set(createBlockKey(x, y, z), type);
      }

      if (column.flooded) {
        const waterTop = Math.max(column.height + 1, config.minY);

        for (let y = waterTop; y <= config.seaLevel; y += 1) {
          blocks.set(createBlockKey(x, y, z), 'water');
        }
      }
    }
  }

  for (let x = -config.radius; x <= config.radius; x += 1) {
    for (let z = -config.radius; z <= config.radius; z += 1) {
      const column = columns.get(createColumnKey(x, z));

      if (!column) {
        continue;
      }

      for (let y = config.minY + 1; y < column.height - 1; y += 1) {
        const current = blocks.get(createBlockKey(x, y, z));

        if (!current || current === 'water') {
          continue;
        }

        const density =
          fbm3d(config.seed + 131, x * 0.08, y * 0.1, z * 0.08, 3, 2.15, 0.52) +
          fbm3d(config.seed + 149, x * 0.16, y * 0.18, z * 0.16, 2, 2.4, 0.45) * 0.55;
        const carveBias = y > column.height - 4 ? 0.12 : 0;
        const carve = density > 0.92 - carveBias;

        if (!carve) {
          continue;
        }

        blocks.delete(createBlockKey(x, y, z));

        if (
          y <= config.lavaLevel &&
          fbm3d(config.seed + 173, x * 0.22, y * 0.18, z * 0.22, 2, 2.5, 0.5) > 0.56
        ) {
          blocks.set(createBlockKey(x, y, z), 'lava');
        }
      }
    }
  }

  decorateSurface(blocks, columns, config);
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

  isSolidBlock(x: number, y: number, z: number): boolean {
    const type = this.getBlock(x, y, z);
    return type ? BLOCK_DEFINITIONS[type].solid : false;
  }

  isOpaqueBlock(x: number, y: number, z: number): boolean {
    const type = this.getBlock(x, y, z);
    return type ? BLOCK_DEFINITIONS[type].opaque : false;
  }

  setBlock(x: number, y: number, z: number, type: SolidBlockType | null): void {
    const key = createBlockKey(x, y, z);

    if (type === null) {
      this.#blocks.delete(key);
      return;
    }

    this.#blocks.set(key, type);
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
    if (
      y < this.config.minY ||
      y > this.config.maxY + 1 ||
      Math.abs(x) > this.config.radius + 1 ||
      Math.abs(z) > this.config.radius + 1 ||
      this.hasBlock(x, y, z)
    ) {
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

  getSpawnPoint(): SpawnPoint {
    const candidates: Array<readonly [number, number]> = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [2, 0],
      [0, 2],
    ];

    for (const [x, z] of candidates) {
      for (let y = this.config.maxY; y >= this.config.minY; y -= 1) {
        const block = this.getBlock(x, y, z);

        if (!block || block === 'water' || block === 'lava') {
          continue;
        }

        if (this.hasBlock(x, y + 1, z) || this.hasBlock(x, y + 2, z)) {
          continue;
        }

        return {
          x: x + 0.5,
          y: y + 1.02,
          z: z + 0.5,
        };
      }
    }

    return { x: 0.5, y: this.config.seaLevel + 4, z: 0.5 };
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
