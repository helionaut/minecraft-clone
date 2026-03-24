import {
  CanvasTexture,
  Color,
  MeshStandardMaterial,
  NearestFilter,
  SRGBColorSpace,
  type Material,
} from 'three';

import { BLOCK_DEFINITIONS, type WorldBlockType } from '../gameplay/blocks.ts';

type TextureFace = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

const FACE_ORDER: readonly TextureFace[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

function createSeed(textureId: string, x: number, y: number): number {
  const textWeight = [...textureId].reduce(
    (sum, char, index) => sum + char.charCodeAt(0) * (index + 3),
    0,
  );

  return ((x * 73856093) ^ (y * 19349663) ^ textWeight) >>> 0;
}

function varyColor(hex: number, variance: number, seed: number): string {
  const color = new Color(hex);
  const offset = ((seed % 1000) / 999 - 0.5) * variance;
  color.offsetHSL(0, 0, offset);
  return `#${color.getHexString()}`;
}

function fillNoise(
  context: CanvasRenderingContext2D,
  size: number,
  baseHex: number,
  variance: number,
  textureId: string,
): void {
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      context.fillStyle = varyColor(baseHex, variance, createSeed(textureId, x, y));
      context.fillRect(x, y, 1, 1);
    }
  }
}

function drawWaterOverlay(context: CanvasRenderingContext2D, size: number): void {
  context.fillStyle = 'rgba(255, 255, 255, 0.2)';

  for (let y = 3; y < size; y += 6) {
    for (let x = (y / 3) % 2 === 0 ? 0 : 2; x < size; x += 5) {
      context.fillRect(x, y, 2, 1);
    }
  }
}

function drawLavaOverlay(context: CanvasRenderingContext2D, size: number): void {
  context.fillStyle = 'rgba(255, 211, 120, 0.55)';

  for (let y = 0; y < size; y += 4) {
    const width = Math.max(1, (y / 4) % 3);
    context.fillRect(0, y, size, 1);
    context.fillRect((y * 3) % size, Math.max(0, y - 1), width, 2);
  }
}

function drawGrassSide(context: CanvasRenderingContext2D, size: number): void {
  fillNoise(context, size, 0x7a5536, 0.16, 'dirt-side');

  for (let y = 0; y < 9; y += 1) {
    const lineTone = y < 5 ? 0x7ec850 : 0x5d9738;

    for (let x = 0; x < size; x += 1) {
      context.fillStyle = varyColor(lineTone, 0.1, createSeed('grass-side-band', x, y));
      context.fillRect(x, y, 1, 1);
    }
  }
}

function drawSnowSide(context: CanvasRenderingContext2D, size: number): void {
  fillNoise(context, size, 0x7a5536, 0.16, 'snow-dirt');

  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < size; x += 1) {
      context.fillStyle = varyColor(0xf4f7fb, 0.06, createSeed('snow-cap', x, y));
      context.fillRect(x, y, 1, 1);
    }
  }
}

function drawSandstoneSide(context: CanvasRenderingContext2D, size: number): void {
  fillNoise(context, size, 0xc9aa68, 0.12, 'sandstone-side');
  context.fillStyle = 'rgba(133, 94, 47, 0.18)';

  for (let y = 3; y < size; y += 6) {
    context.fillRect(0, y, size, 1);
  }
}

function drawSandstoneTop(context: CanvasRenderingContext2D, size: number): void {
  fillNoise(context, size, 0xd8bf85, 0.08, 'sandstone-top');
  context.strokeStyle = 'rgba(155, 121, 73, 0.28)';
  context.lineWidth = 2;
  context.strokeRect(4, 4, size - 8, size - 8);
}

function drawOakLogSide(context: CanvasRenderingContext2D, size: number): void {
  fillNoise(context, size, 0x8a633d, 0.14, 'oak-log-side');
  context.fillStyle = 'rgba(68, 42, 18, 0.24)';

  for (let x = 4; x < size; x += 7) {
    context.fillRect(x, 0, 2, size);
  }
}

function drawOakLogTop(context: CanvasRenderingContext2D, size: number): void {
  fillNoise(context, size, 0xc89c68, 0.1, 'oak-log-top');
  context.strokeStyle = 'rgba(110, 68, 29, 0.4)';
  context.lineWidth = 2;
  context.strokeRect(5, 5, size - 10, size - 10);
  context.strokeRect(11, 11, size - 22, size - 22);
}

function drawLeaves(context: CanvasRenderingContext2D, size: number): void {
  fillNoise(context, size, 0x5b9240, 0.18, 'oak-leaves');
  context.fillStyle = 'rgba(132, 188, 85, 0.22)';

  for (let y = 2; y < size; y += 5) {
    for (let x = (y / 5) % 2 === 0 ? 1 : 3; x < size; x += 6) {
      context.fillRect(x, y, 2, 2);
    }
  }
}

