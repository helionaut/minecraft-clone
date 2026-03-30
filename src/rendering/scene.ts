import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Fog,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  SRGBColorSpace,
  Scene,
  BoxGeometry,
} from 'three';

import { createGameAudio } from '../audio/gameAudio.ts';
import {
  BLOCK_DEFINITIONS,
  type HotbarBlockType,
  PLACEABLE_BLOCK_ORDER,
  type PlaceableBlockType,
  type WorldBlockType,
  isFluidBlock,
} from '../gameplay/blocks.ts';
import {
  cycleHotbarSlotIndex,
  getHotbarSelectionForSlot,
  normalizeHotbarSlotIndex,
  reconcileHotbarSelection,
} from '../gameplay/hotbar.ts';
import {
  DEFAULT_PLAYER_CONFIG,
  createPlayerState,
  playerIntersectsBlock,
  stepPlayer,
  withLook,
} from '../gameplay/player.ts';
import {
  Inventory,
  RECIPES,
  resolveMiningOutcome,
  type InventoryItemType,
  type Recipe,
  type StationItemType,
  type ToolItemType,
} from '../gameplay/progression.ts';
import {
  movementInputFromTouchVector,
  normalizeStickVector,
} from '../gameplay/touchControls.ts';
import {
  computeVoxelLighting,
  type VoxelLightResult,
} from '../gameplay/lighting.ts';
import {
  DEFAULT_WORLD_CONFIG,
  VoxelWorld,
  parseWorldPersistence,
} from '../gameplay/world.ts';
import { getNearbyStations } from '../gameplay/stations.ts';
import { getVisibleBoundsForPlayer } from './renderBounds.ts';
import { buildRendererDiagnostics, shouldPublishSandboxStatus } from './sandboxStatus.ts';
import { createCloudLayer } from './clouds.ts';
import { createSkyBackdrop, getSkyBackdropTheme } from './skyBackdrop.ts';
import {
  createHeldItemModel,
  disposeHeldItemModel,
  getActivePlaceableBlock,
  getHeldItemAnchorTransform,
  getHeldItemMotion,
  isHeldItemType,
  isHeldToolType,
  isHotbarBlockType,
} from './heldItem.ts';
import {
  createBlockMaterialFactory,
  type FaceVisibilityMask,
} from './textures.ts';
import { type CellTarget, getLookDirection, traceVoxelTarget } from './voxelRaycast.ts';
import { getWorldLightingRigState } from './worldLighting.ts';
import {
  clearWebGpuSafeMode,
  createSceneRenderer,
  getWebGpuPreference,
  persistWebGpuSafeMode,
  type SceneRenderer,
} from './sceneRenderer.ts';
import { createDesktopVolumetricLightVolume } from './desktopVolumetricLighting.ts';

export interface InventoryStatusEntry {
  readonly type: string;
  readonly count: number;
}

export interface RecipeStatusEntry {
  readonly id: string;
  readonly label: string;
  readonly station: string | null;
  readonly available: boolean;
  readonly inputs: readonly InventoryStatusEntry[];
  readonly outputs: readonly InventoryStatusEntry[];
}

export interface SandboxStatus {
  readonly locked: boolean;
  readonly activeItem: InventoryItemType | null;
  readonly selectedBlock: PlaceableBlockType;
  readonly coords: string;
  readonly target: string;
  readonly prompt: string;
  readonly touchDevice: boolean;
  readonly selectedTool: string;
  readonly stations: string;
  readonly nearbyStations?: readonly string[];
  readonly renderer: string;
  readonly inventory: readonly InventoryStatusEntry[];
  readonly recipes: readonly RecipeStatusEntry[];
  readonly placeableCounts: Readonly<Record<string, number>>;
}

export interface PlayableScene {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: SceneRenderer;
  readonly setSelectedBlock: (type: HotbarBlockType) => void;
  readonly craftRecipe: (recipeId: string) => void;
  readonly mineBlockAt: (x: number, y: number, z: number) => {
    readonly success: boolean;
    readonly drop: InventoryItemType | null;
  };
  readonly placeSelectedBlockOnNearestSurface: () => {
    readonly placed: boolean;
    readonly position: { readonly x: number; readonly y: number; readonly z: number } | null;
  };
  readonly getBlockAt: (x: number, y: number, z: number) => WorldBlockType | null;
  readonly getStatusSnapshot: () => SandboxStatus | null;
  readonly resetWorld: () => void;
  readonly dispose: () => void;
}

export interface TouchUiControls {
  readonly root: HTMLElement;
  readonly lookSurface: HTMLElement;
  readonly moveStick: HTMLElement;
  readonly moveThumb: HTMLElement;
  readonly jumpButton: HTMLButtonElement;
  readonly breakButton: HTMLButtonElement;
  readonly placeButton: HTMLButtonElement;
  readonly hotbarPrevButton: HTMLButtonElement;
  readonly hotbarNextButton: HTMLButtonElement;
}

export interface PlayableSceneOptions {
  readonly freezeAtSpawnFrame?: boolean;
}

export interface HotbarSelectionControls {
  readonly getHotbarSlots: () => readonly (InventoryItemType | null)[];
  readonly getSelectedHotbarSlotIndex: () => number;
  readonly setSelectedHotbarSlotIndex: (slotIndex: number) => void;
  readonly getActiveHotbarItem: () => InventoryItemType | null;
  readonly setActiveHotbarItem: (type: InventoryItemType | null) => void;
}

const FACE_VISIBILITY: ReadonlyArray<readonly [keyof FaceVisibilityMask, number, number, number]> = [
  ['px', 1, 0, 0],
  ['nx', -1, 0, 0],
  ['py', 0, 1, 0],
  ['ny', 0, -1, 0],
  ['pz', 0, 0, 1],
  ['nz', 0, 0, -1],
];

const TARGET_REACH = 6;
const HELD_ITEM_EQUIP_DURATION = 0.18;
const HELD_ITEM_SWING_DURATION = 0.24;

