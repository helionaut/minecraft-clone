export type BlockType =
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'sand'
  | 'sandstone'
  | 'snow'
  | 'oak-log'
  | 'oak-leaves'
  | 'cactus'
  | 'water'
  | 'lava'
  | 'highlight';

export type PlaceableBlockType = Exclude<BlockType, 'highlight' | 'water' | 'lava'>;
export type WorldBlockType = Exclude<BlockType, 'highlight'>;

export const PLACEABLE_BLOCK_ORDER = [
  'grass',
  'dirt',
  'sand',
  'stone',
  'oak-log',
  'oak-leaves',
  'cactus',
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
    texture: {
      top: 'grass-top',
      bottom: 'dirt',
      side: 'grass-side',
    },
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
    texture: {
      top: 'sandstone-top',
      bottom: 'sandstone-bottom',
      side: 'sandstone-side',
    },
  },
  snow: {
    type: 'snow',
    color: 0xf0f4fa,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: {
      top: 'snow-top',
      bottom: 'dirt',
      side: 'snow-side',
    },
  },
  'oak-log': {
    type: 'oak-log',
    color: 0x8a633d,
    solid: true,
    fluid: false,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: {
      top: 'oak-log-top',
      bottom: 'oak-log-top',
      side: 'oak-log-side',
    },
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
    texture: {
      top: 'cactus-top',
      bottom: 'cactus-bottom',
      side: 'cactus-side',
    },
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
