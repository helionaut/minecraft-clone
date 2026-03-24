import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import type { Object3D } from 'three';

import { BLOCK_DEFINITIONS } from '../gameplay/blocks.ts';
import { generateFlatWorld } from '../gameplay/world.ts';

export interface HarnessScene {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGLRenderer;
  readonly dispose: () => void;
}

export function createHarnessScene(container: HTMLElement): HarnessScene {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Minecraft clone prototype viewport');
  container.append(canvas);

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    canvas,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);

  const scene = new Scene();
  scene.background = new Color(0x7bb3d8);

  const camera = new PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(9, 10, 9);
  camera.lookAt(0, 0, 0);

  const ambient = new AmbientLight(0xf1ead4, 1.8);
  const sun = new DirectionalLight(0xfff0c4, 2.2);
  sun.position.set(10, 18, 8);
  scene.add(ambient, sun);

  const world = new Group();
  const geometry = new BoxGeometry(1, 1, 1);

  for (const block of generateFlatWorld({ radius: 5, plateauHeight: 3 })) {
    const material = new MeshLambertMaterial({
      color: BLOCK_DEFINITIONS[block.type].color,
    });
    const voxel = new Mesh(geometry, material);
    voxel.position.set(block.x, block.y, block.z);
    world.add(voxel);
  }

  const marker = new Mesh(
    geometry,
    new MeshLambertMaterial({
      color: BLOCK_DEFINITIONS.highlight.color,
      transparent: true,
      opacity: 0.4,
    }),
  );
  marker.position.set(2, 3, 1);
  marker.scale.setScalar(1.08);
  world.add(marker);

  scene.add(world);

  const syncSize = () => {
    const { clientWidth, clientHeight } = container;
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight);
  };

  syncSize();

  let frameId = 0;

  const tick = () => {
    world.rotation.y += 0.0028;
    marker.rotation.y -= 0.01;
    camera.position.x = Math.sin(performance.now() * 0.00035) * 11;
    camera.position.z = Math.cos(performance.now() * 0.00035) * 11;
    camera.lookAt(0, 1, 0);
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(tick);
  };

  tick();

  const resizeObserver = new ResizeObserver(syncSize);
  resizeObserver.observe(container);

  return {
    canvas,
    renderer,
    dispose: () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.dispose();
      geometry.dispose();
      world.traverse((object: Object3D) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material: MeshLambertMaterial) =>
              material.dispose(),
            );
          } else {
            object.material.dispose();
          }
        }
      });
      canvas.remove();
    },
  };
}
