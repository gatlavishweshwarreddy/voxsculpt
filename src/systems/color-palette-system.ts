/**
 * VoxSculpt — ColorPaletteSystem
 *
 * Manages the floating color-palette ring near the left wrist:
 *   • Spawns 8 swatch entities in a ring above the left wrist on init
 *   • Each frame, repositions the ring to follow the left wrist
 *   • When the right-hand ray tip enters a swatch, active color updates
 *   • Active swatch pulses with higher emissive intensity
 *
 * ECS rules: allocate in init(), never in update().
 * Query entities are Set<Entity>.
 */

import {
  Color,
  createSystem,
  Entity,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from '@iwsdk/core';
import { ColorSwatch, VoxelSculptor, FeedbackParticle } from '../voxel-components.js';
import { PALETTE_COLORS, PALETTE_RING_RADIUS, SWATCH_RADIUS } from '../scene-assets/palette.scene-asset.js';

const TWO_PI = Math.PI * 2;
/** Distance in meters within which ray-tip touch activates a swatch. */
const TOUCH_DIST = SWATCH_RADIUS + 0.018;

export class ColorPaletteSystem extends createSystem({
  sculptor: { required: [VoxelSculptor] },
  swatches: { required: [ColorSwatch] },
}) {
  // ── pre-allocated work ────────────────────────────────────────────────────
  private _swatchPos = new Vector3();
  private _fingerPos = new Vector3();
  private _wristPos = new Vector3();
  /** Ring floats 10 cm above wrist. */
  private _ringOffsetY = 0.10;

  private _activeIndex = 0;
  private _wasTouching = false;

  init(): void {
    this._spawnSwatches();
  }

  update(_delta: number): void {
    this._followWrist();
    this._checkFingerTouch();
  }

  // ── Palette spawn ─────────────────────────────────────────────────────────

  private _spawnSwatches(): void {
    const spawnNext = (i: number) => {
      if (i >= PALETTE_COLORS.length) {
        // All spawned — set initial active
        this._setActiveIndex(0);
        return;
      }
      this.world.assets.instantiate<Object3D>(`swatch-${i}`).then((obj) => {
        // Default position until wrist tracking kicks in
        const angle = (i / PALETTE_COLORS.length) * TWO_PI - Math.PI / 2;
        obj.position.set(
          Math.cos(angle) * PALETTE_RING_RADIUS,
          1.3,
          Math.sin(angle) * PALETTE_RING_RADIUS - 0.5,
        );
        const c = PALETTE_COLORS[i]!;
        const entity = this.world.createTransformEntity(obj);
        entity.addComponent(ColorSwatch, { color: [c.r, c.g, c.b, 1.0], index: i });
        spawnNext(i + 1);
      }).catch(() => spawnNext(i + 1));
    };
    spawnNext(0);
  }

  // ── Wrist following ───────────────────────────────────────────────────────

  private _followWrist(): void {
    // Use the left grip space as a wrist proxy
    const leftGrip = this.player.gripSpaces.left;
    if (leftGrip == null) return;

    leftGrip.updateWorldMatrix(true, false);
    this._wristPos.setFromMatrixPosition(leftGrip.matrixWorld);

    this.queries.swatches.entities.forEach((entity) => {
      const idx = entity.getValue(ColorSwatch, 'index') ?? 0;
      const angle = (idx / PALETTE_COLORS.length) * TWO_PI - Math.PI / 2;
      const localX = Math.cos(angle) * PALETTE_RING_RADIUS;
      const localZ = Math.sin(angle) * PALETTE_RING_RADIUS;
      const obj = entity.object3D!;
      obj.position.set(
        this._wristPos.x + localX,
        this._wristPos.y + this._ringOffsetY,
        this._wristPos.z + localZ,
      );
    });
  }

  // ── Touch detection ───────────────────────────────────────────────────────

  private _checkFingerTouch(): void {
    let sculptor: Entity | null = null;
    for (const e of this.queries.sculptor.entities) { sculptor = e; break; }
    if (sculptor == null) return;

    // Use right ray space as finger proxy
    const rightRay = this.player.raySpaces.right;
    if (rightRay == null) return;

    rightRay.updateWorldMatrix(true, false);
    this._fingerPos.setFromMatrixPosition(rightRay.matrixWorld);

    let touched = false;
    this.queries.swatches.entities.forEach((entity) => {
      if (touched) return;
      const obj = entity.object3D!;
      this._swatchPos.copy(obj.position);
      const dist = this._fingerPos.distanceTo(this._swatchPos);
      if (dist < TOUCH_DIST) {
        touched = true;
        if (!this._wasTouching) {
          const idx = entity.getValue(ColorSwatch, 'index') ?? 0;
          this._setActiveIndex(idx);

          const c = PALETTE_COLORS[idx]!;
          sculptor!.setValue(VoxelSculptor, 'activeColorR', c.r);
          sculptor!.setValue(VoxelSculptor, 'activeColorG', c.g);
          sculptor!.setValue(VoxelSculptor, 'activeColorB', c.b);

          this._spawnColorPickFeedback(obj.position, c.r, c.g, c.b);
        }
      }
    });

    this._wasTouching = touched;
  }

  // ── Visual state ──────────────────────────────────────────────────────────

  private _setActiveIndex(idx: number): void {
    this._activeIndex = idx;
    this.queries.swatches.entities.forEach((entity) => {
      const i = entity.getValue(ColorSwatch, 'index') ?? 0;
      this._setSwatchActive(entity, i === idx);
    });
  }

  private _setSwatchActive(entity: Entity, active: boolean): void {
    const obj = entity.object3D!;
    obj.traverse((child) => {
      if (child instanceof Mesh && child.name === 'swatch-sphere') {
        const mat = child.material as MeshStandardMaterial;
        mat.emissiveIntensity = active ? 0.7 : 0.15;
        mat.needsUpdate = true;
        obj.scale.setScalar(active ? 1.4 : 1.0);
      }
    });
  }

  private _spawnColorPickFeedback(pos: Vector3, r: number, g: number, b: number): void {
    this.world.assets.instantiate<Object3D>('particle').then((obj) => {
      obj.position.copy(pos);
      obj.traverse((child) => {
        if (child instanceof Mesh) {
          const m = child.material as MeshStandardMaterial;
          m.color.set(new Color(r, g, b));
          m.emissive.set(new Color(r, g, b));
        }
      });
      const entity = this.world.createTransformEntity(obj);
      entity.addComponent(FeedbackParticle, { life: 0.6, type: 2 });
    }).catch(() => { /* non-critical */ });
  }
}
