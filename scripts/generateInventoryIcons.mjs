#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(repoRoot, 'public/textures/inventory');

function rect(x, y, width, height, fill, extra = '') {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"${extra} />`;
}

function path(d, fill, extra = '') {
  return `<path d="${d}" fill="${fill}"${extra} />`;
}

function svg(content) {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">',
    content,
    '</svg>',
    '',
  ].join('\n');
}

function blockBase(colors) {
  return [
    rect(1, 1, 14, 14, colors.base),
    rect(1, 1, 14, 2, colors.highlight),
    rect(1, 13, 14, 2, colors.shadow),
    rect(1, 1, 2, 14, colors.left),
    rect(13, 1, 2, 14, colors.right),
  ].join('');
}

function speckles(points, fill) {
  return points.map(([x, y, w = 2, h = 2]) => rect(x, y, w, h, fill)).join('');
}

function oreBlock(base, fleck) {
  return svg(
    [
      blockBase(base),
      speckles(
        [
          [3, 4],
          [8, 3],
          [5, 8],
          [10, 7],
          [4, 11],
          [9, 11],
        ],
        fleck,
      ),
    ].join(''),
  );
}

function ingot(top, bottom) {
  return svg(
    [
      rect(4, 5, 8, 6, top),
      rect(3, 6, 10, 4, top),
      rect(5, 4, 6, 1, '#ffffff99'),
      rect(4, 10, 8, 1, bottom),
      rect(5, 11, 6, 1, bottom),
    ].join(''),
  );
}

function gem(top, middle, bottom) {
  return svg(
    [
      path('M8 2 13 6 8 14 3 6Z', middle),
      path('M8 2 11 6 8 10 5 6Z', top),
      path('M5 6 8 10 8 14 3 6Z', bottom),
      path('M11 6 13 6 8 14 8 10Z', '#36a8c6'),
      rect(7, 4, 2, 1, '#ffffffaa'),
    ].join(''),
  );
}

function stickIcon() {
  return svg(
    [
      path('M5 12 7 12 12 4 10 4Z', '#7a5432'),
      path('M6 12 7 12 12 4 11 4Z', '#d6aa72'),
    ].join(''),
  );
}

function sword(blade, guard, grip) {
  return svg(
    [
      path('M9 2 12 5 8 9 7 8Z', blade),
      path('M6 9 10 9 10 10 6 10Z', guard),
      path('M7 10 9 10 11 14 9 14Z', grip),
      rect(7, 12, 2, 1, '#f3dfb1'),
    ].join(''),
  );
}

function pickaxe(head, handle) {
  return svg(
    [
      path('M3 4 10 2 13 5 12 6 9 5 6 6 4 7 2 6Z', head),
      path('M8 5 10 5 6 14 4 14Z', handle),
      rect(5, 11, 2, 1, '#f3dfb1'),
    ].join(''),
  );
}

