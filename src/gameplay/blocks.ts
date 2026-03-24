export type BlockType =
  | 'grass'
  | 'dirt'
  | 'stone'
  | 'sand'
  | 'sandstone'
  | 'snow'
  | 'water'
  | 'lava'
  | 'highlight';

export type PlaceableBlockType = Exclude<BlockType, 'highlight' | 'water' | 'lava'>;
export type WorldBlockType = Exclude<BlockType, 'highlight'>;

export interface BlockDefinition {
  readonly type: BlockType;
  readonly color: number;
  readonly solid: boolean;
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
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'dirt' },
  },
  stone: {
    type: 'stone',
    color: 0x8f98a3,
    solid: true,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'stone' },
  },
  sand: {
    type: 'sand',
    color: 0xd9c27f,
    solid: true,
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: { all: 'sand' },
  },
  sandstone: {
    type: 'sandstone',
    color: 0xc9aa68,
    solid: true,
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
    opaque: true,
    lightAttenuation: 15,
    emittedLight: 0,
    texture: {
      top: 'snow-top',
      bottom: 'dirt',
      side: 'snow-side',
    },
  },
  water: {
    type: 'water',
    color: 0x4f8fdb,
    solid: true,
    opaque: false,
    lightAttenuation: 1,
    emittedLight: 0,
    texture: { all: 'water' },
  },
  lava: {
    type: 'lava',
    color: 0xff7433,
    solid: true,
    opaque: false,
    lightAttenuation: 1,
    emittedLight: 15,
    texture: { all: 'lava' },
  },
  highlight: {
    type: 'highlight',
    color: 0xe6b84a,
    solid: false,
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
