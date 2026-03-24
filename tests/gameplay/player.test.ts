import { describe, expect, it } from 'vitest';

import { createPlayerState, stepPlayer } from '../../src/gameplay/player.ts';

function createLookup(
  blocks: ReadonlyArray<readonly [number, number, number]>,
): (x: number, y: number, z: number) => boolean {
  const set = new Set(blocks.map(([x, y, z]) => `${x},${y},${z}`));

  return (x, y, z) => set.has(`${x},${y},${z}`);
}

describe('stepPlayer', () => {
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
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 0, 2],
      [0, 1, 2],
      [1, 0, 2],
      [1, 1, 2],
    ]);
    let state = {
      ...createPlayerState({ x: 1.5, y: 1, z: 1.5 }),
      grounded: true,
      yaw: 0,
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
});
