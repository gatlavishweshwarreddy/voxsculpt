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
import { AudioSystem } from './systems/audio-system.js';
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

  // Procedural sound effects
  world.registerSystem(AudioSystem);

  // GLTF export
  world.registerSystem(ExportSystem);

  // Floating HUD
  world.registerSystem(HUDSystem);

  // Two-hand undo gesture
  world.registerSystem(UndoSystem);

  // XR launch / exit panel (keep for non-immersive browser view)
  world.registerSystem(PanelSystem);

  // ── Cross-system wiring ──────────────────────────────────────────────────
  const handSystem = world.getSystem(HandSculptSystem);
  const paletteSystem = world.getSystem(ColorPaletteSystem);
  const undoSystem = world.getSystem(UndoSystem);
  const exportSystem = world.getSystem(ExportSystem);
  const hudSystem = world.getSystem(HUDSystem);
  const audioSystem = world.getSystem(AudioSystem);

  if (undoSystem != null && handSystem != null) {
    undoSystem.handSculptSystem = handSystem;
  }
  if (hudSystem != null && exportSystem != null) {
    hudSystem.exportSystem = exportSystem;
  }
  // Inject audio into every system that triggers sounds
  if (audioSystem != null) {
    if (handSystem != null) handSystem.audioSystem = audioSystem;
    if (paletteSystem != null) paletteSystem.audioSystem = audioSystem;
    if (undoSystem != null) undoSystem.audioSystem = audioSystem;
  }
});
