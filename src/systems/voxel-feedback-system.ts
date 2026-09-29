/**
 * VoxSculpt — VoxelFeedbackSystem
 *
 * Animates transient FeedbackParticle entities:
 *   • Scales them with a pop-and-fade envelope
 *   • Moves them upward slightly
 *   • Fades their opacity
 *   • Disposes them when life <= 0
 *
 * Never allocates in update(). Work vectors are class properties.
 * Query entities are Set<Entity>.
 */

import {
  createSystem,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from '@iwsdk/core';
import { FeedbackParticle } from '../voxel-components.js';

const RISE_SPEED = 0.18;

export class VoxelFeedbackSystem extends createSystem({
  particles: { required: [FeedbackParticle] },
}) {
  private _riseVec = new Vector3(0, RISE_SPEED, 0);

  update(delta: number): void {
    const toDispose: (typeof this.queries.particles.entities extends Set<infer T> ? T : never)[] = [];

    this.queries.particles.entities.forEach((entity) => {
      const life = entity.getValue(FeedbackParticle, 'life') ?? 1.0;
      const newLife = life - delta;

      if (newLife <= 0) {
        toDispose.push(entity);
        return;
      }

      entity.setValue(FeedbackParticle, 'life', newLife);

      const obj = entity.object3D;
      if (obj == null) return;

      obj.position.addScaledVector(this._riseVec, delta);

      // Pop scale: peaks at t≈0.5 then shrinks
      const t = newLife;
      const scale = 4 * t * (1 - t) + 0.4 * (1 - t);
      obj.scale.setScalar(Math.max(0.01, scale));

      obj.traverse((child) => {
        if (child instanceof Mesh) {
          const mat = child.material as MeshStandardMaterial;
          mat.opacity = Math.max(0, newLife);
          mat.transparent = true;
          mat.needsUpdate = true;
        }
      });
    });

    for (const entity of toDispose) {
      entity.dispose();
    }
  }
}
