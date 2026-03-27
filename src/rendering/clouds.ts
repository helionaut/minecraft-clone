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
  readonly baseHeight: number;
  readonly density: number;
  readonly cellSize: number;
  readonly thickness: number;
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
  tileSize: 34,
  gridRadius: 5,
  driftSpeed: 0.55,
  baseHeight: 34,
  density: 0.38,
  cellSize: 2.4,
  thickness: 0.7,
};

const CLOUD_TEMPLATES = [
  [
    '..###....',
    '.######..',
    '########.',
    '.######..',
    '..###....',
  ],
  [
    '...####..',
    '.#######.',
    '#########',
    '.#######.',
    '..#####..',
  ],
  [
    '.#####...',
    '########.',
    '#########',
    '.#######.',
    '...####..',
  ],
  [
    '..#####..',
    '.#######.',
    '########.',
    '########.',
    '.######..',
  ],
  [
    '..####...',
    '.#######.',
    '#########',
    '.######..',
    '...###...',
  ],
] as const;

function fract(value: number): number {
  return value - Math.floor(value);
}

function hash(seed: number, x: number, y = 0, z = 0): number {
  const sample = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 53.3158) * 43758.5453123;
  return fract(sample);
}

function getCloudSegments(
  seed: number,
  cellX: number,
  cellZ: number,
  cellSize: number,
  thickness: number,
): CloudSegmentLayout[] {
  const template = CLOUD_TEMPLATES[
    Math.floor(hash(seed + 11, cellX, 1, cellZ) * CLOUD_TEMPLATES.length) % CLOUD_TEMPLATES.length
  ];
  const segments: CloudSegmentLayout[] = [];
  const rowCount = template.length;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = template[rowIndex]!;
    const columnCount = row.length;
    let columnIndex = 0;

    while (columnIndex < columnCount) {
      if (row[columnIndex] !== '#') {
        columnIndex += 1;
        continue;
      }

      let runEnd = columnIndex + 1;
      while (runEnd < columnCount && row[runEnd] === '#') {
        runEnd += 1;
      }

      const runLength = runEnd - columnIndex;
      segments.push({
        offsetX: ((columnIndex + runLength / 2) - columnCount / 2) * cellSize,
        offsetY: 0,
        offsetZ: ((rowIndex + 0.5) - rowCount / 2) * cellSize,
        scaleX: runLength * cellSize,
        scaleY: thickness,
        scaleZ: cellSize,
      });

      columnIndex = runEnd;
    }
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
      if (hash(settings.seed, cellX, 0, cellZ) > settings.density) {
        continue;
      }

      layouts.push({
        key: `${cellX},${cellZ}`,
        x: (cellX * settings.tileSize - driftX) + (hash(settings.seed + 89, cellX, 0, cellZ) - 0.5) * 6,
        y: settings.baseHeight,
        z: cellZ * settings.tileSize,
        segments: getCloudSegments(
          settings.seed,
          cellX,
          cellZ,
          settings.cellSize,
          settings.thickness,
        ),
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
    color: 0xfafcff,
    transparent: true,
    opacity: 0.94,
    emissive: 0xd8e4ee,
    emissiveIntensity: 0.18,
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
