import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';

interface CloudFieldOptions {
  readonly seed: number;
  readonly tileSize: number;
  readonly gridRadius: number;
  readonly driftSpeed: number;
}

export interface CloudSegmentLayout {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly offsetZ: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly scaleZ: number;
}

export interface CloudClusterLayout {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly segments: readonly CloudSegmentLayout[];
}

const DEFAULT_CLOUD_FIELD_OPTIONS: CloudFieldOptions = {
  seed: 1337,
  tileSize: 28,
  gridRadius: 5,
  driftSpeed: 1.1,
};

function fract(value: number): number {
  return value - Math.floor(value);
}

function hash(seed: number, x: number, y = 0, z = 0): number {
  const sample = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 53.3158) * 43758.5453123;
  return fract(sample);
}

function getCloudSegments(seed: number, cellX: number, cellZ: number): CloudSegmentLayout[] {
  const count = 4 + Math.floor(hash(seed + 11, cellX, 1, cellZ) * 3);
  const segments: CloudSegmentLayout[] = [];

  for (let index = 0; index < count; index += 1) {
    segments.push({
      offsetX: (hash(seed + 23, cellX, index, cellZ) - 0.5) * 12,
      offsetY: (hash(seed + 31, cellX, index, cellZ) - 0.5) * 1.1,
      offsetZ: (hash(seed + 41, cellX, index, cellZ) - 0.5) * 7,
      scaleX: 5.5 + hash(seed + 53, cellX, index, cellZ) * 6.5,
      scaleY: 0.9 + hash(seed + 61, cellX, index, cellZ) * 1.6,
      scaleZ: 3 + hash(seed + 71, cellX, index, cellZ) * 4.6,
    });
  }

  return segments;
}

export function buildCloudLayouts(
  playerX: number,
  playerZ: number,
  timeSeconds: number,
  options: Partial<CloudFieldOptions> = {},
): CloudClusterLayout[] {
  const settings = { ...DEFAULT_CLOUD_FIELD_OPTIONS, ...options };
  const driftX = timeSeconds * settings.driftSpeed;
  const anchorCellX = Math.floor((playerX + driftX) / settings.tileSize);
  const anchorCellZ = Math.floor(playerZ / settings.tileSize);
  const layouts: CloudClusterLayout[] = [];

  for (let offsetZ = -settings.gridRadius; offsetZ <= settings.gridRadius; offsetZ += 1) {
    for (let offsetX = -settings.gridRadius; offsetX <= settings.gridRadius; offsetX += 1) {
      const cellX = anchorCellX + offsetX;
      const cellZ = anchorCellZ + offsetZ;
      if (hash(settings.seed, cellX, 0, cellZ) < 0.18) {
        continue;
      }

      layouts.push({
        key: `${cellX},${cellZ}`,
        x: cellX * settings.tileSize - driftX,
        y: 26 + hash(settings.seed + 89, cellX, 0, cellZ) * 10,
        z: cellZ * settings.tileSize,
        segments: getCloudSegments(settings.seed, cellX, cellZ),
      });
    }
  }

  return layouts;
}

export interface CloudLayer {
  readonly group: Group;
  readonly update: (playerX: number, playerZ: number, timeSeconds: number) => void;
  readonly dispose: () => void;
}

export function createCloudLayer(seed: number): CloudLayer {
  const group = new Group();
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.92,
    roughness: 1,
    metalness: 0,
    depthWrite: false,
  });
  const clusters = new Map<string, Group>();

  const createCluster = (layout: CloudClusterLayout): Group => {
    const cluster = new Group();

    for (const segment of layout.segments) {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(segment.offsetX, segment.offsetY, segment.offsetZ);
      mesh.scale.set(segment.scaleX, segment.scaleY, segment.scaleZ);
      cluster.add(mesh);
    }

    return cluster;
  };

  const update = (playerX: number, playerZ: number, timeSeconds: number) => {
    const layouts = buildCloudLayouts(playerX, playerZ, timeSeconds, { seed });
    const activeKeys = new Set(layouts.map((layout) => layout.key));

    for (const layout of layouts) {
      let cluster = clusters.get(layout.key);
      if (!cluster) {
        cluster = createCluster(layout);
        clusters.set(layout.key, cluster);
        group.add(cluster);
      }

      cluster.position.set(layout.x, layout.y, layout.z);
    }

    for (const [key, cluster] of clusters) {
      if (activeKeys.has(key)) {
        continue;
      }

      group.remove(cluster);
      clusters.delete(key);
    }
  };

  return {
    group,
    update,
    dispose: () => {
      group.clear();
      clusters.clear();
      geometry.dispose();
      material.dispose();
    },
  };
}
