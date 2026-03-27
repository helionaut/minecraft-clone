import { describe, expect, it } from 'vitest';

import {
  getHeldItemAnchorTransform,
  getHeldItemMotion,
  getActivePlaceableBlock,
  isHeldItemType,
  reconcileActiveHotbarItem,
} from '../../src/rendering/heldItem.ts';

describe('reconcileActiveHotbarItem', () => {
  it('keeps the current active tool when it is still owned in the hotbar', () => {
    expect(reconcileActiveHotbarItem(
      'stone-pickaxe',
      ['oak-log', 'stone-pickaxe', null, null, null, null, null, null, null],
      (type) => type !== 'furnace',
      'oak-log',
    )).toBe('stone-pickaxe');
  });

  it('prefers an externally selected tool when it is still owned in the hotbar', () => {
    expect(reconcileActiveHotbarItem(
      'oak-log',
      ['oak-log', 'stone-pickaxe', null, null, null, null, null, null, null],
      () => true,
      'oak-log',
      'stone-pickaxe',
    )).toBe('stone-pickaxe');
  });

  it('falls back to the selected block when the previous active item disappears', () => {
    expect(reconcileActiveHotbarItem(
      'stone-pickaxe',
      ['oak-log', 'crafting-table', null, null, null, null, null, null, null],
      (type) => type !== 'stone-pickaxe',
      'crafting-table',
    )).toBe('crafting-table');
  });
});

describe('held item helpers', () => {
  it('marks only hotbar blocks and tools as visible held items', () => {
    expect(isHeldItemType('stone-pickaxe')).toBe(true);
    expect(isHeldItemType('crafting-table')).toBe(true);
    expect(isHeldItemType('coal')).toBe(false);
  });

  it('returns placeable blocks and excludes tools from placement', () => {
    expect(getActivePlaceableBlock('furnace')).toBe('furnace');
    expect(getActivePlaceableBlock('wooden-sword')).toBeNull();
  });

  it('uses a tighter base anchor on touch layouts than on desktop', () => {
    expect(getHeldItemAnchorTransform(false)).toEqual({
      position: { x: 0.72, y: -0.72, z: -1.08 },
      rotation: { x: -0.18, y: -0.14, z: 0.02 },
      scale: 1,
    });
    expect(getHeldItemAnchorTransform(true)).toEqual({
      position: { x: 0.2, y: -0.1, z: -0.7 },
      rotation: { x: 0.08, y: 0.02, z: 0.02 },
      scale: 1.08,
    });
  });

  it('drops the held item into view while a slot-switch equip animation is active', () => {
    const idle = getHeldItemMotion({
      elapsedSeconds: 0,
      movementStrength: 0,
      equipStrength: 0,
      swingStrength: 0,
      touchDevice: false,
      type: 'crafting-table',
    });
    const equipping = getHeldItemMotion({
      elapsedSeconds: 0,
      movementStrength: 0,
      equipStrength: 1,
      swingStrength: 0,
      touchDevice: false,
      type: 'crafting-table',
    });

    expect(equipping.position.x).toBeLessThan(idle.position.x);
    expect(equipping.position.y).toBeLessThan(idle.position.y);
    expect(equipping.rotation.z).toBeLessThan(idle.rotation.z);
  });

  it('gives tools a stronger swing silhouette than blocks for action readability', () => {
    const swingingBlock = getHeldItemMotion({
      elapsedSeconds: 0.12,
      movementStrength: 0,
      equipStrength: 0,
      swingStrength: 0.5,
      touchDevice: false,
      type: 'crafting-table',
    });
    const swingingTool = getHeldItemMotion({
      elapsedSeconds: 0.12,
      movementStrength: 0,
      equipStrength: 0,
      swingStrength: 0.5,
      touchDevice: false,
      type: 'stone-pickaxe',
    });

    expect(Math.abs(swingingTool.rotation.x)).toBeGreaterThan(Math.abs(swingingBlock.rotation.x));
    expect(Math.abs(swingingTool.position.y)).toBeGreaterThan(Math.abs(swingingBlock.position.y));
  });

  it('damps walk sway on touch layouts to preserve readability in the tighter mobile frame', () => {
    const desktop = getHeldItemMotion({
      elapsedSeconds: 0.5,
      movementStrength: 1,
      equipStrength: 0,
      swingStrength: 0,
      touchDevice: false,
      type: 'oak-log',
    });
    const touch = getHeldItemMotion({
      elapsedSeconds: 0.5,
      movementStrength: 1,
      equipStrength: 0,
      swingStrength: 0,
      touchDevice: true,
      type: 'oak-log',
    });

    expect(Math.abs(touch.position.x)).toBeLessThan(Math.abs(desktop.position.x));
    expect(Math.abs(touch.position.y)).toBeLessThan(Math.abs(desktop.position.y));
    expect(Math.abs(touch.rotation.x)).toBeLessThan(Math.abs(desktop.rotation.x));
  });
});
