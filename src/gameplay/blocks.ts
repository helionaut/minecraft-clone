export type BlockType =
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'cobblestone'
  | 'sand'
  | 'sandstone'
  | 'gravel'
  | 'snow'
  | 'oak-log'
  | 'oak-planks'
  | 'oak-leaves'
  | 'cactus'
  | 'bedrock'
  | 'deepslate'
  | 'coal-ore'
  | 'iron-ore'
  | 'gold-ore'
  | 'diamond-ore'
  | 'crafting-table'
  | 'furnace'
  | 'water'
  | 'lava'
  | 'highlight';

export type WorldBlockType = Exclude<BlockType, 'highlight'>;
export type NonFluidWorldBlockType = Exclude<WorldBlockType, 'water' | 'lava'>;
export const PLACEABLE_BLOCK_TYPES = [
  'grass',
  'dirt',
  'stone',
  'cobblestone',
  'sand',
  'sandstone',
  'gravel',
  'snow',
  'oak-log',
  'oak-planks',
  'oak-leaves',
  'cactus',
  'deepslate',
  'crafting-table',
  'furnace',
] as const;

export type PlaceableBlockType = (typeof PLACEABLE_BLOCK_TYPES)[number];

export const PLACEABLE_BLOCK_ORDER = [
  'grass',
  'dirt',
  'stone',
  'cobblestone',
  'sand',
  'oak-log',
  'oak-planks',
  'crafting-table',
  'furnace',
] as const satisfies readonly PlaceableBlockType[];

export type HotbarBlockType = (typeof PLACEABLE_BLOCK_ORDER)[number];

export interface BlockDefinition {
  readonly type: BlockType;
  readonly color: number;
  readonly solid: boolean;
  readonly fluid: boolean;
  readonly opaque: boolean;
  readonly lightAttenuation: number;
  readonly emittedLight: number;
  readonly texture: {
    readonly top?: string;
    readonly bottom?: string;
    readonly side?: string;
    readonly all?: string;
  };
}

export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  grass: {
    type: 'grass',
    color: 0x6aa84f,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { top: 'grass-top', bottom: 'dirt', side: 'grass-side' },
  },
  dirt: {
    type: 'dirt',
    color: 0x7a5536,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'dirt' },
  },
  stone: {
    type: 'stone',
    color: 0x8f98a3,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'stone' },
  },
  cobblestone: {
    type: 'cobblestone',
    color: 0x7d838b,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'stone' },
  },
  sand: {
    type: 'sand',
    color: 0xd9c27f,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'sand' },
  },
  sandstone: {
    type: 'sandstone',
    color: 0xc9aa68,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { top: 'sandstone-top', bottom: 'sandstone-bottom', side: 'sandstone-side' },
  },
  gravel: {
    type: 'gravel',
    color: 0x8d8b87,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'stone' },
  },
  snow: {
    type: 'snow',
    color: 0xf0f4fa,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { top: 'snow-top', bottom: 'dirt', side: 'snow-side' },
  },
  'oak-log': {
    type: 'oak-log',
    color: 0x8a633d,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { top: 'oak-log-top', bottom: 'oak-log-top', side: 'oak-log-side' },
  },
  'oak-planks': {
    type: 'oak-planks',
    color: 0xba9158,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'sandstone-side' },
  },
  'oak-leaves': {
    type: 'oak-leaves',
    color: 0x5b9240,
    solid: true,
    fluid: false,
    opaque: false,
    lightAttenuation: 3,
    emittedLight: 0,
    texture: { all: 'oak-leaves' },
  },
  cactus: {
    type: 'cactus',
    color: 0x4b8d39,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { top: 'cactus-top', bottom: 'cactus-bottom', side: 'cactus-side' },
  },
  bedrock: {
    type: 'bedrock',
    color: 0x2c2f34,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'stone' },
  },
  deepslate: {
    type: 'deepslate',
    color: 0x4c5058,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'stone' },
  },
  'coal-ore': {
    type: 'coal-ore',
    color: 0x4c4c4c,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'stone' },
  },
  'iron-ore': {
    type: 'iron-ore',
    color: 0xc18b62,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'stone' },
  },
  'gold-ore': {
    type: 'gold-ore',
    color: 0xd5b24d,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'stone' },
  },
  'diamond-ore': {
    type: 'diamond-ore',
    color: 0x58d7e7,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'stone' },
  },
  'crafting-table': {
    type: 'crafting-table',
    color: 0x9e6f45,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { top: 'cactus-top', bottom: 'oak-log-top', side: 'oak-log-side' },
  },
  furnace: {
    type: 'furnace',
    color: 0x676d75,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'stone' },
  },
  water: {
    type: 'water',
    color: 0x4f8fdb,
    solid: false,
    fluid: true,
    opaque: false,
    lightAttenuation: 1,
    emittedLight: 0,
    texture: { all: 'water' },
  },
  lava: {
    type: 'lava',
    color: 0xff7433,
    solid: false,
    fluid: true,
    opaque: false,
    lightAttenuation: 1,
    emittedLight: 15,
    texture: { all: 'lava' },
  },
  highlight: {
    type: 'highlight',
    color: 0xe6b84a,
    solid: false,
    fluid: false,
    opaque: false,
    lightAttenuation: 0,
    emittedLight: 0,
    texture: { all: 'highlight' },
  },
};

export function isOpaqueBlock(type: WorldBlockType | null): boolean {
  return type ? BLOCK_DEFINITIONS[type].opaque : false;
}

export function isSolidBlock(type: WorldBlockType | null): boolean {
  return type ? BLOCK_DEFINITIONS[type].solid : false;
}

export function isFluidBlock(type: WorldBlockType | null): boolean {
  return type ? BLOCK_DEFINITIONS[type].fluid : false;
}
