import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Fog,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { Intersection, Object3D } from 'three';

import { BLOCK_DEFINITIONS } from '../gameplay/blocks.ts';
import {
  DEFAULT_PLAYER_CONFIG,
  createPlayerState,
  playerIntersectsBlock,
  stepPlayer,
  withLook,
} from '../gameplay/player.ts';
import {
  DEFAULT_WORLD_CONFIG,
  VoxelWorld,
  parseWorldPersistence,
  type SolidBlockType,
} from '../gameplay/world.ts';

export interface SandboxStatus {
  readonly locked: boolean;
  readonly selectedBlock: SolidBlockType;
  readonly coords: string;
  readonly target: string;
  readonly prompt: string;
  readonly touchDevice: boolean;
}

export interface PlayableScene {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGLRenderer;
  readonly setSelectedBlock: (type: SolidBlockType) => void;
  readonly resetWorld: () => void;
  readonly dispose: () => void;
}

interface CellTarget {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly type: SolidBlockType;
}

function formatCoords(value: number): string {
  return value.toFixed(1);
}

export function createPlayableScene(
  container: HTMLElement,
  onStatusChange: (status: SandboxStatus) => void,
): PlayableScene {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Minecraft clone sandbox viewport');
  container.append(canvas);

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    canvas,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new Scene();
  scene.background = new Color(0x89c6ec);
  scene.fog = new Fog(0x89c6ec, 18, 58);

  const camera = new PerspectiveCamera(75, 1, 0.1, 120);
  camera.rotation.order = 'YXZ';

  const ambient = new AmbientLight(0xf4edd8, 1.7);
  const sun = new DirectionalLight(0xfff4d4, 2.1);
  sun.position.set(16, 20, 10);
  scene.add(ambient, sun);

  const storedWorld = parseWorldPersistence(
    window.localStorage.getItem(
      `minecraft-clone:world:v1:${DEFAULT_WORLD_CONFIG.seed}:${DEFAULT_WORLD_CONFIG.radius}`,
    ),
  );
  const world = new VoxelWorld(DEFAULT_WORLD_CONFIG, storedWorld);
  const worldGroup = new Group();
  scene.add(worldGroup);

  const blockGeometry = new BoxGeometry(1, 1, 1);
  const highlightGeometry = new EdgesGeometry(new BoxGeometry(1.02, 1.02, 1.02));
  const raycaster = new Raycaster();
  const center = new Vector2(0, 0);
  const materialCache = new Map<SolidBlockType, MeshLambertMaterial>();

  const getMaterial = (type: SolidBlockType): MeshLambertMaterial => {
    const cached = materialCache.get(type);

    if (cached) {
      return cached;
    }

    const material = new MeshLambertMaterial({
      color: BLOCK_DEFINITIONS[type].color,
    });
    materialCache.set(type, material);
    return material;
  };

  const targetOutline = new LineSegments(
    highlightGeometry,
    new LineBasicMaterial({ color: BLOCK_DEFINITIONS.highlight.color }),
  );
  targetOutline.visible = false;
  scene.add(targetOutline);

  const placementPreview = new Mesh(
    blockGeometry,
    new MeshLambertMaterial({
      color: BLOCK_DEFINITIONS.grass.color,
      transparent: true,
      opacity: 0.45,
    }),
  );
  placementPreview.visible = false;
  scene.add(placementPreview);

  let selectedBlock: SolidBlockType = 'grass';
  let locked = false;
  const touchDevice =
    'ontouchstart' in window || navigator.maxTouchPoints > 0;
  let currentTarget: CellTarget | null = null;
  let currentPlacement: { x: number; y: number; z: number } | null = null;
  let player = createPlayerState({ x: 0.5, y: 4.02, z: 0.5 });
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
      return;
    }

    window.localStorage.setItem(world.storageKey, JSON.stringify(snapshot));
  };

  const rebuildWorld = () => {
    worldGroup.clear();

    for (const block of world.toBlocks()) {
      const voxel = new Mesh(blockGeometry, getMaterial(block.type));
      voxel.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);
      voxel.userData.cell = block;
      worldGroup.add(voxel);
    }
  };

  const updateStatus = () => {
    const eyeY = player.position.y + DEFAULT_PLAYER_CONFIG.eyeHeight;
    const prompt = locked
      ? 'WASD move, Space jump, click to mine/build, 1-3 switch blocks, Esc unlock'
      : touchDevice
        ? 'Desktop controls use pointer lock. Mobile is view-only for this slice.'
        : 'Click the viewport to capture the mouse and enter the world.';
    const target = currentTarget
      ? `Break ${currentTarget.type} @ ${currentTarget.x}, ${currentTarget.y}, ${currentTarget.z}${
          currentPlacement
            ? ` | Place ${selectedBlock} @ ${currentPlacement.x}, ${currentPlacement.y}, ${currentPlacement.z}`
            : ''
        }`
      : 'Aim at a nearby block to mine or place.';

    onStatusChange({
      locked,
      selectedBlock,
      coords: `X ${formatCoords(player.position.x)} Y ${formatCoords(eyeY)} Z ${formatCoords(player.position.z)}`,
      target,
      prompt,
      touchDevice,
    });
  };

  const updateTargeting = () => {
    raycaster.setFromCamera(center, camera);
    const intersections = raycaster.intersectObjects(
      worldGroup.children,
      false,
    ) as Array<Intersection<Object3D>>;
    const hit = intersections.find(
      (entry) => entry.object instanceof Mesh && entry.object.userData.cell,
    );

    if (!hit || !(hit.object instanceof Mesh) || !hit.face) {
      currentTarget = null;
      currentPlacement = null;
      targetOutline.visible = false;
      placementPreview.visible = false;
      updateStatus();
      return;
    }

    const block = hit.object.userData.cell as CellTarget;
    currentTarget = block;
    targetOutline.visible = true;
    targetOutline.position.set(block.x + 0.5, block.y + 0.5, block.z + 0.5);

    const normal = hit.face.normal;
    const placement = {
      x: block.x + Math.round(normal.x),
      y: block.y + Math.round(normal.y),
      z: block.z + Math.round(normal.z),
    };
    const blockedByPlayer = playerIntersectsBlock(
      player.position,
      placement.x,
      placement.y,
      placement.z,
    );

    if (placement.y >= 0 && !world.hasBlock(placement.x, placement.y, placement.z) && !blockedByPlayer) {
      currentPlacement = placement;
      placementPreview.visible = true;
      placementPreview.position.set(
        placement.x + 0.5,
        placement.y + 0.5,
        placement.z + 0.5,
      );
      (
        placementPreview.material as MeshLambertMaterial
      ).color.setHex(BLOCK_DEFINITIONS[selectedBlock].color);
    } else {
      currentPlacement = null;
      placementPreview.visible = false;
    }

    updateStatus();
  };

  const tryInteract = (button: number) => {
    if (!locked || !currentTarget) {
      return;
    }

    if (button === 0) {
      world.removeBlock(currentTarget.x, currentTarget.y, currentTarget.z);
      persistWorld();
      rebuildWorld();
      updateTargeting();
      return;
    }

    if (button === 2 && currentPlacement) {
      if (world.placeBlock(currentPlacement.x, currentPlacement.y, currentPlacement.z, selectedBlock)) {
        persistWorld();
        rebuildWorld();
        updateTargeting();
      }
    }
  };

  const requestPointerLock = () => {
    if (!touchDevice && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
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
    player = withLook(
      player,
      player.yaw - event.movementX * lookSensitivity,
      player.pitch - event.movementY * lookSensitivity,
    );
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
    if (event.code === 'Space') {
      event.preventDefault();
    }

    if (event.code === 'Digit1') {
      selectedBlock = 'grass';
      updateTargeting();
      return;
    }

    if (event.code === 'Digit2') {
      selectedBlock = 'dirt';
      updateTargeting();
      return;
    }

    if (event.code === 'Digit3') {
      selectedBlock = 'stone';
      updateTargeting();
      return;
    }

    setInputFlag(event.code, true);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    setInputFlag(event.code, false);
  };

  const onMouseDown = (event: MouseEvent) => {
    if (event.button === 0 && !locked) {
      requestPointerLock();
      return;
    }

    if (event.button === 0 || event.button === 2) {
      event.preventDefault();
      tryInteract(event.button);
    }
  };

  const resetWorld = () => {
    world.reset();
    window.localStorage.removeItem(world.storageKey);
    player = createPlayerState({ x: 0.5, y: 4.02, z: 0.5 });
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
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  let frameId = 0;
  let previousTime = performance.now();

  const tick = (now: number) => {
    const delta = (now - previousTime) / 1000;
    previousTime = now;

    player = stepPlayer(
      player,
      input,
      delta,
      (x, y, z) => world.hasBlock(x, y, z),
    );

    camera.position.set(
      player.position.x,
      player.position.y + DEFAULT_PLAYER_CONFIG.eyeHeight,
      player.position.z,
    );
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;

    updateTargeting();
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(tick);
  };

  frameId = window.requestAnimationFrame(tick);

  return {
    canvas,
    renderer,
    setSelectedBlock: (type) => {
      selectedBlock = type;
      updateTargeting();
    },
    resetWorld,
    dispose: () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.dispose();
      blockGeometry.dispose();
      highlightGeometry.dispose();
      materialCache.forEach((material) => material.dispose());
      (
        placementPreview.material as MeshLambertMaterial
      ).dispose();
      (targetOutline.material as LineBasicMaterial).dispose();
      canvas.remove();
    },
  };
}
