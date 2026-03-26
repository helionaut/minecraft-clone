import {
  BoxGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
} from 'three';

import {
  PLACEABLE_BLOCK_ORDER,
  type HotbarBlockType,
} from '../gameplay/blocks.ts';
import {
  TOOL_ITEM_TYPES,
  type InventoryItemType,
  type ToolItemType,
} from '../gameplay/progression.ts';
import { type FaceVisibilityMask } from './textures.ts';

interface BlockMaterialFactory {
  readonly getMaterials: (
    type: HotbarBlockType,
    brightness: number,
    visibleFaces?: FaceVisibilityMask,
  ) => Material[];
}

export type HeldItemType = HotbarBlockType | ToolItemType;

const PICKAXE_TYPES = new Set<ToolItemType>([
  'wooden-pickaxe',
  'stone-pickaxe',
  'iron-pickaxe',
]);

const HOTBAR_BLOCK_TYPES = new Set<HotbarBlockType>(PLACEABLE_BLOCK_ORDER);
const HELD_TOOL_TYPES = new Set<ToolItemType>(TOOL_ITEM_TYPES);

const VISIBLE_FACES: FaceVisibilityMask = {
  px: true,
  nx: true,
  py: true,
  ny: true,
  pz: true,
  nz: true,
};

export function isHotbarBlockType(type: InventoryItemType | null): type is HotbarBlockType {
  return Boolean(type && HOTBAR_BLOCK_TYPES.has(type as HotbarBlockType));
}

export function isHeldToolType(type: InventoryItemType | null): type is ToolItemType {
  return Boolean(type && HELD_TOOL_TYPES.has(type as ToolItemType));
}

export function isHeldItemType(type: InventoryItemType | null): type is HeldItemType {
  return isHotbarBlockType(type) || isHeldToolType(type);
}

export function getActivePlaceableBlock(type: InventoryItemType | null): HotbarBlockType | null {
  return isHotbarBlockType(type) ? type : null;
}

export function reconcileActiveHotbarItem(
  current: InventoryItemType | null,
  slots: readonly (InventoryItemType | null)[],
  hasCount: (type: InventoryItemType) => boolean,
  fallbackBlock: HotbarBlockType,
): InventoryItemType | null {
  if (current && slots.includes(current) && hasCount(current)) {
    return current;
  }

  if (slots.includes(fallbackBlock) && hasCount(fallbackBlock)) {
    return fallbackBlock;
  }

  return slots.flatMap((type) => (type && hasCount(type) ? [type] : []))[0] ?? null;
}

function createToolMaterials(type: ToolItemType): readonly [MeshStandardMaterial, MeshStandardMaterial] {
  const isIron = type.startsWith('iron');
  const isStone = type.startsWith('stone');
  const headColor = isIron ? 0xd6dde7 : isStone ? 0x88919d : 0x8a5e37;
  const handleColor = isIron ? 0x5d3f2a : isStone ? 0x67452d : 0x70482a;

  return [
    new MeshStandardMaterial({
      color: handleColor,
      roughness: 0.92,
      metalness: 0.08,
    }),
    new MeshStandardMaterial({
      color: headColor,
      roughness: isIron ? 0.35 : 0.8,
      metalness: isIron ? 0.55 : 0.12,
    }),
  ];
}

function createPickaxeModel(type: ToolItemType): Group {
  const group = new Group();
  const [handleMaterial, headMaterial] = createToolMaterials(type);

  const handle = new Mesh(new BoxGeometry(0.08, 0.44, 0.08), handleMaterial);
  handle.position.set(0.02, -0.02, 0);
  handle.rotation.z = -0.18;
  group.add(handle);

  const head = new Mesh(new BoxGeometry(0.3, 0.11, 0.08), headMaterial);
  head.position.set(0.02, 0.14, 0);
  head.rotation.z = 0.18;
  group.add(head);

  const teeth = [
    { x: -0.11, y: 0.06, rotation: 0.36 },
    { x: 0, y: 0.05, rotation: 0.1 },
    { x: 0.11, y: 0.06, rotation: -0.18 },
  ];

  for (const tooth of teeth) {
    const mesh = new Mesh(new BoxGeometry(0.06, 0.13, 0.08), headMaterial);
    mesh.position.set(tooth.x, tooth.y, 0);
    mesh.rotation.z = tooth.rotation;
    group.add(mesh);
  }

  group.rotation.set(0.34, 0.48, -0.48);
  group.position.set(0.14, -0.16, 0.04);
  return group;
}

function createSwordModel(type: ToolItemType): Group {
  const group = new Group();
  const [handleMaterial, bladeMaterial] = createToolMaterials(type);

  const handle = new Mesh(new BoxGeometry(0.09, 0.24, 0.08), handleMaterial);
  handle.position.set(0, -0.18, 0);
  group.add(handle);

  const guard = new Mesh(new BoxGeometry(0.2, 0.05, 0.08), bladeMaterial);
  guard.position.set(0, -0.03, 0);
  group.add(guard);

  const blade = new Mesh(new BoxGeometry(0.08, 0.46, 0.05), bladeMaterial);
  blade.position.set(0, 0.2, 0);
  group.add(blade);

  const tip = new Mesh(new BoxGeometry(0.05, 0.12, 0.05), bladeMaterial);
  tip.position.set(0, 0.49, 0);
  tip.rotation.z = 0.76;
  group.add(tip);

  group.rotation.set(0.18, 0.2, -0.9);
  group.position.set(0.16, -0.2, 0.02);
  return group;
}

export function createHeldItemModel(
  type: HeldItemType,
  blockMaterialFactory: BlockMaterialFactory,
): Group {
  if (isHotbarBlockType(type)) {
    const mesh = new Mesh(
      new BoxGeometry(1, 1, 1),
      blockMaterialFactory.getMaterials(type, 1, VISIBLE_FACES),
    );
    mesh.scale.setScalar(0.34);
    mesh.rotation.set(0.28, 0.7, 0.08);

    const group = new Group();
    group.add(mesh);
    group.position.set(0.1, -0.18, 0);
    group.userData.disposeMaterials = false;
    return group;
  }

  const group = PICKAXE_TYPES.has(type) ? createPickaxeModel(type) : createSwordModel(type);
  group.userData.disposeMaterials = true;
  return group;
}

export function disposeHeldItemModel(group: Group): void {
  const disposeMaterials = group.userData.disposeMaterials === true;

  group.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    child.geometry.dispose();
    if (disposeMaterials) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (material instanceof MeshStandardMaterial) {
          material.dispose();
        }
      }
    }
  });
}
