export interface Vector3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MutableVector3Like {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  readonly position: Vector3Like;
  readonly velocity: Vector3Like;
  readonly yaw: number;
  readonly pitch: number;
  readonly grounded: boolean;
  readonly inFluid: boolean;
  readonly headInFluid: boolean;
}

export interface InputState {
  readonly forward: boolean;
  readonly backward: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly jump: boolean;
}

export interface PlayerConfig {
  readonly radius: number;
  readonly height: number;
  readonly eyeHeight: number;
  readonly moveSpeed: number;
  readonly jumpSpeed: number;
  readonly gravity: number;
}

export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  radius: 0.34,
  height: 1.8,
  eyeHeight: 1.62,
  moveSpeed: 5.4,
  jumpSpeed: 6.8,
  gravity: 20,
};

export type SolidBlockLookup = (x: number, y: number, z: number) => boolean;
export type FluidBlockLookup = (x: number, y: number, z: number) => boolean;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hasCollision(
  position: Vector3Like,
  config: PlayerConfig,
  isSolidBlock: SolidBlockLookup,
): boolean {
  const minX = Math.floor(position.x - config.radius);
  const maxX = Math.floor(position.x + config.radius - 1e-6);
  const minY = Math.floor(position.y);
  const maxY = Math.floor(position.y + config.height - 1e-6);
  const minZ = Math.floor(position.z - config.radius);
  const maxZ = Math.floor(position.z + config.radius - 1e-6);

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        if (isSolidBlock(x, y, z)) {
          return true;
        }
      }
    }
  }

  return false;
}

export function playerIntersectsBlock(
  position: Vector3Like,
  x: number,
  y: number,
  z: number,
  config: PlayerConfig = DEFAULT_PLAYER_CONFIG,
): boolean {
  const playerMinX = position.x - config.radius;
  const playerMaxX = position.x + config.radius;
  const playerMinY = position.y;
  const playerMaxY = position.y + config.height;
  const playerMinZ = position.z - config.radius;
  const playerMaxZ = position.z + config.radius;

  return (
    playerMinX < x + 1 &&
    playerMaxX > x &&
    playerMinY < y + 1 &&
    playerMaxY > y &&
    playerMinZ < z + 1 &&
    playerMaxZ > z
  );
}

function moveAxis(
  position: Vector3Like,
  axis: 'x' | 'y' | 'z',
  delta: number,
  config: PlayerConfig,
  isSolidBlock: SolidBlockLookup,
): { readonly position: Vector3Like; readonly collided: boolean } {
  if (delta === 0) {
    return { position, collided: false };
  }

  const target = { ...position, [axis]: position[axis] + delta } as Vector3Like;

  if (!hasCollision(target, config, isSolidBlock)) {
    return { position: target, collided: false };
  }

  let lower = 0;
  let upper = 1;
  let best = position[axis];

  for (let step = 0; step < 8; step += 1) {
    const factor = (lower + upper) / 2;
    const candidate = {
      ...position,
      [axis]: position[axis] + delta * factor,
    } as Vector3Like;

    if (hasCollision(candidate, config, isSolidBlock)) {
      upper = factor;
      continue;
    }

    lower = factor;
    best = candidate[axis];
  }

  return {
    position: { ...position, [axis]: best } as Vector3Like,
    collided: true,
  };
}

export function createPlayerState(spawn: Vector3Like): PlayerState {
  return {
    position: spawn,
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0.12,
    grounded: false,
    inFluid: false,
    headInFluid: false,
  };
}

export function withLook(
  state: PlayerState,
  yaw: number,
  pitch: number,
): PlayerState {
  return {
    ...state,
    yaw,
    pitch: clamp(pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01),
  };
}

