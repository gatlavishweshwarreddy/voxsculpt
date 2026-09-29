/**
 * VoxSculpt — ECS component declarations.
 * System-free module: no World, no DOM, no Three imports beyond types.
 */

import { createComponent, Types } from '@iwsdk/core';

/**
 * VoxelBlock — tags an entity as a placed voxel.
 * color: RGBA tint applied to this instance's material.
 * gridX/Y/Z: integer grid coordinates (step = VOXEL_SIZE).
 * isPreview: true while floating in hand before placement.
 */
export const VoxelBlock = createComponent('VoxelBlock', {
  color: {
    type: Types.Color,
    default: [0.4, 0.8, 1.0, 1.0],
    label: 'Block color',
  },
  gridX: { type: Types.Int32, default: 0, label: 'Grid X' },
  gridY: { type: Types.Int32, default: 0, label: 'Grid Y' },
  gridZ: { type: Types.Int32, default: 0, label: 'Grid Z' },
  isPreview: { type: Types.Boolean, default: false, label: 'Is preview' },
});

/**
 * ColorSwatch — tags an entity as a palette color swatch.
 * color: RGBA color this swatch represents.
 * index: position in the palette ring (0-based).
 */
export const ColorSwatch = createComponent('ColorSwatch', {
  color: {
    type: Types.Color,
    default: [1.0, 1.0, 1.0, 1.0],
    label: 'Swatch color',
  },
  index: { type: Types.Int32, default: 0, label: 'Palette index' },
});

/**
 * VoxelSculptor — singleton component on the player/world entity
 * that tracks global sculpting state.
 * activeColorR/G/B/A: current brush color (split floats for ECS compat).
 * undoDepth: number of undoable actions currently stored.
 * totalVoxels: running count of placed voxels.
 */
export const VoxelSculptor = createComponent('VoxelSculptor', {
  activeColorR: { type: Types.Float32, default: 0.4, label: 'Color R' },
  activeColorG: { type: Types.Float32, default: 0.8, label: 'Color G' },
  activeColorB: { type: Types.Float32, default: 1.0, label: 'Color B' },
  activeColorA: { type: Types.Float32, default: 1.0, label: 'Color A' },
  undoDepth: { type: Types.Int32, default: 0, label: 'Undo depth' },
  totalVoxels: { type: Types.Int32, default: 0, label: 'Total voxels' },
});

/**
 * FeedbackParticle — transient tag added by HandSculptSystem
 * to trigger a pop effect. Removed by VoxelFeedbackSystem once played.
 * life: remaining lifetime in seconds (counts down from 1).
 * type: 0=place, 1=delete, 2=colorPick.
 */
export const FeedbackParticle = createComponent('FeedbackParticle', {
  life: { type: Types.Float32, default: 1.0, label: 'Life' },
  type: {
    type: Types.Int32,
    default: 0,
    label: 'Type',
    enum: { place: 0, delete: 1, colorPick: 2 },
  },
});
