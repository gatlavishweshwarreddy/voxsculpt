/**
 * VoxSculpt — VoxelSculptorSpawnSystem
 *
 * Spawns a single entity carrying the VoxelSculptor singleton component.
 * Must be registered before all other VoxSculpt systems.
 *
 * Query entities are Set<Entity>.
 */

import { createSystem, Group } from '@iwsdk/core';
import { VoxelSculptor } from '../voxel-components.js';

export class VoxelSculptorSpawnSystem extends createSystem({
  existing: { required: [VoxelSculptor] },
}) {
  private _spawned = false;

  init(): void {
    this._maybeSpawn();
  }

  update(): void {
    if (!this._spawned) this._maybeSpawn();
  }

  private _maybeSpawn(): void {
    if (this.queries.existing.entities.size > 0) {
      this._spawned = true;
      return;
    }
    const anchor = new Group();
    anchor.name = 'voxsculpt-state';
    const entity = this.world.createTransformEntity(anchor);
    entity.addComponent(VoxelSculptor, {
      activeColorR: 0.20,
      activeColorG: 0.60,
      activeColorB: 1.00,
      activeColorA: 1.00,
      undoDepth: 0,
      totalVoxels: 0,
    });
    this._spawned = true;
  }
}
