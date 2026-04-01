# HEL-142 Windows Intel Control Startup Profile Report

- Generated at: `2026-03-30T23:05:44.226Z`
- Surface classification: desktop Chrome with hardware acceleration and `navigator.gpu`, but runtime fell back to `WebGL 2 | hardware accelerated | ANGLE (Intel, Intel(R) HD Graphics 4600 (0x00000416) Direct3D11 vs_5_0 ps_5_0, D3D11) | volumetric lighting disabled (webgpu-fallback-adapter)`
- Startup total duration: `2762.3ms`
- Long frames after startup: `19`
- Max frame duration: `2527.5ms`

## Top startup phases

- `initial-rebuild-world`: `2142.7ms`
- `initial-rebuild-world:compute-lighting`: `1302.0ms`
- `create-scene-renderer`: `480.8ms`
- `initial-rebuild-world:rebuild-visible-meshes`: `437.7ms`
- `initial-rebuild-world:sync-chunks`: `402.5ms`

## Chrome trace GPU/compositor highlights

- `GpuChannelHost::CreateViewCommandBuffer`: `170.1ms`
- `CommandBufferProxyImpl::Initialize`: `170.0ms`

## Prioritized remediation candidates

- `high`: `initial-rebuild-world:compute-lighting`
  Lighting recomputation is large enough to appear among top startup phases; compare `computeVoxelLighting` cost against the full rebuild-world span.
- `high`: `initial-rebuild-world:rebuild-visible-meshes`
  Visible mesh reconstruction is large enough to appear among top startup phases; compare scene clearing and per-block mesh rebuild cost against lighting and renderer init.
- `high`: `initial-rebuild-world`
  Initial world rebuild dominates startup time; inspect voxel iteration, mesh creation, and lighting work before first interaction.
- `medium`: `post-startup frame loop`
  Observed `19` long frames after startup; correlate Chrome trace main-thread slices against world rebuild and render-loop work.

## What this already narrows

- Synchronous world rebuild work is the lead startup suspect on the current desktop control surface.
- Pure renderer bootstrap is not the leading measured suspect on this control surface.
- The RTX-only volumetric/material path is still unproven because this run never stayed on desktop WebGPU rendering.