interface StreamingProfile {
  readonly renderChunkRadius: number;
  readonly keepLoadedChunkRadius: number;
  readonly maxLoadedChunks: number;
  readonly pixelRatioCap: number;
}

const DESKTOP_STREAMING_PROFILE: StreamingProfile = {
  renderChunkRadius: 1,
  keepLoadedChunkRadius: 2,
  maxLoadedChunks: 25,
  pixelRatioCap: 2,
};

const MOBILE_STREAMING_PROFILE: StreamingProfile = {
  renderChunkRadius: 1,
  keepLoadedChunkRadius: 1,
  maxLoadedChunks: 9,
  pixelRatioCap: 1.25,
};

function formatCoords(value: number): string {
  return value.toFixed(1);
}

function createVisibleFaces(): FaceVisibilityMask {
  return { px: true, nx: true, py: true, ny: true, pz: true, nz: true };
}

function getRenderBrightness(block: CellTarget, lighting: VoxelLightResult): number {
  return lighting.getBlockBrightness(block.x, block.y, block.z);
}

function inventoryStorageKey(): string {
  return `minecraft-clone:inventory:v1:${DEFAULT_WORLD_CONFIG.seed}`;
}

function getBestTool(inventory: Inventory): ToolItemType | null {
  for (const tool of ['iron-pickaxe', 'stone-pickaxe', 'wooden-pickaxe'] as const) {
    if (inventory.getCount(tool) > 0) {
      return tool;
    }
  }

  return null;
}

function getReadableName(value: string): string {
  return value.replaceAll('-', ' ');
}

function statusEntriesFromCounts(
  counts: Readonly<Partial<Record<InventoryItemType, number>>>,
): InventoryStatusEntry[] {
  return Object.entries(counts)
    .flatMap(([type, count]) => (count && count > 0 ? [{ type, count }] : []))
    .sort((left, right) => left.type.localeCompare(right.type));
}

function recipeAvailable(recipe: Recipe, inventory: Inventory, nearbyStations: readonly StationItemType[]): boolean {
  const probe = Inventory.fromJSON(JSON.stringify(inventory.toJSON()));
  return probe.craft(recipe.id, nearbyStations);
}

function findNearestPlacementCell(
  world: VoxelWorld,
  playerPosition: { readonly x: number; readonly y: number; readonly z: number },
): { readonly x: number; readonly y: number; readonly z: number } | null {
  const originX = Math.floor(playerPosition.x);
  const originY = Math.floor(playerPosition.y);
  const originZ = Math.floor(playerPosition.z);
  let bestCell: { readonly x: number; readonly y: number; readonly z: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
    for (let offsetX = -3; offsetX <= 3; offsetX += 1) {
      for (let offsetZ = -3; offsetZ <= 3; offsetZ += 1) {
        const x = originX + offsetX;
        const supportY = originY + offsetY;
        const z = originZ + offsetZ;
        const y = supportY + 1;

        if (
          y < world.config.minY ||
          y > world.config.maxY + 1 ||
          !world.hasBlock(x, supportY, z) ||
          world.hasBlock(x, y, z) ||
          playerIntersectsBlock(playerPosition, x, y, z)
        ) {
          continue;
        }

        const distance = Math.hypot(offsetX, offsetY, offsetZ);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestCell = { x, y, z };
        }
      }
    }
  }

  return bestCell;
}

