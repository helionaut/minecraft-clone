import {
  AdditiveBlending,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';

export interface Vector3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface GodRayBeamLayout {
  readonly width: number;
  readonly length: number;
  readonly offset: number;
  readonly elevation: number;
  readonly depth: number;
  readonly opacity: number;
}

export interface GodRayState {
  readonly anchorPosition: Vector3Like;
  readonly direction: Vector3Like;
  readonly visibility: number;
}

const UP = new Vector3(0, 1, 0);
const GOD_RAY_BEAMS: readonly GodRayBeamLayout[] = [
  { width: 6.8, length: 34, offset: -8.2, elevation: 2.1, depth: -7.5, opacity: 0.62 },
  { width: 5.6, length: 29, offset: -3.8, elevation: -0.6, depth: -2.4, opacity: 0.54 },
  { width: 7.4, length: 38, offset: 0.8, elevation: 2.8, depth: 3.2, opacity: 0.68 },
  { width: 4.8, length: 27, offset: 5.1, elevation: -1.9, depth: 7.1, opacity: 0.48 },
  { width: 6.1, length: 31, offset: 9.3, elevation: 1.5, depth: 11.2, opacity: 0.56 },
  { width: 4.2, length: 22, offset: 12.4, elevation: -2.8, depth: 15.1, opacity: 0.42 },
] as const;
const BEAM_COLOR = 0xf4bf56;
const HALO_COLOR = 0xfff4cb;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toNormalizedVector(source: Vector3Like): Vector3 {
  const vector = new Vector3(source.x, source.y, source.z);
  if (vector.lengthSq() === 0) {
    return vector.set(0, 0, 1);
  }

  return vector.normalize();
}

export function getGodRayBeamLayouts(): readonly GodRayBeamLayout[] {
  return GOD_RAY_BEAMS;
}

export function computeGodRayVisibility(
  cameraPosition: Vector3Like,
  cameraDirection: Vector3Like,
  sunPosition: Vector3Like,
): number {
  const toSun = new Vector3(
    sunPosition.x - cameraPosition.x,
    sunPosition.y - cameraPosition.y,
    sunPosition.z - cameraPosition.z,
  );
  if (toSun.lengthSq() === 0) {
    return 0;
  }

  const sunDirection = toSun.normalize();
  const viewDirection = toNormalizedVector(cameraDirection);
  const alignment = clamp((viewDirection.dot(sunDirection) + 0.05) / 1.05, 0, 1);
  const horizon = clamp((sunDirection.y - 0.02) / 0.78, 0, 1);

  return clamp(Math.pow(alignment, 1.6) * Math.pow(horizon, 0.45), 0, 1);
}

export function getGodRayState(source: {
  readonly playerPosition: Vector3Like;
  readonly cameraPosition: Vector3Like;
  readonly cameraDirection: Vector3Like;
  readonly sunPosition: Vector3Like;
  readonly targetPosition: Vector3Like;
}): GodRayState {
  const sunVector = new Vector3(
    source.sunPosition.x - source.targetPosition.x,
    source.sunPosition.y - source.targetPosition.y,
    source.sunPosition.z - source.targetPosition.z,
  ).normalize();
  const cameraToSun = new Vector3(
    source.sunPosition.x - source.cameraPosition.x,
    source.sunPosition.y - source.cameraPosition.y,
    source.sunPosition.z - source.cameraPosition.z,
  );
  const anchorDistance = clamp(cameraToSun.length() * 0.52, 16, 28);
  const anchor = new Vector3(
    source.cameraPosition.x,
    source.cameraPosition.y,
    source.cameraPosition.z,
  ).addScaledVector(cameraToSun.normalize(), anchorDistance);
  anchor.y = clamp(anchor.y, source.playerPosition.y + 8, source.sunPosition.y - 3);

  return {
    anchorPosition: {
      x: anchor.x,
      y: anchor.y,
      z: anchor.z,
    },
    direction: {
      x: sunVector.x,
      y: sunVector.y,
      z: sunVector.z,
    },
    visibility: computeGodRayVisibility(
      source.cameraPosition,
      source.cameraDirection,
      source.sunPosition,
    ),
  };
}

function createBeamTexture(): DataTexture {
  const width = 64;
  const height = 64;
  const pixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const horizontal = Math.abs((x / (width - 1)) * 2 - 1);
      const vertical = Math.abs((y / (height - 1)) * 2 - 1);
      const core = Math.pow(clamp(1 - horizontal, 0, 1), 2.2);
      const taper = Math.pow(clamp(1 - vertical, 0, 1), 1.35);
      const softness = clamp((1 - horizontal * 0.78) * (1 - vertical * 0.22), 0, 1);
      const alpha = Math.round(clamp(core * taper * softness, 0, 1) * 255);
      const index = (y * width + x) * 4;
      pixels[index] = 255;
      pixels[index + 1] = 248;
      pixels[index + 2] = 225;
      pixels[index + 3] = alpha;
    }
  }

  const texture = new DataTexture(pixels, width, height);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return texture;
}

function createHaloGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  const radius = 1;
  const positions = new Float32Array([
    -radius, -radius, 0,
    radius, -radius, 0,
    radius, radius, 0,
    -radius, radius, 0,
  ]);
  const uvs = new Float32Array([
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ]);
  const indices = [0, 1, 2, 0, 2, 3];

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  return geometry;
}

export interface GodRaysEffect {
  readonly group: Group;
  readonly update: (source: {
    readonly playerPosition: Vector3Like;
    readonly cameraPosition: Vector3Like;
    readonly cameraDirection: Vector3Like;
    readonly sunPosition: Vector3Like;
    readonly targetPosition: Vector3Like;
    readonly elapsedSeconds: number;
  }) => void;
  readonly dispose: () => void;
}

export function createGodRaysEffect(): GodRaysEffect {
  const group = new Group();
  const texture = createBeamTexture();
  const beamGeometry = new PlaneGeometry(1, 1, 1, 1);
  const beamMaterial = new MeshBasicMaterial({
    color: BEAM_COLOR,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    blending: NormalBlending,
    side: DoubleSide,
    map: texture,
    fog: false,
  });
  const haloGeometry = createHaloGeometry();
  const haloMaterial = new MeshBasicMaterial({
    color: HALO_COLOR,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    map: texture,
    fog: false,
  });
  const beams = GOD_RAY_BEAMS.map((layout) => {
    const mesh = new Mesh(beamGeometry, beamMaterial.clone());
    mesh.renderOrder = 2;
    group.add(mesh);
    return { layout, mesh };
  });
  const halo = new Mesh(haloGeometry, haloMaterial);
  halo.renderOrder = 3;
  group.add(halo);
  const cameraPosition = new Vector3();
  const mainDirection = new Vector3();
  const lookTarget = new Vector3();
  const haloScale = new Vector3();
  const beamOrientation = new Quaternion();
  const viewDirection = new Vector3();
  const renderDirection = new Vector3();
  return {
    group,
    update: (source) => {
      cameraPosition.set(
        source.cameraPosition.x,
        source.cameraPosition.y,
        source.cameraPosition.z,
      );
      const state = getGodRayState(source);
      mainDirection.set(state.direction.x, state.direction.y, state.direction.z);
      viewDirection.copy(toNormalizedVector(source.cameraDirection));
      renderDirection.copy(mainDirection).addScaledVector(viewDirection, 0.85).normalize();
      group.position.copy(cameraPosition)
        .addScaledVector(viewDirection, 24)
        .addScaledVector(UP, 6);
      beamOrientation.setFromUnitVectors(UP, renderDirection);
      group.quaternion.copy(beamOrientation);
      lookTarget.copy(cameraPosition);
      const pulse = 1 + Math.sin(source.elapsedSeconds * 0.9) * 0.06;
      const runtimeVisibility = Math.max(state.visibility, 0.45);

      for (const [index, { layout, mesh }] of beams.entries()) {
        const material = mesh.material as MeshBasicMaterial;
        mesh.position.set(layout.offset, layout.depth, layout.elevation);
        mesh.rotation.set(0, (index % 3) * (Math.PI / 3), 0);
        mesh.scale.set(layout.width, layout.length, 1);
        material.opacity = layout.opacity * runtimeVisibility * pulse;
      }

      halo.position.copy(group.position).addScaledVector(renderDirection, 18);
      halo.lookAt(lookTarget);
      haloScale.setScalar(MathUtils.lerp(12, 18, runtimeVisibility));
      halo.scale.copy(haloScale);
      haloMaterial.opacity = MathUtils.lerp(0.08, 0.4, runtimeVisibility);

      group.visible = runtimeVisibility > 0.01;
    },
    dispose: () => {
      group.clear();
      beamGeometry.dispose();
      beamMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      texture.dispose();
      for (const { mesh } of beams) {
        (mesh.material as MeshBasicMaterial).dispose();
      }
    },
  };
}
