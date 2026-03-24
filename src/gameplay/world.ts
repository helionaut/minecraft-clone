import type { BlockType } from './blocks.ts';

export interface Block {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly type: BlockType;
}

export interface WorldConfig {
  readonly radius: number;
  readonly plateauHeight: number;
}

function normalizeCoordinate(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

export function generateFlatWorld(config: WorldConfig): Block[] {
  const blocks: Block[] = [];

  for (let x = -config.radius; x <= config.radius; x += 1) {
    for (let z = -config.radius; z <= config.radius; z += 1) {
      for (let y = 0; y < config.plateauHeight; y += 1) {
        const type: BlockType =
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