export async function createPlayableScene(
  container: HTMLElement,
  onStatusChange: (status: SandboxStatus) => void,
  touchControls?: TouchUiControls,
  hotbarControls?: HotbarSelectionControls,
  options: PlayableSceneOptions = {},
): Promise<PlayableScene> {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Minecraft clone sandbox viewport');
  container.append(canvas);

  const initialLightingRig = getWorldLightingRigState(0, 0, DEFAULT_WORLD_CONFIG.chunkSize * 2);

  const scene = new Scene();
  const skyBackdrop = createSkyBackdrop(
    getSkyBackdropTheme(initialLightingRig.daylight, initialLightingRig.horizonGlow),
  );
  const sceneBackground = new Color(skyBackdrop.theme.backgroundColor);
  scene.background = sceneBackground;
  const sceneFog = new Fog(
    skyBackdrop.theme.fogColor,
    skyBackdrop.theme.fogNear,
    skyBackdrop.theme.fogFar,
  );
  scene.fog = sceneFog;

  const camera = new PerspectiveCamera(75, 1, 0.1, 180);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const ambient = new HemisphereLight(
    initialLightingRig.ambientSkyColor,
    initialLightingRig.ambientGroundColor,
    initialLightingRig.ambientIntensity,
  );
  const sun = new DirectionalLight(initialLightingRig.sunColor, initialLightingRig.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00022;
  sun.shadow.normalBias = 0.03;
  const sunTarget = new Object3D();
  sun.position.set(
    initialLightingRig.sunPosition.x,
    initialLightingRig.sunPosition.y,
    initialLightingRig.sunPosition.z,
  );
  sunTarget.position.set(
    initialLightingRig.targetPosition.x,
    initialLightingRig.targetPosition.y,
    initialLightingRig.targetPosition.z,
  );
  sun.target = sunTarget;
  sun.shadow.camera.left = initialLightingRig.shadowBounds.left;
  sun.shadow.camera.right = initialLightingRig.shadowBounds.right;
  sun.shadow.camera.top = initialLightingRig.shadowBounds.top;
  sun.shadow.camera.bottom = initialLightingRig.shadowBounds.bottom;
  sun.shadow.camera.near = initialLightingRig.shadowBounds.near;
  sun.shadow.camera.far = initialLightingRig.shadowBounds.far;
  const playerLantern = new PointLight(0xffd6a0, 1.6, 14, 2);
  scene.add(ambient, sun, sunTarget, playerLantern);
  const diagnosticsCanvas = document.createElement('canvas');
  const gl = diagnosticsCanvas.getContext('webgl2', {
    antialias: true,
    alpha: true,
  });
  const debugRendererInfo = gl?.getExtension('WEBGL_debug_renderer_info') ?? null;
  const rendererDiagnostics = buildRendererDiagnostics({
    version: gl && typeof gl.getParameter === 'function' ? String(gl.getParameter(gl.VERSION)) : null,
    vendor: gl && typeof gl.getParameter === 'function'
      ? String(gl.getParameter(debugRendererInfo ? debugRendererInfo.UNMASKED_VENDOR_WEBGL : gl.VENDOR))
      : null,
    renderer: gl && typeof gl.getParameter === 'function'
      ? String(gl.getParameter(debugRendererInfo ? debugRendererInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
      : null,
  });

  const storedWorld = parseWorldPersistence(window.localStorage.getItem(
    `minecraft-clone:world:v2:${DEFAULT_WORLD_CONFIG.seed}:${DEFAULT_WORLD_CONFIG.chunkSize}`,
  ));
  const world = new VoxelWorld(DEFAULT_WORLD_CONFIG, storedWorld);
  const inventory = Inventory.fromJSON(window.localStorage.getItem(inventoryStorageKey()));
  const touchDevice = (
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
  const webGpuPreference = getWebGpuPreference(window.location.search, window.localStorage);
  const rendererSelection = await createSceneRenderer({
    canvas,
    touchDevice,
    rendererDiagnostics,
    webGpuPreference,
    onWebGpuDeviceLost: (info) => {
      persistWebGpuSafeMode(window.localStorage, info);
      window.location.reload();
    },
  });

  if (rendererSelection.backend === 'webgpu') {
    clearWebGpuSafeMode(window.localStorage);
  }

  const renderer = rendererSelection.renderer;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = initialLightingRig.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const volumetricLighting = rendererSelection.volumetricLighting;
  const rendererDeviceSummary = rendererDiagnostics.summary.split(' | ').slice(1).join(' | ');
  const rendererSummary = [
    rendererSelection.backend === 'webgpu' ? 'WebGPU' : 'WebGL 2',
    rendererDeviceSummary || rendererDiagnostics.summary,
    rendererSelection.fallbackReason === 'webgpu-device-lost'
      ? 'safe mode after previous WebGPU device loss'
      : null,
    volumetricLighting.enabled
      ? 'volumetric lighting enabled'
      : `volumetric lighting disabled (${volumetricLighting.reason ?? 'unknown'})`,
  ].filter((value): value is string => Boolean(value)).join(' | ');
  let player = createPlayerState(world.getSpawnPoint());
  const worldGroup = new Group();
  const clouds = createCloudLayer(DEFAULT_WORLD_CONFIG.seed);
  skyBackdrop.update(
    player.position.x,
    player.position.z,
    initialLightingRig.daylight,
    initialLightingRig.horizonGlow,
  );
  clouds.update(player.position.x, player.position.z, 0);
  scene.add(skyBackdrop.group);
  scene.add(clouds.group);
  scene.add(worldGroup);

  const blockGeometry = new BoxGeometry(1, 1, 1);
  const waterGeometry = new BoxGeometry(1.002, 0.88, 1.002);
  const highlightGeometry = new EdgesGeometry(new BoxGeometry(1.02, 1.02, 1.02));
  const blockMaterialFactory = createBlockMaterialFactory();
  const audio = createGameAudio();
  const heldItemAnchorBase = getHeldItemAnchorTransform(touchDevice);
  const heldItemAnchor = new Group();
  heldItemAnchor.position.set(
    heldItemAnchorBase.position.x,
    heldItemAnchorBase.position.y,
    heldItemAnchorBase.position.z,
  );
  heldItemAnchor.rotation.set(
    heldItemAnchorBase.rotation.x,
    heldItemAnchorBase.rotation.y,
    heldItemAnchorBase.rotation.z,
  );
  heldItemAnchor.scale.setScalar(heldItemAnchorBase.scale);
  camera.add(heldItemAnchor);

  const targetOutline = new LineSegments(
    highlightGeometry,
    new LineBasicMaterial({ color: BLOCK_DEFINITIONS.highlight.color }),
  );
  targetOutline.visible = false;
  scene.add(targetOutline);

  const placementPreview = new Mesh(
    blockGeometry,
    new MeshStandardMaterial({
      color: BLOCK_DEFINITIONS.grass.color,
      transparent: true,
      opacity: 0.45,
    }),
  );
  placementPreview.visible = false;
  scene.add(placementPreview);
  const volumetricLightVolume = volumetricLighting.enabled
    ? createDesktopVolumetricLightVolume()
    : null;

  if (volumetricLightVolume) {
    scene.add(volumetricLightVolume);
  }

  let selectedBlock: HotbarBlockType = 'grass';
  let selectedHotbarSlotIndex = normalizeHotbarSlotIndex(
    hotbarControls?.getHotbarSlots().length ?? PLACEABLE_BLOCK_ORDER.length,
    hotbarControls?.getSelectedHotbarSlotIndex() ?? 0,
  );
  let activeHotbarItem: InventoryItemType | null = hotbarControls?.getActiveHotbarItem() ?? null;
  let activeHeldItemModel: Group | null = null;
  let activeHeldItemType: InventoryItemType | null = null;
  let heldItemEquipTimer = 0;
  let heldItemSwingTimer = 0;
  let heldItemSwingIntensity = 0;
  let locked = false;
  const streamingProfile = touchDevice ? MOBILE_STREAMING_PROFILE : DESKTOP_STREAMING_PROFILE;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, streamingProfile.pixelRatioCap));
  let currentTarget: CellTarget | null = null;
  let currentPlacement: { x: number; y: number; z: number } | null = null;
  let worldDirty = true;
  let activeChunkKey = '';
  let fluidAccumulator = 0;
  let lastPublishedStatus: SandboxStatus | null = null;
  const input = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
  };

  const syncSize = () => {
    const { clientWidth, clientHeight } = container;
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
  };

  const persistWorld = () => {
    const snapshot = world.getPersistence();

    if (snapshot.mutations.length === 0) {
      window.localStorage.removeItem(world.storageKey);
    } else {
      window.localStorage.setItem(world.storageKey, JSON.stringify(snapshot));
    }
  };

  const persistInventory = () => {
    const snapshot = inventory.toJSON();

    if (Object.keys(snapshot).length === 0) {
      window.localStorage.removeItem(inventoryStorageKey());
      return;
    }

    window.localStorage.setItem(inventoryStorageKey(), JSON.stringify(snapshot));
  };

  const getVisibleBounds = () => {
    return getVisibleBoundsForPlayer(player.position, world.config, streamingProfile.renderChunkRadius);
  };

  const hasInventoryCount = (type: HotbarBlockType) => inventory.getCount(type as InventoryItemType) > 0;
  const hasInventoryItemCount = (type: InventoryItemType) => inventory.getCount(type) > 0;
  const getHotbarItems = (): Array<InventoryItemType | null> => {
    const configuredSlots = hotbarControls?.getHotbarSlots();

    if (configuredSlots) {
      return Array.from({ length: PLACEABLE_BLOCK_ORDER.length }, (_unused, index) => {
        const type = configuredSlots[index];
        return type && hasInventoryItemCount(type) ? type : null;
      });
    }

    return PLACEABLE_BLOCK_ORDER.map((type) => (hasInventoryItemCount(type) ? type : null));
  };
  const getSelectableHotbarSlots = (): Array<HotbarBlockType | null> => {
    return getHotbarItems().map((type) => (isHotbarBlockType(type) && hasInventoryCount(type) ? type : null));
  };

  const applyHotbarSelection = (nextSlotIndex: number, playSound = false) => {
    const nextNormalizedSlotIndex = normalizeHotbarSlotIndex(getHotbarItems().length, nextSlotIndex);
    const nextActiveHotbarItem = getHotbarSelectionForSlot(
      getHotbarItems(),
      nextNormalizedSlotIndex,
      hasInventoryItemCount,
    );
    const changed =
      nextNormalizedSlotIndex !== selectedHotbarSlotIndex ||
      nextActiveHotbarItem !== activeHotbarItem;

    selectedHotbarSlotIndex = nextNormalizedSlotIndex;
    hotbarControls?.setSelectedHotbarSlotIndex(selectedHotbarSlotIndex);
    activeHotbarItem = nextActiveHotbarItem;
    hotbarControls?.setActiveHotbarItem(activeHotbarItem);

    if (isHotbarBlockType(activeHotbarItem)) {
      selectedBlock = activeHotbarItem;
    }

    if (playSound && changed) {
      audio.playSelect();
    }

    return changed;
  };

  const updateHeldItem = () => {
    applyHotbarSelection(
      hotbarControls?.getSelectedHotbarSlotIndex() ?? selectedHotbarSlotIndex,
      false,
    );

    if (activeHeldItemType === activeHotbarItem) {
      return;
    }

    if (activeHeldItemModel) {
      heldItemAnchor.remove(activeHeldItemModel);
      disposeHeldItemModel(activeHeldItemModel);
      activeHeldItemModel = null;
    }

    activeHeldItemType = activeHotbarItem;
    heldItemEquipTimer = isHeldItemType(activeHotbarItem) ? HELD_ITEM_EQUIP_DURATION : 0;

    if (!isHeldItemType(activeHotbarItem)) {
      return;
    }

    activeHeldItemModel = createHeldItemModel(activeHotbarItem, blockMaterialFactory);

    if (touchDevice && isHeldToolType(activeHotbarItem)) {
      activeHeldItemModel.position.x -= 0.2;
      activeHeldItemModel.position.y += 0.14;
      activeHeldItemModel.scale.multiplyScalar(1.1);
    }

    heldItemAnchor.add(activeHeldItemModel);
  };

  const triggerHeldItemSwing = (intensity: number) => {
    if (!isHeldItemType(activeHotbarItem)) {
      return;
    }

    heldItemSwingTimer = HELD_ITEM_SWING_DURATION;
    heldItemSwingIntensity = intensity;
  };

  const rebuildWorld = () => {
    world.loadChunksAround(
      Math.floor(player.position.x),
      Math.floor(player.position.z),
      streamingProfile.renderChunkRadius,
      streamingProfile.maxLoadedChunks,
    );
    world.pruneLoadedChunks(
      Math.floor(player.position.x),
      Math.floor(player.position.z),
      streamingProfile.keepLoadedChunkRadius,
    );

    const bounds = getVisibleBounds();
    const lighting = computeVoxelLighting(bounds, (x, y, z) => world.getBlock(x, y, z));
    worldGroup.clear();

    world.forEachLoadedBlockInBounds(bounds, (block) => {
      const visibleFaces = createVisibleFaces();
      let hasVisibleFace = false;

      for (const [face, dx, dy, dz] of FACE_VISIBILITY) {
        const neighbor = world.getLoadedBlock(block.x + dx, block.y + dy, block.z + dz);
        const visible = !neighbor || (
          block.type === 'water' || block.type === 'lava'
            ? neighbor !== block.type
            : !BLOCK_DEFINITIONS[neighbor].opaque
        );
        visibleFaces[face] = visible;
        hasVisibleFace ||= visible;
      }

      if (!hasVisibleFace) {
        return;
      }

      const brightness = getRenderBrightness(block, lighting);
      const voxel = new Mesh(
        block.type === 'water' ? waterGeometry : blockGeometry,
        blockMaterialFactory.getMaterials(block.type, brightness, visibleFaces),
      );
      voxel.position.set(
        block.x + 0.5,
        block.y + (block.type === 'water' ? 0.44 : 0.5),
        block.z + 0.5,
      );
      voxel.userData.cell = block;
      voxel.castShadow = block.type !== 'water' && block.type !== 'lava';
      voxel.receiveShadow = block.type !== 'water';
      worldGroup.add(voxel);
    });

    worldDirty = false;
  };

  const updateStatus = () => {
    selectedBlock = reconcileHotbarSelection(selectedBlock, getSelectableHotbarSlots(), hasInventoryCount);
    updateHeldItem();
    const eyeY = player.position.y + DEFAULT_PLAYER_CONFIG.eyeHeight;
    const activePlaceableBlock = getActivePlaceableBlock(activeHotbarItem);
    const selectedTool = getBestTool(inventory);
    const nearbyStations = getNearbyStations(
      world,
      Math.floor(player.position.x),
      Math.floor(player.position.y),
      Math.floor(player.position.z),
    );
    const prompt = locked
      ? `WASD move, Space jump, click to mine/build, wheel or 1-${PLACEABLE_BLOCK_ORDER.length} switch items, craft from the inventory panel${rendererSelection.fallbackReason === 'webgpu-device-lost' ? ', stable graphics mode enabled after a previous WebGPU reset on this device' : ''}`
      : touchDevice
        ? 'Use the left thumbstick to move, drag anywhere to aim, mine blocks for drops, and craft tools or stations from the drawer.'
        : rendererSelection.fallbackReason === 'webgpu-device-lost'
          ? 'Running in stable graphics mode after a previous WebGPU reset on this device. Click the viewport to capture the mouse and enter the world.'
          : 'Click the viewport to capture the mouse and enter the world.';
    const target = currentTarget
      ? `Target ${currentTarget.type} @ ${currentTarget.x}, ${currentTarget.y}, ${currentTarget.z}${
          currentPlacement && activePlaceableBlock
            ? ` | Place ${activePlaceableBlock} @ ${currentPlacement.x}, ${currentPlacement.y}, ${currentPlacement.z}`
            : ''
        }`
      : 'Aim at terrain, ore, or stations to mine. Place blocks from your inventory.';
    const inventoryEntries = inventory.entries();
    const placeableCounts = Object.fromEntries(
      PLACEABLE_BLOCK_ORDER.map((type) => [type, inventory.getCount(type as InventoryItemType)]),
    );

    const status: SandboxStatus = {
      locked,
      activeItem: activeHotbarItem,
      selectedBlock,
      coords: `X ${formatCoords(player.position.x)} Y ${formatCoords(eyeY)} Z ${formatCoords(player.position.z)}`,
      target,
      prompt,
      touchDevice,
      selectedTool: selectedTool ? getReadableName(selectedTool) : 'hand',
      stations: nearbyStations.length > 0 ? nearbyStations.map(getReadableName).join(', ') : 'none nearby',
      nearbyStations: nearbyStations.map(getReadableName),
      renderer: rendererSummary,
      inventory: inventoryEntries,
      recipes: RECIPES.map((recipe) => ({
        id: recipe.id,
        label: getReadableName(recipe.id),
        station: recipe.station ? getReadableName(recipe.station) : null,
        available: recipeAvailable(recipe, inventory, nearbyStations),
        inputs: statusEntriesFromCounts(recipe.inputs),
        outputs: statusEntriesFromCounts(recipe.outputs),
      })),
      placeableCounts,
    };

    if (!shouldPublishSandboxStatus(lastPublishedStatus, status)) {
      return;
    }

    lastPublishedStatus = status;
    onStatusChange(status);
  };

  const updateTargeting = () => {
    const eyeY = player.position.y + DEFAULT_PLAYER_CONFIG.eyeHeight;
    const { target, placement } = traceVoxelTarget(
      { x: player.position.x, y: eyeY, z: player.position.z },
      getLookDirection(player.yaw, player.pitch),
      TARGET_REACH,
      (x, y, z) => world.getBlock(x, y, z),
    );

    if (!target) {
      currentTarget = null;
      currentPlacement = null;
      targetOutline.visible = false;
      placementPreview.visible = false;
      updateStatus();
      return;
    }

    currentTarget = target;
    targetOutline.visible = true;
    targetOutline.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);

    if (
      placement &&
      getActivePlaceableBlock(activeHotbarItem) &&
      placement.y >= world.config.minY &&
      placement.y <= world.config.maxY + 1 &&
      !world.hasBlock(placement.x, placement.y, placement.z) &&
      !playerIntersectsBlock(player.position, placement.x, placement.y, placement.z)
    ) {
      currentPlacement = placement;
      placementPreview.visible = true;
      placementPreview.position.set(placement.x + 0.5, placement.y + 0.5, placement.z + 0.5);
      (placementPreview.material as MeshStandardMaterial).color.setHex(
        BLOCK_DEFINITIONS[getActivePlaceableBlock(activeHotbarItem) ?? selectedBlock].color,
      );
    } else {
      currentPlacement = null;
      placementPreview.visible = false;
    }

    updateStatus();
  };

  const tryInteract = (button: number) => {
    if ((!locked && !touchDevice) || !currentTarget) {
      return;
    }

    if (button === 0) {
      mineBlockAt(currentTarget.x, currentTarget.y, currentTarget.z);

      return;
    }

    if (button === 2 && currentPlacement) {
      placeSelectedBlock(currentPlacement.x, currentPlacement.y, currentPlacement.z);
    }
  };

  const placeSelectedBlock = (x: number, y: number, z: number) => {
    const placeableBlock = getActivePlaceableBlock(activeHotbarItem);

    if (
      !placeableBlock ||
      y < world.config.minY ||
      y > world.config.maxY + 1 ||
      world.hasBlock(x, y, z) ||
      playerIntersectsBlock(player.position, x, y, z) ||
      inventory.getCount(placeableBlock) <= 0
    ) {
      return false;
    }

    if (!world.placeBlock(x, y, z, placeableBlock)) {
      return false;
    }

    inventory.removeItem(placeableBlock);
    persistInventory();
    audio.playPlace();
    triggerHeldItemSwing(0.65);
    world.tickFluids(2);
    persistWorld();
    worldDirty = true;
    rebuildWorld();
    updateTargeting();
    return true;
  };

  const mineBlockAt = (x: number, y: number, z: number) => {
    const block = world.getBlock(x, y, z);

    if (!block) {
      updateStatus();
      return {
        success: false,
        drop: null,
      };
    }

    const outcome = resolveMiningOutcome(block, getBestTool(inventory));

    if (!outcome.success || !world.removeBlock(x, y, z)) {
      updateStatus();
      return {
        success: false,
        drop: null,
      };
    }

    if (outcome.drop) {
      inventory.addItem(outcome.drop);
      persistInventory();
    }

    audio.playMine();
    triggerHeldItemSwing(1);
    world.tickFluids(4);
    persistWorld();
    worldDirty = true;
    rebuildWorld();
    updateTargeting();
    return outcome;
  };

  const requestPointerLock = () => {
    audio.unlock();

    if (!touchDevice && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  };

  const craftRecipe = (recipeId: string) => {
    const nearbyStations = getNearbyStations(
      world,
      Math.floor(player.position.x),
      Math.floor(player.position.y),
      Math.floor(player.position.z),
    );

    if (!inventory.craft(recipeId, nearbyStations)) {
      updateStatus();
      return;
    }

    persistInventory();
    audio.playCraft();
    updateStatus();
  };

  const placeSelectedBlockOnNearestSurface = () => {
    const placement = findNearestPlacementCell(world, player.position);

    if (!placement) {
      return {
        placed: false,
        position: null,
      };
    }

    return {
      placed: placeSelectedBlock(placement.x, placement.y, placement.z),
      position: placement,
    };
  };

  const applyTouchLook = (deltaX: number, deltaY: number) => {
    const lookSensitivity = 0.0074;
    player = withLook(player, player.yaw - deltaX * lookSensitivity, player.pitch - deltaY * lookSensitivity);
    updateStatus();
  };

  const onPointerLockChange = () => {
    locked = document.pointerLockElement === canvas;
    updateStatus();
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!locked) {
      return;
    }

    const lookSensitivity = 0.0026;
    player = withLook(player, player.yaw - event.movementX * lookSensitivity, player.pitch - event.movementY * lookSensitivity);
    updateStatus();
  };

  const setInputFlag = (code: string, active: boolean) => {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        input.forward = active;
        break;
      case 'KeyS':
      case 'ArrowDown':
        input.backward = active;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        input.left = active;
        break;
      case 'KeyD':
      case 'ArrowRight':
        input.right = active;
        break;
      case 'Space':
        input.jump = active;
        break;
      default:
        break;
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    audio.unlock();

    if (event.code === 'Space') {
      event.preventDefault();
    }

    if (event.code.startsWith('Digit')) {
      const slot = Number(event.code.slice(5)) - 1;
      applyHotbarSelection(slot, true);
      updateTargeting();
      return;
    }

    if (event.code === 'BracketLeft') {
      applyHotbarSelection(cycleHotbarSlotIndex(selectedHotbarSlotIndex, getHotbarItems().length, -1), true);
      updateTargeting();
      return;
    }

    if (event.code === 'BracketRight') {
      applyHotbarSelection(cycleHotbarSlotIndex(selectedHotbarSlotIndex, getHotbarItems().length, 1), true);
      updateTargeting();
      return;
    }

    setInputFlag(event.code, true);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    setInputFlag(event.code, false);
  };

  const onMouseDown = (event: MouseEvent) => {
    audio.unlock();

    if (event.button === 0 && !locked) {
      requestPointerLock();
      return;
    }

    if (event.button === 0 || event.button === 2) {
      event.preventDefault();
      tryInteract(event.button);
    }
  };

  const onWheel = (event: WheelEvent) => {
    audio.unlock();
    event.preventDefault();
    applyHotbarSelection(
      cycleHotbarSlotIndex(
        selectedHotbarSlotIndex,
        getHotbarItems().length,
        event.deltaY > 0 ? 1 : -1,
      ),
      true,
    );
    updateTargeting();
  };

  const movePointerState = {
    id: -1,
    originX: 0,
    originY: 0,
  };
  const lookPointerState = {
    id: -1,
    lastX: 0,
    lastY: 0,
  };

  const setMovementFromVector = (x: number, y: number) => {
    const movement = movementInputFromTouchVector({ x, y });
    input.forward = movement.forward;
    input.backward = movement.backward;
    input.left = movement.left;
    input.right = movement.right;
  };

  const resetTouchMovement = () => {
    movePointerState.id = -1;
    setMovementFromVector(0, 0);

    if (touchControls) {
      touchControls.moveThumb.style.transform = 'translate(-50%, -50%)';
    }
  };

  const onMoveStickPointerDown = (event: PointerEvent) => {
    if (!touchControls || event.pointerType === 'mouse' || movePointerState.id !== -1) {
      return;
    }

    event.preventDefault();
    audio.unlock();
    movePointerState.id = event.pointerId;
    movePointerState.originX = event.clientX;
    movePointerState.originY = event.clientY;
    touchControls.moveStick.setPointerCapture(event.pointerId);
  };

  const onMoveStickPointerMove = (event: PointerEvent) => {
    if (!touchControls || event.pointerId !== movePointerState.id) {
      return;
    }

    event.preventDefault();
    const radius = touchControls.moveStick.clientWidth * 0.32;
    const vector = normalizeStickVector(
      { x: movePointerState.originX, y: movePointerState.originY },
      { x: event.clientX, y: event.clientY },
      radius,
    );

    setMovementFromVector(vector.x, vector.y);
    touchControls.moveThumb.style.transform = `translate(calc(-50% + ${vector.x * radius}px), calc(-50% + ${vector.y * radius}px))`;
  };

  const onMoveStickPointerEnd = (event: PointerEvent) => {
    if (!touchControls || event.pointerId !== movePointerState.id) {
      return;
    }

    event.preventDefault();
    touchControls.moveStick.releasePointerCapture(event.pointerId);
    resetTouchMovement();
  };

  const onLookSurfacePointerDown = (event: PointerEvent) => {
    if (!touchControls || event.pointerType === 'mouse' || lookPointerState.id !== -1) {
      return;
    }

    event.preventDefault();
    audio.unlock();
    lookPointerState.id = event.pointerId;
    lookPointerState.lastX = event.clientX;
    lookPointerState.lastY = event.clientY;
    touchControls.lookSurface.setPointerCapture(event.pointerId);
  };

  const onLookSurfacePointerMove = (event: PointerEvent) => {
    if (!touchControls || event.pointerId !== lookPointerState.id) {
      return;
    }

    event.preventDefault();
    applyTouchLook(event.clientX - lookPointerState.lastX, event.clientY - lookPointerState.lastY);
    lookPointerState.lastX = event.clientX;
    lookPointerState.lastY = event.clientY;
  };

  const resetLookPointer = (event: PointerEvent) => {
    if (!touchControls || event.pointerId !== lookPointerState.id) {
      return;
    }

    event.preventDefault();
    touchControls.lookSurface.releasePointerCapture(event.pointerId);
    lookPointerState.id = -1;
  };

  const onJumpPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') {
      return;
    }

    event.preventDefault();
    audio.unlock();
    input.jump = true;
  };

  const onJumpPointerUp = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') {
      return;
    }

    event.preventDefault();
    input.jump = false;
  };

  const onTouchActionClick = (button: 0 | 2) => (event: PointerEvent) => {
    if (event.pointerType === 'mouse') {
      return;
    }

    event.preventDefault();
    audio.unlock();
    tryInteract(button);
  };

  const onHotbarCycleClick = (offset: number) => (event: PointerEvent) => {
    if (event.pointerType === 'mouse') {
      return;
    }

    event.preventDefault();
    audio.unlock();
    applyHotbarSelection(cycleHotbarSlotIndex(selectedHotbarSlotIndex, getHotbarItems().length, offset), true);
    updateTargeting();
  };
  const onBreakPointerDown = onTouchActionClick(0);
  const onPlacePointerDown = onTouchActionClick(2);
  const onHotbarPrevPointerDown = onHotbarCycleClick(-1);
  const onHotbarNextPointerDown = onHotbarCycleClick(1);

  const resetWorld = () => {
    world.reset();
    inventory.clear();
    window.localStorage.removeItem(world.storageKey);
    window.localStorage.removeItem(inventoryStorageKey());
    player = createPlayerState(world.getSpawnPoint());
    worldDirty = true;
    rebuildWorld();
    updateTargeting();
  };

  rebuildWorld();
  syncSize();
  updateStatus();

  const resizeObserver = new ResizeObserver(syncSize);
  resizeObserver.observe(container);

  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  if (touchControls) {
    touchControls.lookSurface.addEventListener('pointerdown', onLookSurfacePointerDown);
    touchControls.lookSurface.addEventListener('pointermove', onLookSurfacePointerMove);
    touchControls.lookSurface.addEventListener('pointerup', resetLookPointer);
    touchControls.lookSurface.addEventListener('pointercancel', resetLookPointer);
    touchControls.moveStick.addEventListener('pointerdown', onMoveStickPointerDown);
    touchControls.moveStick.addEventListener('pointermove', onMoveStickPointerMove);
    touchControls.moveStick.addEventListener('pointerup', onMoveStickPointerEnd);
    touchControls.moveStick.addEventListener('pointercancel', onMoveStickPointerEnd);
    touchControls.jumpButton.addEventListener('pointerdown', onJumpPointerDown);
    touchControls.jumpButton.addEventListener('pointerup', onJumpPointerUp);
    touchControls.jumpButton.addEventListener('pointercancel', onJumpPointerUp);
    touchControls.breakButton.addEventListener('pointerdown', onBreakPointerDown);
    touchControls.placeButton.addEventListener('pointerdown', onPlacePointerDown);
    touchControls.hotbarPrevButton.addEventListener('pointerdown', onHotbarPrevPointerDown);
    touchControls.hotbarNextButton.addEventListener('pointerdown', onHotbarNextPointerDown);
  }

  let previousTime = performance.now();
  let elapsedTime = 0;

  const syncFrameVisuals = (previousPlayer: typeof player, delta: number) => {
    camera.position.set(
      player.position.x,
      player.position.y + DEFAULT_PLAYER_CONFIG.eyeHeight,
      player.position.z,
    );
    playerLantern.position.copy(camera.position);
    const lightingRig = getWorldLightingRigState(
      player.position.x,
      player.position.z,
      DEFAULT_WORLD_CONFIG.chunkSize * (streamingProfile.renderChunkRadius * 2 + 1),
      elapsedTime,
    );
    ambient.color.setHex(lightingRig.ambientSkyColor);
    ambient.groundColor.setHex(lightingRig.ambientGroundColor);
    ambient.intensity = lightingRig.ambientIntensity;
    sun.color.setHex(lightingRig.sunColor);
    sun.intensity = lightingRig.sunIntensity;
    renderer.toneMappingExposure = lightingRig.exposure;
    sun.position.set(
      lightingRig.sunPosition.x,
      lightingRig.sunPosition.y,
      lightingRig.sunPosition.z,
    );
    sunTarget.position.set(
      lightingRig.targetPosition.x,
      lightingRig.targetPosition.y,
      lightingRig.targetPosition.z,
    );
    sun.shadow.camera.left = lightingRig.shadowBounds.left;
    sun.shadow.camera.right = lightingRig.shadowBounds.right;
    sun.shadow.camera.top = lightingRig.shadowBounds.top;
    sun.shadow.camera.bottom = lightingRig.shadowBounds.bottom;
    sun.shadow.camera.near = lightingRig.shadowBounds.near;
    sun.shadow.camera.far = lightingRig.shadowBounds.far;
    sun.shadow.camera.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
    skyBackdrop.update(
      player.position.x,
      player.position.z,
      lightingRig.daylight,
      lightingRig.horizonGlow,
    );
    sceneBackground.setHex(skyBackdrop.theme.backgroundColor);
    sceneFog.color.setHex(skyBackdrop.theme.fogColor);
    sceneFog.near = skyBackdrop.theme.fogNear;
    sceneFog.far = skyBackdrop.theme.fogFar;
    clouds.update(player.position.x, player.position.z, elapsedTime);
    if (volumetricLightVolume) {
      volumetricLightVolume.position.set(player.position.x, 6, player.position.z);
    }
    heldItemEquipTimer = Math.max(0, heldItemEquipTimer - delta);
    heldItemSwingTimer = Math.max(0, heldItemSwingTimer - delta);

    const horizontalSpeed = Math.hypot(
      player.position.x - previousPlayer.position.x,
      player.position.z - previousPlayer.position.z,
    ) / Math.max(delta, 1 / 120);
    const heldItemMotion = activeHeldItemType && isHeldItemType(activeHeldItemType)
      ? getHeldItemMotion({
        elapsedSeconds: elapsedTime,
        movementStrength: horizontalSpeed / DEFAULT_PLAYER_CONFIG.moveSpeed,
        equipStrength: heldItemEquipTimer / HELD_ITEM_EQUIP_DURATION,
        swingStrength: (heldItemSwingTimer / HELD_ITEM_SWING_DURATION) * heldItemSwingIntensity,
        touchDevice,
        type: activeHeldItemType,
      })
      : null;

    heldItemAnchor.position.set(
      heldItemAnchorBase.position.x + (heldItemMotion?.position.x ?? 0),
      heldItemAnchorBase.position.y + (heldItemMotion?.position.y ?? 0),
      heldItemAnchorBase.position.z + (heldItemMotion?.position.z ?? 0),
    );
    heldItemAnchor.rotation.set(
      heldItemAnchorBase.rotation.x + (heldItemMotion?.rotation.x ?? 0),
      heldItemAnchorBase.rotation.y + (heldItemMotion?.rotation.y ?? 0),
      heldItemAnchorBase.rotation.z + (heldItemMotion?.rotation.z ?? 0),
    );

    updateTargeting();
    renderer.render(scene, camera);
  };

  const tick = (now: DOMHighResTimeStamp) => {
    const delta = (now - previousTime) / 1000;
    previousTime = now;
    elapsedTime += delta;
    const previousPlayer = player;

    player = stepPlayer(
      player,
      input,
      delta,
      (x, y, z) => world.isSolidBlock(x, y, z),
      DEFAULT_PLAYER_CONFIG,
      (x, y, z) => isFluidBlock(world.getBlock(x, y, z)),
    );
    audio.update(previousPlayer, player, input, delta);

    const currentChunkKey = `${Math.floor(player.position.x / world.config.chunkSize)},${Math.floor(player.position.z / world.config.chunkSize)}`;
    if (currentChunkKey !== activeChunkKey) {
      activeChunkKey = currentChunkKey;
      worldDirty = true;
    }

    fluidAccumulator += delta;
    if (fluidAccumulator >= 0.35) {
      fluidAccumulator = 0;
      if (world.tickFluids(1) > 0) {
        persistWorld();
        worldDirty = true;
      }
    }

    if (worldDirty) {
      rebuildWorld();
    }

    syncFrameVisuals(previousPlayer, delta);
  };

  if (options.freezeAtSpawnFrame) {
    renderer.setAnimationLoop(null);
    syncFrameVisuals(player, 0);
  } else {
    renderer.setAnimationLoop(tick);
  }

  return {
    canvas,
    renderer,
    setSelectedBlock: (type: HotbarBlockType) => {
      if (!hasInventoryCount(type)) {
        updateStatus();
        return;
      }

      const nextSlotIndex = getHotbarItems().findIndex((item) => item === type);
      if (nextSlotIndex >= 0) {
        applyHotbarSelection(nextSlotIndex, true);
      } else {
        const changed = activeHotbarItem !== type;
        selectedBlock = type;
        activeHotbarItem = type;
        hotbarControls?.setActiveHotbarItem(type);
        if (changed) {
          audio.playSelect();
        }
      }
      updateTargeting();
    },
    craftRecipe,
    mineBlockAt,
    placeSelectedBlockOnNearestSurface,
    getBlockAt: (x: number, y: number, z: number) => world.getBlock(x, y, z),
    getStatusSnapshot: () => lastPublishedStatus,
    resetWorld,
    dispose: () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('wheel', onWheel);
      if (touchControls) {
        touchControls.lookSurface.removeEventListener('pointerdown', onLookSurfacePointerDown);
        touchControls.lookSurface.removeEventListener('pointermove', onLookSurfacePointerMove);
        touchControls.lookSurface.removeEventListener('pointerup', resetLookPointer);
        touchControls.lookSurface.removeEventListener('pointercancel', resetLookPointer);
        touchControls.moveStick.removeEventListener('pointerdown', onMoveStickPointerDown);
        touchControls.moveStick.removeEventListener('pointermove', onMoveStickPointerMove);
        touchControls.moveStick.removeEventListener('pointerup', onMoveStickPointerEnd);
        touchControls.moveStick.removeEventListener('pointercancel', onMoveStickPointerEnd);
        touchControls.jumpButton.removeEventListener('pointerdown', onJumpPointerDown);
        touchControls.jumpButton.removeEventListener('pointerup', onJumpPointerUp);
        touchControls.jumpButton.removeEventListener('pointercancel', onJumpPointerUp);
        touchControls.breakButton.removeEventListener('pointerdown', onBreakPointerDown);
        touchControls.placeButton.removeEventListener('pointerdown', onPlacePointerDown);
        touchControls.hotbarPrevButton.removeEventListener('pointerdown', onHotbarPrevPointerDown);
        touchControls.hotbarNextButton.removeEventListener('pointerdown', onHotbarNextPointerDown);
      }
      renderer.dispose();
      blockGeometry.dispose();
      waterGeometry.dispose();
      highlightGeometry.dispose();
      blockMaterialFactory.dispose();
      volumetricLightVolume?.geometry.dispose();
      volumetricLightVolume?.material.dispose();
      clouds.dispose();
      skyBackdrop.dispose();
      audio.dispose();
      if (activeHeldItemModel) {
        disposeHeldItemModel(activeHeldItemModel);
      }
      (placementPreview.material as MeshStandardMaterial).dispose();
      (targetOutline.material as LineBasicMaterial).dispose();
      canvas.remove();
    },
  };
}
