import { describe, expect, it } from 'vitest';

import {
  buildChunkTraversalRoute,
  getChunkKeysNeedingRefreshForBlock,
  getVisibleChunkKeys,
  planChunkMeshUpdates,
} from '../../src/rendering/chunkTraversal.ts';

describe('getVisibleChunkKeys', () => {
  it('maps world bounds to visible chunk keys', () => {
    expect(getVisibleChunkKeys({
      minX: -16,
      maxX: 31,
      minY: -10,
      maxY: 10,
      minZ: -1,
      maxZ: 16,
    }, 16)).toEqual([
      '-1,-1',
      '-1,0',
      '-1,1',
      '0,-1',
      '0,0',
      '0,1',
      '1,-1',
      '1,0',
      '1,1',
    ]);
  });
});

describe('planChunkMeshUpdates', () => {
  it('rebuilds new and dirty visible chunks while removing old invisible ones', () => {
    expect(planChunkMeshUpdates({
      currentVisibleChunkKeys: ['0,0', '0,1', '1,0'],
      nextVisibleChunkKeys: ['0,1', '1,0', '1,1'],
      dirtyChunkKeys: ['0,1', '2,2'],
    })).toEqual({
      rebuildChunkKeys: ['0,1', '1,1'],
      removeChunkKeys: ['0,0'],
    });
  });
});

describe('getChunkKeysNeedingRefreshForBlock', () => {
  it('marks only the owning chunk for interior block updates', () => {
    expect(getChunkKeysNeedingRefreshForBlock(3, 7, 16)).toEqual(['0,0']);
  });

  it('marks neighboring chunks when a block changes on a chunk edge', () => {
    expect(getChunkKeysNeedingRefreshForBlock(15, 0, 16)).toEqual([
      '0,-1',
      '0,0',
      '1,-1',
      '1,0',
    ]);
  });

  it('handles negative chunk coordinates without dropping neighbors', () => {
    expect(getChunkKeysNeedingRefreshForBlock(-16, -1, 16)).toEqual([
      '-2,-1',
      '-2,0',
      '-1,-1',
      '-1,0',
    ]);
  });
});

describe('buildChunkTraversalRoute', () => {
  it('builds a serpentine sweep across the requested chunk grid', () => {
    expect(buildChunkTraversalRoute({
      centerChunkX: 0,
      centerChunkZ: 0,
      chunkRadius: 1,
      chunkSize: 16,
      samplesPerChunk: 2,
    }).slice(0, 8)).toEqual([
      { x: -12, z: -8 },
      { x: -4, z: -8 },
      { x: 4, z: -8 },
      { x: 12, z: -8 },
      { x: 20, z: -8 },
      { x: 28, z: -8 },
      { x: 28, z: 8 },
      { x: 20, z: 8 },
    ]);
  });
});
