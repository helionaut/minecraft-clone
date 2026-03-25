import type { Bounds3D, WorldConfig } from '../gameplay/world.ts';

interface Vector3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const RENDER_BELOW_PLAYER = 12;
const RENDER_ABOVE_PLAYER = 20;

export function getVisibleBoundsForPlayer(
  playerPosition: Vector3Like,
  config: WorldConfig,
  renderChunkRadius: number,
): Bounds3D {
  const chunkSize = config.chunkSize;
  const centerChunkX = Math.floor(playerPosition.x / chunkSize);
  const centerChunkZ = Math.floor(playerPosition.z / chunkSize);
  const minChunkX = centerChunkX - renderChunkRadius;
  const maxChunkX = centerChunkX + renderChunkRadius;
  const minChunkZ = centerChunkZ - renderChunkRadius;
  const maxChunkZ = centerChunkZ + renderChunkRadius;

  return {
    minX: minChunkX * chunkSize,
    maxX: (maxChunkX + 1) * chunkSize - 1,
    minY: Math.max(config.minY, Math.floor(playerPosition.y) - RENDER_BELOW_PLAYER),
    maxY: Math.min(config.maxY + 1, Math.ceil(playerPosition.y) + RENDER_ABOVE_PLAYER),
    minZ: minChunkZ * chunkSize,
    maxZ: (maxChunkZ + 1) * chunkSize - 1,
  };
}
