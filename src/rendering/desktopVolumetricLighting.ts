import { BackSide, BoxGeometry, Mesh } from 'three';
import { VolumeNodeMaterial } from 'three/webgpu';
import { float, max, smoothstep, vec3, viewportDepthTexture } from 'three/tsl';
import type { positionWorld } from 'three/tsl';

const VOLUMETRIC_LIGHT_VOLUME_SIZE = {
  width: 40,
  height: 18,
  depth: 40,
};

export function createDesktopVolumetricLightVolume(): Mesh<BoxGeometry, VolumeNodeMaterial> {
  const material = new VolumeNodeMaterial({
    transparent: true,
    side: BackSide,
  });

  material.steps = 40;
  material.depthNode = viewportDepthTexture();
  material.scatteringNode = ({ positionRay }: { positionRay: typeof positionWorld }) => {
    const nearGroundDensity = smoothstep(float(16), float(2), positionRay.y);
    const baseDensity = max(nearGroundDensity, float(0.08));

    return vec3(1.0, 0.9, 0.72).mul(baseDensity.mul(0.42));
  };

  const volume = new Mesh(
    new BoxGeometry(
      VOLUMETRIC_LIGHT_VOLUME_SIZE.width,
      VOLUMETRIC_LIGHT_VOLUME_SIZE.height,
      VOLUMETRIC_LIGHT_VOLUME_SIZE.depth,
    ),
    material,
  );
  volume.frustumCulled = false;
  volume.renderOrder = 10;

  return volume;
}
