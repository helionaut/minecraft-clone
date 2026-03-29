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

type MutableSkyBackdropLayerConfig = {
  radius: number;
  height: number;
  y: number;
  color: number;
  opacity: number;
};

type MutableSkyBackdropTheme = {
  backgroundColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  layers: MutableSkyBackdropLayerConfig[];
};

const DAY_SKY_THEME: SkyBackdropTheme = {
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

const NIGHT_SKY_THEME: SkyBackdropTheme = {
  backgroundColor: 0x233a5e,
  fogColor: 0x31486b,
  fogNear: 22,
  fogFar: 84,
  layers: [
    {
      radius: 86,
      height: 88,
      y: 34,
      color: 0x5b7aa7,
      opacity: 0.24,
    },
    {
      radius: 74,
      height: 42,
      y: 16,
      color: 0x4b678f,
      opacity: 0.14,
    },
    {
      radius: 62,
      height: 18,
      y: 10,
      color: 0x3a5379,
      opacity: 0.09,
    },
  ],
};

const HORIZON_TINT = 0xffa45e;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

function lerpColor(start: number, end: number, factor: number): number {
  const clampedFactor = clamp(factor, 0, 1);
  const startR = (start >> 16) & 0xff;
  const startG = (start >> 8) & 0xff;
  const startB = start & 0xff;
  const endR = (end >> 16) & 0xff;
  const endG = (end >> 8) & 0xff;
  const endB = end & 0xff;
  const red = Math.round(lerp(startR, endR, clampedFactor));
  const green = Math.round(lerp(startG, endG, clampedFactor));
  const blue = Math.round(lerp(startB, endB, clampedFactor));

  return (red << 16) | (green << 8) | blue;
}

export interface SkyBackdrop {
  readonly group: Group;
  readonly theme: SkyBackdropTheme;
  readonly update: (playerX: number, playerZ: number, daylight?: number, horizonGlow?: number) => void;
  readonly dispose: () => void;
}

export function getSkyBackdropTheme(daylight = 1, horizonGlow = 0): SkyBackdropTheme {
  const blend = clamp(daylight, 0, 1);
  const glow = clamp(horizonGlow, 0, 1);

  return {
    backgroundColor: lerpColor(
      lerpColor(NIGHT_SKY_THEME.backgroundColor, DAY_SKY_THEME.backgroundColor, blend),
      HORIZON_TINT,
      glow * (1 - blend) * 0.35,
    ),
    fogColor: lerpColor(
      lerpColor(NIGHT_SKY_THEME.fogColor, DAY_SKY_THEME.fogColor, blend),
      HORIZON_TINT,
      glow * 0.22,
    ),
    fogNear: lerp(NIGHT_SKY_THEME.fogNear, DAY_SKY_THEME.fogNear, blend),
    fogFar: lerp(NIGHT_SKY_THEME.fogFar, DAY_SKY_THEME.fogFar, blend),
    layers: DAY_SKY_THEME.layers.map((dayLayer, index) => {
      const nightLayer = NIGHT_SKY_THEME.layers[index] ?? dayLayer;

      return {
        radius: dayLayer.radius,
        height: dayLayer.height,
        y: dayLayer.y,
        color: lerpColor(
          lerpColor(nightLayer.color, dayLayer.color, blend),
          HORIZON_TINT,
          glow * 0.28,
        ),
        opacity: lerp(nightLayer.opacity, dayLayer.opacity, blend),
      };
    }),
  };
}

export function createSkyBackdrop(initialTheme = getSkyBackdropTheme()): SkyBackdrop {
  const group = new Group();
  const geometries: CylinderGeometry[] = [];
  const materials: MeshBasicMaterial[] = [];
  const theme: MutableSkyBackdropTheme = {
    backgroundColor: initialTheme.backgroundColor,
    fogColor: initialTheme.fogColor,
    fogNear: initialTheme.fogNear,
    fogFar: initialTheme.fogFar,
    layers: initialTheme.layers.map((layer) => ({ ...layer })),
  };

  for (const layer of theme.layers) {
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
    theme,
    update: (playerX: number, playerZ: number, daylight = 1, horizonGlow = 0) => {
      group.position.set(playerX, 0, playerZ);
      const nextTheme = getSkyBackdropTheme(daylight, horizonGlow);

      theme.backgroundColor = nextTheme.backgroundColor;
      theme.fogColor = nextTheme.fogColor;
      theme.fogNear = nextTheme.fogNear;
      theme.fogFar = nextTheme.fogFar;
      nextTheme.layers.forEach((layer, index) => {
        const themeLayer = theme.layers[index];
        const material = materials[index];

        if (!themeLayer || !material) {
          return;
        }

        themeLayer.color = layer.color;
        themeLayer.opacity = layer.opacity;
        material.color.setHex(layer.color);
        material.opacity = layer.opacity;
      });
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
