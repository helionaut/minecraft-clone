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

export interface Bounds3D {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface GeneratedChunk {
  readonly key: string;
  readonly chunkX: number;
  readonly chunkZ: number;
  readonly originX: number;
  readonly originZ: number;
  readonly blocks: readonly Block[];
}

export interface WorldConfig {
  readonly chunkSize: number;
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
  readonly version: 2;
  readonly seed: number;
  readonly chunkSize: number;
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

interface ChunkState {
  readonly key: string;
  readonly chunkX: number;
  readonly chunkZ: number;
  readonly baseBlocks: BlockMap;
  readonly currentBlocks: BlockMap;
}

type BlockMap = Map<string, SolidBlockType>;

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  chunkSize: 16,
  minY: -48,
  maxY: 56,
  seaLevel: 6,
  lavaLevel: -34,
  seed: 1337,
};

function normalizeCoordinate(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function createBlockKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function splitBlockKey(key: string): [number, number, number] {
  const [x, y, z] = key.split(',').map(Number);
  return [x, y, z];
}

function createChunkKey(chunkX: number, chunkZ: number): string {
  return `${chunkX},${chunkZ}`;
}

function splitChunkKey(key: string): [number, number] {
  const [x, z] = key.split(',').map(Number);
  return [x, z];
}

function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

function chunkOrigin(chunkIndex: number, chunkSize: number): number {
  return chunkIndex * chunkSize;
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
  const sample = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 53.3158) * 43758.5453123;
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
  if (height >= seaLevel + 16 || erosion < 0.28) {
    return temperature < 0.45 ? 'snowfield' : 'mountains';
  }

  if (height <= seaLevel + 1 && humidity > 0.66) {
    return 'swamp';
  }

  if (temperature > 0.68 && humidity < 0.42) {
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
  const continentalness = fbm2d(config.seed + 11, x * 0.022, z * 0.022, 4, 2, 0.52);
  const erosion = fbm2d(config.seed + 23, x * 0.045, z * 0.045, 3, 2.4, 0.5);
  const temperature = fbm2d(config.seed + 37, x * 0.019, z * 0.019, 3, 2, 0.55);
  const humidity = fbm2d(config.seed + 53, x * 0.019, z * 0.019, 3, 2, 0.55);
  const ridges = Math.abs(fbm2d(config.seed + 71, x * 0.032, z * 0.032, 4, 2.1, 0.5) - 0.5) * 2;
  const basin = fbm2d(config.seed + 97, x * 0.07, z * 0.07, 2, 2.8, 0.45);

  let height =
    config.seaLevel -
    4 +
    continentalness * 24 +
    ridges * 14 -
    erosion * 6 -
    basin * 4;

  height = Math.round(Math.max(config.minY + 12, Math.min(config.maxY - 2, height)));

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

function blockWithinBounds(y: number, config: WorldConfig): boolean {
  return y >= config.minY && y <= config.maxY + 1;
}

function placeDecorationBlock(
  blocks: BlockMap,
  config: WorldConfig,
  x: number,
  y: number,
  z: number,
  type: SolidBlockType,
): void {
  if (!blockWithinBounds(y, config)) {
    return;
  }

  const key = createBlockKey(x, y, z);

  if (blocks.has(key)) {
    return;
  }

  blocks.set(key, type);
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

        placeDecorationBlock(blocks, config, x + dx, canopyStart + dy, z + dz, 'oak-leaves');
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
  const baseKey = createBlockKey(x, groundY, z);

  if (blocks.get(baseKey) !== 'sand' || blocks.has(createBlockKey(x, groundY + 1, z))) {
    return;
  }

  const height = 2 + Math.floor(hash(config.seed + 331, x, groundY, z) * 3);

  for (let offset = 1; offset <= height; offset += 1) {
    placeDecorationBlock(blocks, config, x, groundY + offset, z, 'cactus');
  }
}

function resolveOreType(config: WorldConfig, x: number, y: number, z: number): SolidBlockType | null {
  const sample = fbm3d(config.seed + 181, x * 0.13, y * 0.13, z * 0.13, 3, 2.1, 0.52);

  if (y <= config.minY + 1) {
    return 'bedrock';
  }

  if (y <= -24 && sample > 0.84) {
    return 'diamond-ore';
  }

  if (y <= -10 && sample > 0.8) {
    return 'gold-ore';
  }

  if (y <= 12 && sample > 0.76) {
    return 'iron-ore';
  }

  if (sample > 0.73) {
    return 'coal-ore';
  }

  return y <= -8 ? 'deepslate' : 'stone';
}

function createBaseChunkMap(config: WorldConfig, chunkX: number, chunkZ: number): BlockMap {
  const blocks: BlockMap = new Map();
  const originX = chunkOrigin(chunkX, config.chunkSize);
  const originZ = chunkOrigin(chunkZ, config.chunkSize);

  for (let localX = 0; localX < config.chunkSize; localX += 1) {
    for (let localZ = 0; localZ < config.chunkSize; localZ += 1) {
      const x = originX + localX;
      const z = originZ + localZ;
      const column = getColumnData(config, x, z);

      for (let y = config.minY; y <= column.height; y += 1) {
        let type: SolidBlockType = resolveOreType(config, x, y, z) ?? 'stone';

        if (y === column.height) {
          type = column.flooded && column.height <= config.seaLevel ? 'sand' : column.surface;
        } else if (y >= column.height - column.fillerDepth) {
          type = column.filler;
        }

        if (y <= config.minY + 1 && hash(config.seed + 701, x, y, z) > 0.32) {
          type = 'bedrock';
        }

        blocks.set(createBlockKey(x, y, z), type);
      }

      if (column.flooded) {
        for (let y = Math.max(column.height + 1, config.minY); y <= config.seaLevel; y += 1) {
          blocks.set(createBlockKey(x, y, z), 'water');
        }
      }

      for (let y = config.minY + 2; y < column.height - 1; y += 1) {
        const current = blocks.get(createBlockKey(x, y, z));

        if (!current || current === 'water' || current === 'bedrock') {
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

      const topSurface = blocks.get(createBlockKey(x, column.height, z));

      if (
        topSurface === 'sand' &&
        hash(config.seed + 353, x, column.height, z) > 0.55 &&
        (Math.abs(x) > 2 || Math.abs(z) > 2)
      ) {
        placeCactus(blocks, config, x, column.height, z);
      }

      if (
        !column.flooded &&
        column.height >= config.seaLevel + 1 &&
        isDecorationPeak(config.seed, x, z)
      ) {
        const decorationScore = getDecorationScore(config.seed, x, z);

        if (
          (column.biome === 'forest' && decorationScore > 0.71) ||
          (column.biome === 'plains' && decorationScore > 0.81)
        ) {
          placeTree(blocks, config, x, column.height, z);
        }
      }
    }
  }

  return blocks;
}

function cloneBlockMap(source: BlockMap): BlockMap {
  return new Map(source);
}

function sortedBlocksFromMap(blocks: BlockMap, bounds?: Bounds3D): Block[] {
  return [...blocks.entries()]
    .map(([key, type]) => {
      const [x, y, z] = splitBlockKey(key);
      return { x, y, z, type };
    })
    .filter((block) => {
      if (!bounds) {
        return true;
      }

      return (
        block.x >= bounds.minX &&
        block.x <= bounds.maxX &&
        block.y >= bounds.minY &&
        block.y <= bounds.maxY &&
        block.z >= bounds.minZ &&
        block.z <= bounds.maxZ
      );
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

function boundsToChunkRange(bounds: Bounds3D, chunkSize: number): {
  readonly minChunkX: number;
  readonly maxChunkX: number;
  readonly minChunkZ: number;
  readonly maxChunkZ: number;
} {
  return {
    minChunkX: floorDiv(bounds.minX, chunkSize),
    maxChunkX: floorDiv(bounds.maxX, chunkSize),
    minChunkZ: floorDiv(bounds.minZ, chunkSize),
    maxChunkZ: floorDiv(bounds.maxZ, chunkSize),
  };
}

export function generateWorld(
  config: WorldConfig = DEFAULT_WORLD_CONFIG,
  bounds: Bounds3D = {
    minX: -config.chunkSize,
    maxX: config.chunkSize * 2 - 1,
    minY: config.minY,
    maxY: config.maxY,
    minZ: -config.chunkSize,
    maxZ: config.chunkSize * 2 - 1,
  },
): Block[] {
  const { minChunkX, maxChunkX, minChunkZ, maxChunkZ } = boundsToChunkRange(bounds, config.chunkSize);
  const blocks: BlockMap = new Map();

  for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
    for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += 1) {
      const chunkBlocks = createBaseChunkMap(config, chunkX, chunkZ);

      for (const [key, type] of chunkBlocks) {
        blocks.set(key, type);
      }
    }
  }

  return sortedBlocksFromMap(blocks, bounds);
}

export class VoxelWorld {
  readonly config: WorldConfig;
  readonly storageKey: string;
  #chunks = new Map<string, ChunkState>();
  #mutations = new Map<string, SolidBlockType | null>();

  constructor(
    config: WorldConfig = DEFAULT_WORLD_CONFIG,
    persistence?: WorldPersistence | null,
  ) {
    this.config = config;
    this.storageKey = `minecraft-clone:world:v2:${config.seed}:${config.chunkSize}`;

    if (persistence) {
      this.applyPersistence(persistence);
    }
  }

  #ensureChunk(chunkX: number, chunkZ: number): ChunkState {
    const key = createChunkKey(chunkX, chunkZ);
    const existing = this.#chunks.get(key);

    if (existing) {
      return existing;
    }

    const baseBlocks = createBaseChunkMap(this.config, chunkX, chunkZ);
    const currentBlocks = cloneBlockMap(baseBlocks);

    for (const [mutationKey, type] of this.#mutations) {
      const [x, , z] = splitBlockKey(mutationKey);

      if (
        floorDiv(x, this.config.chunkSize) !== chunkX ||
        floorDiv(z, this.config.chunkSize) !== chunkZ
      ) {
        continue;
      }

      if (type === null) {
        currentBlocks.delete(mutationKey);
      } else {
        currentBlocks.set(mutationKey, type);
      }
    }

    const chunk: ChunkState = {
      key,
      chunkX,
      chunkZ,
      baseBlocks,
      currentBlocks,
    };
    this.#chunks.set(key, chunk);
    return chunk;
  }

  #getChunkForBlock(x: number, z: number): ChunkState {
    return this.#ensureChunk(floorDiv(x, this.config.chunkSize), floorDiv(z, this.config.chunkSize));
  }

  #getLoadedChunkForBlock(x: number, z: number): ChunkState | null {
    return this.#chunks.get(createChunkKey(floorDiv(x, this.config.chunkSize), floorDiv(z, this.config.chunkSize))) ?? null;
  }

  #peekBlock(x: number, y: number, z: number): SolidBlockType | null {
    if (!blockWithinBounds(y, this.config)) {
      return null;
    }

    const chunk = this.#getLoadedChunkForBlock(x, z);
    return chunk ? (chunk.currentBlocks.get(createBlockKey(x, y, z)) ?? null) : null;
  }

  #syncMutation(x: number, y: number, z: number): void {
    const key = createBlockKey(x, y, z);
    const chunk = this.#getChunkForBlock(x, z);
    const base = chunk.baseBlocks.get(key) ?? null;
    const current = chunk.currentBlocks.get(key) ?? null;

    if (base === current) {
      this.#mutations.delete(key);
      return;
    }

    this.#mutations.set(key, current);
  }

  loadChunksAround(x: number, z: number, radius: number): void {
    const centerChunkX = floorDiv(x, this.config.chunkSize);
    const centerChunkZ = floorDiv(z, this.config.chunkSize);

    for (let chunkX = centerChunkX - radius; chunkX <= centerChunkX + radius; chunkX += 1) {
      for (let chunkZ = centerChunkZ - radius; chunkZ <= centerChunkZ + radius; chunkZ += 1) {
        this.#ensureChunk(chunkX, chunkZ);
      }
    }
  }

  pruneLoadedChunks(x: number, z: number, radius: number): void {
    const centerChunkX = floorDiv(x, this.config.chunkSize);
    const centerChunkZ = floorDiv(z, this.config.chunkSize);

    for (const [key, chunk] of this.#chunks) {
      if (
        Math.abs(chunk.chunkX - centerChunkX) > radius ||
        Math.abs(chunk.chunkZ - centerChunkZ) > radius
      ) {
        this.#chunks.delete(key);
      }
    }
  }

  getLoadedChunkKeys(): string[] {
    return [...this.#chunks.keys()].sort();
  }

  getChunk(chunkX: number, chunkZ: number): GeneratedChunk {
    const chunk = this.#ensureChunk(chunkX, chunkZ);

    return {
      key: chunk.key,
      chunkX,
      chunkZ,
      originX: chunkOrigin(chunkX, this.config.chunkSize),
      originZ: chunkOrigin(chunkZ, this.config.chunkSize),
      blocks: sortedBlocksFromMap(chunk.currentBlocks),
    };
  }

  hasBlock(x: number, y: number, z: number): boolean {
    if (!blockWithinBounds(y, this.config)) {
      return false;
    }

    return this.#getChunkForBlock(x, z).currentBlocks.has(createBlockKey(x, y, z));
  }

  getBlock(x: number, y: number, z: number): SolidBlockType | null {
    if (!blockWithinBounds(y, this.config)) {
      return null;
    }

    return this.#getChunkForBlock(x, z).currentBlocks.get(createBlockKey(x, y, z)) ?? null;
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
    if (!blockWithinBounds(y, this.config)) {
      return;
    }

    const key = createBlockKey(x, y, z);
    const chunk = this.#getChunkForBlock(x, z);

    if (type === null) {
      chunk.currentBlocks.delete(key);
    } else {
      chunk.currentBlocks.set(key, type);
    }

    this.#syncMutation(x, y, z);
  }

  removeBlock(x: number, y: number, z: number): boolean {
    const current = this.getBlock(x, y, z);

    if (!current || current === 'bedrock') {
      return false;
    }

    this.setBlock(x, y, z, null);
    return true;
  }

  placeBlock(x: number, y: number, z: number, type: SolidBlockType): boolean {
    if (!blockWithinBounds(y, this.config) || this.hasBlock(x, y, z)) {
      return false;
    }

    this.setBlock(x, y, z, type);
    return true;
  }

  #canFluidEnter(x: number, y: number, z: number, type: SolidBlockType): boolean {
    if (!blockWithinBounds(y, this.config)) {
      return false;
    }

    const current = this.#peekBlock(x, y, z);

    if (current === null) {
      return this.#getLoadedChunkForBlock(x, z) !== null;
    }

    return current !== type && !BLOCK_DEFINITIONS[current].solid;
  }

  tickFluids(iterations = 1): number {
    let changed = 0;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const nextChanges = new Map<string, SolidBlockType>();

      for (const chunk of this.#chunks.values()) {
        for (const [key, type] of chunk.currentBlocks) {
          if (type !== 'water' && type !== 'lava') {
            continue;
          }

          const [x, y, z] = splitBlockKey(key);

          if (this.#canFluidEnter(x, y - 1, z, type)) {
            nextChanges.set(createBlockKey(x, y - 1, z), type);
            continue;
          }

          for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const nextX = x + dx;
            const nextZ = z + dz;

            if (!this.#canFluidEnter(nextX, y, nextZ, type)) {
              continue;
            }

            const support = this.#peekBlock(nextX, y - 1, nextZ);

            if (!support || !BLOCK_DEFINITIONS[support].solid) {
              continue;
            }

            nextChanges.set(createBlockKey(nextX, y, nextZ), type);
          }
        }
      }

      if (nextChanges.size === 0) {
        break;
      }

      for (const [key, type] of nextChanges) {
        const [x, y, z] = splitBlockKey(key);
        this.setBlock(x, y, z, type);
      }

      changed += nextChanges.size;
    }

