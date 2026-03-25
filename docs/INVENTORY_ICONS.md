# Inventory Icon Checklist

This checklist is the source artifact for the inventory icon task requested on HEL-109.
The current UI ships with code-driven placeholder icons that follow Minecraft item color/silhouette cues.
Every item below still needs a final production icon pass.

Reference target:

- Match the Minecraft inventory slot presentation, readability, and item-family silhouettes.
- Keep icons legible at hotbar scale and inventory-grid scale.
- Preserve quick recognition between block, material, tool, and station categories.

Status key:

- `[x]` Placeholder icon exists in code and is wired into the UI.
- `[ ]` Final production art still needed.

## Blocks

- `[x] [ ]` Grass
- `[x] [ ]` Dirt
- `[x] [ ]` Stone
- `[x] [ ]` Cobblestone
- `[x] [ ]` Sand
- `[x] [ ]` Sandstone
- `[x] [ ]` Gravel
- `[x] [ ]` Snow
- `[x] [ ]` Oak Log
- `[x] [ ]` Oak Planks
- `[x] [ ]` Oak Leaves
- `[x] [ ]` Cactus
- `[x] [ ]` Deepslate
- `[x] [ ]` Crafting Table
- `[x] [ ]` Furnace

## Materials

- `[x] [ ]` Stick
- `[x] [ ]` Coal
- `[x] [ ]` Iron Ore
- `[x] [ ]` Iron Ingot
- `[x] [ ]` Gold Ore
- `[x] [ ]` Gold Ingot
- `[x] [ ]` Diamond

## Tools

- `[x] [ ]` Wooden Pickaxe
- `[x] [ ]` Stone Pickaxe
- `[x] [ ]` Iron Pickaxe
- `[x] [ ]` Wooden Sword
- `[x] [ ]` Stone Sword
- `[x] [ ]` Iron Sword

## Asset Notes

- Use square inventory-ready assets with transparent backgrounds.
- Design for two display sizes first: hotbar slot scale and menu inventory slot scale.
- Keep tool head/material color coding aligned with Minecraft expectations so recipes scan quickly.
- The canonical item list for implementation lives in [src/ui/inventoryIcons.ts](/home/helionaut/workspaces/HEL-109/src/ui/inventoryIcons.ts).
