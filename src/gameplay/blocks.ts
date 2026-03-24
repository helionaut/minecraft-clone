export type BlockType = 'grass' | 'dirt' | 'stone' | 'highlight';

export interface BlockDefinition {
  readonly type: BlockType;
  readonly color: number;
}

export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  grass: { type: 'grass', color: 0x5f9d3a },
  dirt: { type: 'dirt', color: 0x6f4a2f },
  stone: { type: 'stone', color: 0x8a8f98 },
  highlight: { type: 'highlight', color: 0xe6b84a },
};
