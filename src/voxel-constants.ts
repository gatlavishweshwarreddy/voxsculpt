/**
 * VoxSculpt — shared sculpting constants.
 * Imported by any system that needs to agree on grid dimensions or limits.
 * No Three.js imports — pure numbers.
 */

/** One voxel's side length in meters. */
export const VOXEL_SIZE = 0.08;

/** Maximum voxels in any dimension from the origin. Grid is ±GRID_HALF_SIZE. */
export const GRID_HALF_SIZE = 8;

/** Maximum number of placed voxels before rejecting new placements. */
export const MAX_VOXELS = 512;

/** Maximum undo history depth. */
export const MAX_UNDO = 32;

/**
 * Convert a world-space coordinate to the nearest grid index.
 * Clamps to ±GRID_HALF_SIZE.
 */
export function worldToGrid(v: number): number {
  const raw = Math.round(v / VOXEL_SIZE);
  return Math.max(-GRID_HALF_SIZE, Math.min(GRID_HALF_SIZE, raw));
}

/** Convert a grid index back to world-space (center of the cell). */
export function gridToWorld(idx: number): number {
  return idx * VOXEL_SIZE;
}

/**
 * Pack grid coords into a single integer key.
 * Valid range: ±127 per axis.
 */
export function gridKey(x: number, y: number, z: number): number {
  return ((x + 127) & 0xff) |
         (((y + 127) & 0xff) << 8) |
         (((z + 127) & 0xff) << 16);
}
