import { describe, expect, it } from 'vitest';

import { createPlayerState, stepPlayer } from '../../src/gameplay/player.ts';

function createLookup(
  blocks: ReadonlyArray<readonly [number, number, number]>,
): (x: number, y: number, z: number) => boolean {
  const set = new Set(blocks.map(([x, y, z]) => `${x},${y},${z}`));

  return (x, y, z) => set.has(`${x},${y},${z}`);
}

function createFloor(radius: number): Array<readonly [number, number, number]> {
  const blocks: Array<readonly [number, number, number]> = [];

  for (let x = -radius; x <= radius; x += 1) {
    for (let z = -radius; z <= radius; z += 1) {
      blocks.push([x, 0, z]);
    }
  }

  return blocks;
}

describe('stepPlayer', () => {
  it('moves W forward and S backward relative to the camera', () => {
    const isSolidBlock = createLookup(createFloor(8));
    const state = {
      ...createPlayerState({ x: 0.5, y: 1, z: 0.5 }),
      grounded: true,
      yaw: 0,
    };

    const movedForward = stepPlayer(
      state,
      {
        forward: true,
        backward: false,
        left: false,
        right: false,
        jump: false,
      },
      1 / 60,
      isSolidBlock,
    );
    const movedBackward = stepPlayer(
      state,
      {
        forward: false,
        backward: true,
        left: false,
        right: false,
        jump: false,
      },
      1 / 60,
      isSolidBlock,
    );

    expect(movedForward.position.z).toBeLessThan(state.position.z);
    expect(movedBackward.position.z).toBeGreaterThan(state.position.z);
  });

  it('lands on the floor under gravity', () => {
    const isSolidBlock = createLookup([[0, 0, 0]]);
    let state = createPlayerState({ x: 0.5, y: 2.4, z: 0.5 });

    for (let frame = 0; frame < 60; frame += 1) {
      state = stepPlayer(
        state,
        {
          forward: false,
          backward: false,
          left: false,
          right: false,
          jump: false,
        },
        1 / 60,
        isSolidBlock,
      );
    }

    expect(state.grounded).toBe(true);
    expect(state.position.y).toBeGreaterThanOrEqual(1);
    expect(state.position.y).toBeLessThan(1.05);
  });

  it('prevents walking through solid blocks', () => {
    const isSolidBlock = createLookup([
      ...createFloor(3),
      [0, 1, 2],
      [1, 1, 2],
      [0, 0, 2],
      [1, 0, 2],
    ]);
    let state = {
      ...createPlayerState({ x: 1.5, y: 1, z: 1.5 }),
      grounded: true,
      yaw: Math.PI,
    };

    for (let frame = 0; frame < 20; frame += 1) {
      state = stepPlayer(
        state,
        {
          forward: true,
          backward: false,
          left: false,
          right: false,
          jump: false,
        },
        1 / 60,
        isSolidBlock,
      );
    }

    expect(state.position.z).toBeLessThan(1.67);
    expect(state.velocity.z).toBe(0);
  });

  it('applies grounded jumps', () => {
    const isSolidBlock = createLookup([[0, 0, 0]]);
    const jumped = stepPlayer(
      {
        ...createPlayerState({ x: 0.5, y: 1, z: 0.5 }),
        grounded: true,
      },
      {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: true,
      },
      1 / 60,
      isSolidBlock,
    );

    expect(jumped.position.y).toBeGreaterThan(1);
    expect(jumped.velocity.y).toBeGreaterThan(0);
    expect(jumped.grounded).toBe(false);
  });

  it('treats water as a fluid instead of solid ground and lets the player sink', () => {
    const isSolidBlock = createLookup(createFloor(4));
    const isFluidBlock = createLookup([[0, 1, 0]]);
    const next = stepPlayer(
      createPlayerState({ x: 0.5, y: 1.2, z: 0.5 }),
      {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
      },
      1 / 10,
      isSolidBlock,
      undefined,
      isFluidBlock,
    );

    expect(next.inFluid).toBe(true);
    expect(next.grounded).toBe(false);
    expect(next.position.y).toBeLessThan(1.2);
  });

  it('uses jump to swim upward while submerged in water', () => {
    const isSolidBlock = createLookup(createFloor(4));
    const isFluidBlock = createLookup([
      [0, 1, 0],
      [0, 2, 0],
    ]);
    const next = stepPlayer(
      createPlayerState({ x: 0.5, y: 1.1, z: 0.5 }),
      {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: true,
      },
      1 / 10,
      isSolidBlock,
      undefined,
      isFluidBlock,
    );

    expect(next.inFluid).toBe(true);
    expect(next.velocity.y).toBeGreaterThan(0);
    expect(next.position.y).toBeGreaterThan(1.1);
  });
});