const icons = {
  grass: () =>
    svg(
      [
        rect(1, 2, 14, 4, '#6ec54f'),
        rect(1, 6, 14, 8, '#8d5a34'),
        rect(1, 4, 14, 2, '#4c9b3a'),
        rect(3, 6, 2, 2, '#6ec54f'),
        rect(8, 6, 2, 1, '#6ec54f'),
        rect(11, 6, 2, 2, '#6ec54f'),
        rect(4, 10, 2, 2, '#a56d43'),
        rect(9, 9, 3, 2, '#744826'),
      ].join(''),
    ),
  dirt: () =>
    svg(
      [
        blockBase({
          base: '#8a5a36',
          highlight: '#b57b4d',
          shadow: '#5d371f',
          left: '#734726',
          right: '#a56b43',
        }),
        speckles(
          [
            [4, 5, 1, 1],
            [8, 4, 1, 1],
            [11, 7, 1, 1],
            [5, 10, 1, 1],
          ],
          '#684028',
        ),
      ].join(''),
    ),
  stone: () =>
    svg(
      [
        blockBase({
          base: '#8f98a3',
          highlight: '#b8c0ca',
          shadow: '#646c76',
          left: '#79828d',
          right: '#a7b0ba',
        }),
        speckles(
          [
            [3, 4, 2, 1],
            [8, 5, 1, 2],
            [11, 4, 2, 1],
            [5, 9, 2, 1],
            [9, 11, 2, 1],
          ],
          '#727b85',
        ),
      ].join(''),
    ),
  cobblestone: () =>
    svg(
      [
        blockBase({
          base: '#7e848d',
          highlight: '#a7afb8',
          shadow: '#596069',
          left: '#666d76',
          right: '#939aa4',
        }),
        rect(3, 3, 4, 3, '#9099a3'),
        rect(8, 3, 4, 2, '#69707a'),
        rect(10, 6, 3, 3, '#8b949e'),
        rect(4, 7, 4, 3, '#666d76'),
        rect(2, 10, 4, 2, '#959ea8'),
        rect(8, 10, 5, 3, '#737b85'),
      ].join(''),
    ),
  sand: () =>
    svg(
      [
        blockBase({
          base: '#dfca86',
          highlight: '#f4e3a9',
          shadow: '#b59a56',
          left: '#ccb169',
          right: '#edd99a',
        }),
        speckles(
          [
            [4, 5, 1, 1],
            [7, 7, 1, 1],
            [11, 5, 1, 1],
            [5, 10, 1, 1],
            [9, 11, 1, 1],
          ],
          '#c1a861',
        ),
      ].join(''),
    ),
  sandstone: () =>
    svg(
      [
        blockBase({
          base: '#cfaf6d',
          highlight: '#e7cc8b',
          shadow: '#a17f42',
          left: '#ba9857',
          right: '#dcbd7c',
        }),
        rect(3, 4, 10, 1, '#e6cd90'),
        rect(3, 7, 10, 1, '#b08a4b'),
        rect(3, 10, 10, 1, '#dcc082'),
      ].join(''),
    ),
  gravel: () =>
    svg(
      [
        blockBase({
          base: '#8b8985',
          highlight: '#b4b1ac',
          shadow: '#615e59',
          left: '#74706b',
          right: '#a19d98',
        }),
        speckles(
          [
            [3, 4],
            [7, 5],
            [11, 4],
            [5, 8],
            [9, 8],
            [4, 11],
            [10, 11],
          ],
          '#6e6a65',
        ),
      ].join(''),
    ),
  snow: () =>
    svg(
      [
        rect(1, 2, 14, 4, '#f7fbff'),
        rect(1, 6, 14, 8, '#8a5a36'),
        rect(1, 4, 14, 2, '#dce8f2'),
        rect(2, 7, 12, 1, '#a46c42'),
        rect(3, 6, 2, 1, '#ffffff'),
        rect(9, 6, 3, 1, '#ffffff'),
      ].join(''),
    ),
  'oak-log': () =>
    svg(
      [
        rect(2, 2, 12, 12, '#8b6037'),
        rect(4, 4, 8, 8, '#d6a772'),
        rect(5, 5, 6, 6, '#bb8453'),
        rect(6, 6, 4, 4, '#d9bb8d'),
        rect(2, 3, 12, 1, '#6d4527'),
        rect(2, 12, 12, 1, '#6d4527'),
      ].join(''),
    ),
  'oak-planks': () =>
    svg(
      [
        blockBase({
          base: '#bf9358',
          highlight: '#ddb379',
          shadow: '#93663a',
          left: '#a97a4a',
          right: '#d2a86e',
        }),
        rect(3, 5, 10, 1, '#92673c'),
        rect(3, 8, 10, 1, '#c99a61'),
        rect(3, 11, 10, 1, '#8c6037'),
      ].join(''),
    ),
  'oak-leaves': () =>
    svg(
      [
        rect(2, 2, 12, 12, '#4f8a3d'),
        rect(4, 3, 8, 10, '#69a953', ' opacity="0.82"'),
        speckles(
          [
            [3, 5, 2, 2],
            [9, 4, 2, 2],
            [6, 8, 2, 2],
            [10, 10, 1, 1],
          ],
          '#9ccf7a',
        ),
      ].join(''),
    ),
  cactus: () =>
    svg(
      [
        rect(4, 1, 8, 14, '#4f9a40'),
        rect(5, 1, 1, 14, '#74bf63'),
        rect(9, 1, 1, 14, '#35722e'),
        rect(5, 3, 1, 1, '#d9f7a8'),
        rect(9, 5, 1, 1, '#d9f7a8'),
        rect(5, 8, 1, 1, '#d9f7a8'),
        rect(9, 11, 1, 1, '#d9f7a8'),
        rect(4, 1, 8, 2, '#2f6727'),
      ].join(''),
    ),
  deepslate: () =>
    svg(
      [
        blockBase({
          base: '#53575f',
          highlight: '#727780',
          shadow: '#35383f',
          left: '#454951',
          right: '#636871',
        }),
        rect(3, 4, 10, 1, '#3f434b'),
        rect(4, 7, 8, 1, '#70757d'),
        rect(3, 10, 10, 1, '#43474f'),
      ].join(''),
    ),
  'crafting-table': () =>
    svg(
      [
        rect(2, 2, 12, 12, '#915f37'),
        rect(2, 2, 12, 3, '#c58f5b'),
        rect(4, 6, 4, 4, '#5a3a22'),
        rect(8, 6, 4, 4, '#7a4f2d'),
        rect(4, 10, 8, 2, '#cda16b'),
        rect(5, 7, 2, 2, '#d9c089'),
        rect(9, 7, 2, 2, '#d9c089'),
      ].join(''),
    ),
  furnace: () =>
    svg(
      [
        blockBase({
          base: '#8e949d',
          highlight: '#bac1c9',
          shadow: '#636a74',
          left: '#767d86',
          right: '#a5acb5',
        }),
        rect(3, 4, 10, 2, '#c6ccd2'),
        rect(4, 7, 8, 5, '#3a3d42'),
        rect(5, 8, 6, 3, '#e39b42'),
        rect(6, 9, 4, 1, '#ffd28b'),
      ].join(''),
    ),
  stick: () => stickIcon(),
  coal: () =>
    svg(
      [
        path('M4 6 7 3 12 5 11 10 6 12 3 9Z', '#23272d'),
        path('M5 6 7 4 10 5 9 8 6 9 4 8Z', '#4b515a'),
        rect(8, 5, 1, 1, '#7b828d'),
      ].join(''),
    ),
  'iron-ore': () =>
    oreBlock(
      {
        base: '#8f98a3',
        highlight: '#b8c0ca',
        shadow: '#646c76',
        left: '#79828d',
        right: '#a7b0ba',
      },
      '#c4875a',
    ),
  'iron-ingot': () => ingot('#dfe7ef', '#9fadba'),
  'gold-ore': () =>
    oreBlock(
      {
        base: '#8f98a3',
        highlight: '#b8c0ca',
        shadow: '#646c76',
        left: '#79828d',
        right: '#a7b0ba',
      },
      '#f1cf59',
    ),
  'gold-ingot': () => ingot('#ffde77', '#cc9f25'),
  diamond: () => gem('#c8fbff', '#6be9f1', '#35abc5'),
  'wooden-pickaxe': () => pickaxe('#c89b64', '#7b532f'),
  'stone-pickaxe': () => pickaxe('#9aa2ab', '#7b532f'),
  'iron-pickaxe': () => pickaxe('#e4ebf1', '#7b532f'),
  'wooden-sword': () => sword('#c89b64', '#9b6c3d', '#6f4a2c'),
  'stone-sword': () => sword('#a4abb3', '#8f959c', '#6f4a2c'),
  'iron-sword': () => sword('#eef3f8', '#bcc6cf', '#6f4a2c'),
};

async function main() {
  await mkdir(outputDir, { recursive: true });

  await Promise.all(
    Object.entries(icons).map(async ([name, render]) => {
      const filePath = resolve(outputDir, `${name}.svg`);
      await writeFile(filePath, render(), 'utf8');
    }),
  );

  console.log(`Generated ${Object.keys(icons).length} inventory icons in ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
