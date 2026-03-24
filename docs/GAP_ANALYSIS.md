# HEL-102 Gap Analysis

## Baseline Reviewed

- Code review of the current gameplay, world, rendering, and HUD modules.
- Desktop screenshot: `.symphony/screenshots/HEL-102-desktop-baseline.png`
- Mobile screenshot: `.symphony/screenshots/HEL-102-mobile-baseline.png`

## Current State

The project already clears the original publishable-slice bar: deterministic
terrain, multi-material biomes, fluids, caves, lighting, pointer-lock movement,
collision, mining, placement, and local persistence are all present.

## Highest-Value Gaps Against A Minecraft-Like Baseline

| Priority | Gap | Why it matters |
| --- | --- | --- |
| High | Surface landmarks are missing | The world reads as empty terrain instead of a recognizable Minecraft-like overworld. Trees and cacti create orientation, biome identity, and more iconic silhouettes immediately. |
| High | Block selection still feels like an overlay palette | Minecraft trains players on hotbar slots and fast cycling. The current HUD works, but it reads closer to debug UI than moment-to-moment play UI. |
| Medium | Fluids do not behave like Minecraft traversal spaces | Water and lava exist visually, but movement and interaction do not yet create swimming or fluid risk/reward. |
| Medium | There is no survival/sandbox progression layer | No health, hunger, crafting, furnace loop, drops, or inventory depth yet. |
| Low | No ambient life cycle systems | Day/night, mobs, weather, and sound are absent, but they are secondary until the overworld itself feels more legible. |

## Chosen Next Slice

This pass prioritizes the top two gaps:

1. Add deterministic surface decorations and new block families.
2. Upgrade block selection to a hotbar-style interaction model.

This was chosen over fluids or survival systems because it improves the first
impression, navigation, and Minecraft-like identity without requiring a much
larger simulation rewrite.
