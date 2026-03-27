import {
  BackSide,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';

export interface SkyBackdropLayerConfig {
  readonly radius: number;
  readonly height: number;
  readonly y: number;
  readonly color: number;
  readonly opacity: number;
}

export interface SkyBackdropTheme {
  readonly backgroundColor: number;
  readonly fogColor: number;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly layers: readonly SkyBackdropLayerConfig[];
}

const DEFAULT_SKY_THEME: SkyBackdropTheme = {
  backgroundColor: 0xaed9ff,
  fogColor: 0xb9d8ef,
  fogNear: 28,
  fogFar: 96,
  layers: [
    {
      radius: 86,
      height: 88,
      y: 34,
      color: 0x90c8f8,
      opacity: 0.18,
    },
    {
      radius: 74,
      height: 42,
      y: 16,
      color: 0xd7ecff,
      opacity: 0.28,
    },
    {
      radius: 62,
      height: 18,
      y: 10,
      color: 0xf4fbff,
      opacity: 0.2,
    },
  ],
};

export interface SkyBackdrop {
  readonly group: Group;
  readonly theme: SkyBackdropTheme;
  readonly update: (playerX: number, playerZ: number) => void;
  readonly dispose: () => void;
}

export function getSkyBackdropTheme(): SkyBackdropTheme {
  return DEFAULT_SKY_THEME;
}

export function createSkyBackdrop(): SkyBackdrop {
  const group = new Group();
  const geometries: CylinderGeometry[] = [];
  const materials: MeshBasicMaterial[] = [];

  for (const layer of DEFAULT_SKY_THEME.layers) {
    const geometry = new CylinderGeometry(
      layer.radius,
      layer.radius,
      layer.height,
      32,
      1,
      true,
    );
    const material = new MeshBasicMaterial({
      color: layer.color,
      transparent: true,
      opacity: layer.opacity,
      side: BackSide,
      depthWrite: false,
      fog: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.y = layer.y;
    mesh.renderOrder = -10;
    group.add(mesh);
    geometries.push(geometry);
    materials.push(material);
  }

  return {
    group,
    theme: DEFAULT_SKY_THEME,
    update: (playerX: number, playerZ: number) => {
      group.position.set(playerX, 0, playerZ);
    },
    dispose: () => {
      group.clear();
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
    },
  };
}
