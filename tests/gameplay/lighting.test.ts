import { describe, expect, it } from 'vitest';

import { computeVoxelLighting } from '../../src/gameplay/lighting.ts';
import type { WorldBlockType } from '../../src/gameplay/blocks.ts';

function createBlockGetter(
  blocks: ReadonlyArray<readonly [number, number, number, WorldBlockType]>,
): (x: number, y: number, z: number) => WorldBlockType | null {
  const map = new Map(blocks.map(([x, y, z, type]) => [`${x},${y},${z}`, type]));

  return (x, y, z) => map.get(`${x},${y},${z}`) ?? null;
}

describe('computeVoxelLighting', () => {
  it('keeps sunlight in open air and blocks it under stone', () => {
    const lighting = computeVoxelLighting(
      {
        minX: -1,
        maxX: 1,
        minY: 0,
        maxY: 3,
        minZ: -1,
        maxZ: 1,
      },
      createBlockGetter([
        [-1, 0, -1, 'stone'],
        [-1, 1, -1, 'stone'],
        [-1, 2, -1, 'stone'],
        [-1, 0, 0, 'stone'],
        [-1, 1, 0, 'stone'],
        [-1, 2, -1, 'stone'],
        [-1, 2, 0, 'stone'],
        [-1, 1, 1, 'stone'],
        [-1, 2, 1, 'stone'],
        [0, 0, -1, 'stone'],
        [0, 1, -1, 'stone'],
        [0, 2, -1, 'stone'],
        [0, 2, 0, 'stone'],
        [0, 2, 1, 'stone'],
        [0, 0, 1, 'stone'],
        [0, 1, 1, 'stone'],
        [1, 0, -1, 'stone'],
        [1, 1, -1, 'stone'],
        [1, 2, -1, 'stone'],
        [1, 0, 0, 'stone'],
        [1, 1, 0, 'stone'],
        [1, 2, 0, 'stone'],
        [1, 0, 1, 'stone'],
        [1, 1, 1, 'stone'],
        [1, 2, 1, 'stone'],
      ]),
    );

    expect(lighting.getCellLight(0, 3, 0).sunlight).toBe(15);
    expect(lighting.getCellLight(0, 1, 0).sunlight).toBe(0);
  });

  it('propagates emissive light from lava through nearby empty cells', () => {
    const lighting = computeVoxelLighting(
      {
        minX: -1,
        maxX: 1,
        minY: -1,
        maxY: 1,
        minZ: -1,
        maxZ: 1,
      },
      createBlockGetter([[0, 0, 0, 'lava']]),
    );

    expect(lighting.getCellLight(0, 0, 0).blocklight).toBe(15);
    expect(lighting.getCellLight(1, 0, 0).blocklight).toBeGreaterThan(10);
    expect(lighting.getBlockBrightness(0, 0, 0)).toBeGreaterThan(0.9);
  });

  it('emits nested timing phases when a profiler is provided', () => {
    const phases: string[] = [];
    const phaseMetrics = new Map<string, Record<string, number>>();

    computeVoxelLighting(
      {
        minX: -1,
        maxX: 1,
        minY: -1,
        maxY: 1,
        minZ: -1,
        maxZ: 1,
      },
      createBlockGetter([[0, 0, 0, 'lava']]),
      {
        measureSync<T>(name: string, run: () => T): T {
          phases.push(name);
          return run();
        },
        recordPhaseMetrics(name, metrics) {
          phaseMetrics.set(name, metrics);
        },
      },
    );

    expect(phases).toEqual([
      'seed-sunlight-columns',
      'seed-emissive-blocks',
      'propagate-light-queue',
    ]);
    expect(phaseMetrics.get('seed-sunlight-columns')).toEqual({
      columnCount: 25,
      cellVisits: 100,
    });
    expect(phaseMetrics.get('seed-emissive-blocks')).toEqual({
      scannedCells: 27,
      emissiveBlocks: 1,
    });
    expect(phaseMetrics.get('propagate-light-queue')).toEqual({
      queueSeeds: 101,
      processedEntries: 200,
      neighborChecks: 1200,
      lightWrites: 99,
    });
  });
});