function intersectsBlockRange(
  position: Vector3Like,
  config: PlayerConfig,
  isMatch: FluidBlockLookup,
  minYOffset: number,
  maxYOffset: number,
): boolean {
  const minX = Math.floor(position.x - config.radius);
  const maxX = Math.floor(position.x + config.radius - 1e-6);
  const minY = Math.floor(position.y + minYOffset);
  const maxY = Math.floor(position.y + maxYOffset - 1e-6);
  const minZ = Math.floor(position.z - config.radius);
  const maxZ = Math.floor(position.z + config.radius - 1e-6);

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        if (isMatch(x, y, z)) {
          return true;
        }
      }
    }
  }

  return false;
}

function getFluidState(
  position: Vector3Like,
  config: PlayerConfig,
  isFluidBlock: FluidBlockLookup | undefined,
): { readonly inFluid: boolean; readonly headInFluid: boolean } {
  if (!isFluidBlock) {
    return { inFluid: false, headInFluid: false };
  }

  const inFluid = intersectsBlockRange(
    position,
    config,
    isFluidBlock,
    0.05,
    Math.min(config.height * 0.72, 1.28),
  );
  const headInFluid = intersectsBlockRange(
    position,
    config,
    isFluidBlock,
    config.eyeHeight - 0.12,
    config.height,
  );

  return { inFluid, headInFluid };
}

export function stepPlayer(
  state: PlayerState,
  input: InputState,
  deltaTime: number,
  isSolidBlock: SolidBlockLookup,
  config: PlayerConfig = DEFAULT_PLAYER_CONFIG,
  isFluidBlock?: FluidBlockLookup,
): PlayerState {
  const delta = Math.min(deltaTime, 0.05);
  const fluidState = getFluidState(state.position, config, isFluidBlock);
  const localX =
    Number(input.right) -
    Number(input.left);
  const localZ =
    Number(input.backward) -
    Number(input.forward);
  const movementLength = Math.hypot(localX, localZ) || 1;
  const moveX = localX / movementLength;
  const moveZ = localZ / movementLength;
  const sinYaw = Math.sin(state.yaw);
  const cosYaw = Math.cos(state.yaw);
  const worldX = moveX * cosYaw + moveZ * sinYaw;
  const worldZ = moveZ * cosYaw - moveX * sinYaw;
  const moveSpeed = fluidState.inFluid
    ? config.moveSpeed * (fluidState.headInFluid ? 0.42 : 0.58)
    : config.moveSpeed;
  const gravity = fluidState.inFluid
    ? config.gravity * (fluidState.headInFluid ? 0.18 : 0.34)
    : config.gravity;
  const nextVelocity: MutableVector3Like = {
    x: worldX * moveSpeed,
    y: state.velocity.y - gravity * delta,
    z: worldZ * moveSpeed,
  };

  if (fluidState.inFluid) {
    nextVelocity.y *= fluidState.headInFluid ? 0.84 : 0.9;

    if (input.jump) {
      nextVelocity.y = Math.max(
        nextVelocity.y,
        fluidState.headInFluid ? 3.2 : 2.6,
      );
    } else {
      nextVelocity.y = Math.max(nextVelocity.y, fluidState.headInFluid ? -1.6 : -2.3);
    }
  } else if (state.grounded && input.jump) {
    nextVelocity.y = config.jumpSpeed;
  }

  let position = state.position;
  let grounded = false;

  const horizontalX = moveAxis(
    position,
    'x',
    nextVelocity.x * delta,
    config,
    isSolidBlock,
  );
  position = horizontalX.position;
  if (horizontalX.collided) {
    nextVelocity.x = 0;
  }

  const horizontalZ = moveAxis(
    position,
    'z',
    nextVelocity.z * delta,
    config,
    isSolidBlock,
  );
  position = horizontalZ.position;
  if (horizontalZ.collided) {
    nextVelocity.z = 0;
  }

  const vertical = moveAxis(
    position,
    'y',
    nextVelocity.y * delta,
    config,
    isSolidBlock,
  );
  position = vertical.position;
  if (vertical.collided) {
    grounded = nextVelocity.y <= 0;
    nextVelocity.y = 0;
  }

  return {
    ...state,
    position,
    velocity: nextVelocity,
    grounded,
    inFluid: fluidState.inFluid,
    headInFluid: fluidState.headInFluid,
  };
}
