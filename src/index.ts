/**
 * VoxSculpt — application entry point.
 *
 * Registers all ECS systems and wires cross-system dependencies.
 * The virtual:iwsdk-project module is the sole source of project options.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';

import { HandSculptSystem } from './systems/hand-sculpt-system.js';
import { ColorPaletteSystem } from './systems/color-palette-system.js';
import { VoxelFeedbackSystem } from './systems/voxel-feedback-system.js';
import { UndoSystem } from './systems/undo-system.js';
import { ExportSystem } from './systems/export-system.js';
import { HUDSystem } from './systems/hud-system.js';
import { VoxelSculptorSpawnSystem } from './systems/sculptor-spawn-system.js';
import { PanelSystem } from './panel.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  // Spawn the singleton VoxelSculptor entity first
  world.registerSystem(VoxelSculptorSpawnSystem);

  // Core sculpting loop
  world.registerSystem(HandSculptSystem);

  // Palette ring (left wrist)
  world.registerSystem(ColorPaletteSystem);

  // Pop/fade feedback particles
  world.registerSystem(VoxelFeedbackSystem);

  // GLTF export
  world.registerSystem(ExportSystem);

  // Floating HUD
  world.registerSystem(HUDSystem);

  // Two-hand undo gesture
  world.registerSystem(UndoSystem);

  // XR launch / exit panel (keep for non-immersive browser view)
  world.registerSystem(PanelSystem);

  // ── Cross-system wiring ──────────────────────────────────────────────────
  // Systems are singletons after registration; retrieve them for dependency
  // injection so UndoSystem and HUDSystem can call into their peers.
  const handSystem = world.getSystem(HandSculptSystem);
  const undoSystem = world.getSystem(UndoSystem);
  const exportSystem = world.getSystem(ExportSystem);
  const hudSystem = world.getSystem(HUDSystem);

  if (undoSystem != null && handSystem != null) {
    undoSystem.handSculptSystem = handSystem;
  }
  if (hudSystem != null && exportSystem != null) {
    hudSystem.exportSystem = exportSystem;
  }
});