    return changed;
  }

  reset(): void {
    this.#mutations.clear();

    for (const chunk of this.#chunks.values()) {
      chunk.currentBlocks.clear();

      for (const [key, type] of chunk.baseBlocks) {
        chunk.currentBlocks.set(key, type);
      }
    }
  }

  getBlocksInBounds(bounds: Bounds3D): Block[] {
    this.loadChunksAround(
      Math.floor((bounds.minX + bounds.maxX) / 2),
      Math.floor((bounds.minZ + bounds.maxZ) / 2),
      Math.max(
        1,
        Math.ceil((Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) + 1) / this.config.chunkSize / 2),
      ),
    );

    const blocks: BlockMap = new Map();
    const { minChunkX, maxChunkX, minChunkZ, maxChunkZ } = boundsToChunkRange(bounds, this.config.chunkSize);

    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
      for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += 1) {
        const chunk = this.#ensureChunk(chunkX, chunkZ);

        for (const [key, type] of chunk.currentBlocks) {
          blocks.set(key, type);
        }
      }
    }

    return sortedBlocksFromMap(blocks, bounds);
  }

  toBlocks(): Block[] {
    const blocks: BlockMap = new Map();

    for (const chunk of this.#chunks.values()) {
      for (const [key, type] of chunk.currentBlocks) {
        blocks.set(key, type);
      }
    }

    return sortedBlocksFromMap(blocks);
  }

  getSpawnPoint(): SpawnPoint {
    const candidates: Array<readonly [number, number]> = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [2, 0],
      [0, 2],
      [2, 2],
      [-2, -2],
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

    return { x: 0.5, y: this.config.seaLevel + 8, z: 0.5 };
  }

  getPersistence(): WorldPersistence {
    const mutations = [...this.#mutations.entries()]
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

    return {
      version: 2,
      seed: this.config.seed,
      chunkSize: this.config.chunkSize,
      mutations,
    };
  }

  applyPersistence(persistence: WorldPersistence): void {
    if (
      persistence.version !== 2 ||
      persistence.seed !== this.config.seed ||
      persistence.chunkSize !== this.config.chunkSize
    ) {
      return;
    }

    this.#mutations.clear();

    for (const mutation of persistence.mutations) {
      const { x, y, z, type } = mutation;

      if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        typeof z !== 'number' ||
        !blockWithinBounds(y, this.config)
      ) {
        continue;
      }

      this.#mutations.set(createBlockKey(x, y, z), type);
    }

    for (const [key, chunk] of this.#chunks) {
      const [chunkX, chunkZ] = splitChunkKey(key);
      const refreshed = this.#ensureChunk(chunkX, chunkZ);
      chunk.currentBlocks.clear();

      for (const [blockKey, type] of refreshed.currentBlocks) {
        chunk.currentBlocks.set(blockKey, type);
      }
    }
  }
}

export function parseWorldPersistence(value: string | null): WorldPersistence | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      version?: number;
      seed?: number;
      chunkSize?: number;
      mutations?: unknown;
    };

    if (
      parsed.version !== 2 ||
      typeof parsed.seed !== 'number' ||
      typeof parsed.chunkSize !== 'number' ||
      !Array.isArray(parsed.mutations)
    ) {
      return null;
    }

    const mutations = parsed.mutations.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') {
        return [];
      }

      const candidate = entry as {
        x?: number;
        y?: number;
        z?: number;
        type?: SolidBlockType | null;
      };

      if (
        typeof candidate.x !== 'number' ||
        typeof candidate.y !== 'number' ||
        typeof candidate.z !== 'number'
      ) {
        return [];
      }

      return [{
        x: candidate.x,
        y: candidate.y,
        z: candidate.z,
        type: candidate.type ?? null,
      }];
    });

    return {
      version: 2,
      seed: parsed.seed,
      chunkSize: parsed.chunkSize,
      mutations,
    };
  } catch {
    return null;
  }
}
