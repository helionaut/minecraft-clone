import { type StationItemType } from './progression.ts';
import { type VoxelWorld } from './world.ts';

export function getNearbyStations(world: VoxelWorld, x: number, y: number, z: number): StationItemType[] {
  const nearby = new Set<StationItemType>();

  for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
    for (let offsetY = -1; offsetY <= 2; offsetY += 1) {
      for (let offsetZ = -2; offsetZ <= 2; offsetZ += 1) {
        const block = world.getBlock(x + offsetX, y + offsetY, z + offsetZ);

        if (block === 'crafting-table' || block === 'furnace') {
          nearby.add(block);
        }
      }
    }
  }

  return [...nearby].sort();
}