function drawCactusSide(context: CanvasRenderingContext2D, size: number): void {
  fillNoise(context, size, 0x4b8d39, 0.14, 'cactus-side');
  context.fillStyle = 'rgba(210, 240, 160, 0.16)';

  for (let x = 2; x < size; x += 6) {
    context.fillRect(x, 0, 1, size);
  }
}

function drawCactusCap(context: CanvasRenderingContext2D, size: number): void {
  fillNoise(context, size, 0x79b85e, 0.1, 'cactus-cap');
  context.strokeStyle = 'rgba(49, 91, 37, 0.34)';
  context.lineWidth = 2;
  context.strokeRect(4, 4, size - 8, size - 8);
}

function drawTextureTile(textureId: string, baseColor: number): HTMLCanvasElement {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error(`Unable to create texture canvas for ${textureId}.`);
  }

  switch (textureId) {
    case 'grass-top':
      fillNoise(context, size, 0x6fbf4b, 0.18, textureId);
      break;
    case 'grass-side':
      drawGrassSide(context, size);
      break;
    case 'stone':
      fillNoise(context, size, 0x8f98a3, 0.22, textureId);
      break;
    case 'dirt':
      fillNoise(context, size, 0x7a5536, 0.18, textureId);
      break;
    case 'sand':
      fillNoise(context, size, 0xd9c27f, 0.12, textureId);
      break;
    case 'sandstone-side':
      drawSandstoneSide(context, size);
      break;
    case 'sandstone-top':
    case 'sandstone-bottom':
      drawSandstoneTop(context, size);
      break;
    case 'snow-top':
      fillNoise(context, size, 0xf4f7fb, 0.06, textureId);
      break;
    case 'snow-side':
      drawSnowSide(context, size);
      break;
    case 'oak-log-side':
      drawOakLogSide(context, size);
      break;
    case 'oak-log-top':
      drawOakLogTop(context, size);
      break;
    case 'oak-leaves':
      drawLeaves(context, size);
      break;
    case 'cactus-side':
      drawCactusSide(context, size);
      break;
    case 'cactus-top':
    case 'cactus-bottom':
      drawCactusCap(context, size);
      break;
    case 'water':
      fillNoise(context, size, 0x4f8fdb, 0.12, textureId);
      drawWaterOverlay(context, size);
      break;
    case 'lava':
      fillNoise(context, size, 0xd64b18, 0.2, textureId);
      drawLavaOverlay(context, size);
      break;
    default:
      fillNoise(context, size, baseColor, 0.15, textureId);
      break;
  }

  return canvas;
}

function getFaceTextureId(type: WorldBlockType, face: TextureFace): string {
  const texture = BLOCK_DEFINITIONS[type].texture;

  if (face === 'py') {
    return texture.top ?? texture.all ?? type;
  }

  if (face === 'ny') {
    return texture.bottom ?? texture.all ?? type;
  }

  return texture.side ?? texture.all ?? type;
}

export function createBlockMaterialFactory(): {
  getMaterials: (type: WorldBlockType, brightness: number) => Material[];
  dispose: () => void;
} {
  const textureCache = new Map<string, CanvasTexture>();
  const materialCache = new Map<string, MeshStandardMaterial[]>();

  const getTexture = (type: WorldBlockType, face: TextureFace): CanvasTexture => {
    const textureId = getFaceTextureId(type, face);
    const cacheKey = `${type}:${textureId}`;
    const cached = textureCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const texture = new CanvasTexture(
      drawTextureTile(textureId, BLOCK_DEFINITIONS[type].color),
    );
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = SRGBColorSpace;
    textureCache.set(cacheKey, texture);
    return texture;
  };

  return {
    getMaterials: (type, brightness) => {
      const lightBucket = Math.max(2, Math.min(15, Math.round(brightness * 15)));
      const cacheKey = `${type}:${lightBucket}`;
      const cached = materialCache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const tint = new Color().setRGB(brightness, brightness, brightness);
      const definition = BLOCK_DEFINITIONS[type];
      const materials = FACE_ORDER.map((face) => new MeshStandardMaterial({
        map: getTexture(type, face),
        color: tint,
        transparent: !definition.opaque,
        opacity: type === 'water' ? 0.74 : type === 'lava' ? 0.92 : 1,
        emissive: type === 'lava' ? new Color(0xff8844) : new Color(0x000000),
        emissiveIntensity: type === 'lava' ? 0.75 : 0,
        roughness: type === 'water' ? 0.18 : 0.92,
        metalness: type === 'water' ? 0.02 : 0,
        depthWrite: definition.opaque,
      }));
      materialCache.set(cacheKey, materials);
      return materials;
    },
    dispose: () => {
      textureCache.forEach((texture) => texture.dispose());
      materialCache.forEach((materials) => {
        materials.forEach((material) => material.dispose());
      });
    },
  };
}
