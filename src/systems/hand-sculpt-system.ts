/**
 * VoxSculpt — HandSculptSystem
 *
 * Primary sculpting loop:
 *  • Detects index-thumb PINCH on either hand via XRHandVisualAdapter.getPinchStrength()
 *  • Right (or left) hand pinch in empty space → spawns a preview voxel snapped to grid
 *  • Releasing pinch (slow) → places voxel permanently
 *  • Releasing pinch (fast throw, velocity > threshold) → deletes nearest voxel
 *  • Active color comes from VoxelSculptor component
 *
 * ECS rules: allocate in init(), never in update().
 * Queries return Set<Entity> — use .forEach(), .size, spread for first element.
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
import { VoxelBlock, VoxelSculptor, FeedbackParticle } from '../voxel-components.js';
import type { AudioSystem } from './audio-system.js';
import type { OnboardingSystem } from './onboarding-system.js';
import type { SurfaceSystem } from './surface-system.js';
import {
  gridToWorld,
  gridKey,
  MAX_VOXELS,
  VOXEL_SIZE,
  worldToGrid,
} from '../voxel-constants.js';

// ── Pinch threshold (0..1 from getPinchStrength) ──────────────────────────────
const PINCH_COMMIT = 0.85;
const PINCH_RELEASE = 0.55;
/** Throw speed threshold in m/s to trigger delete instead of place. */
const THROW_SPEED = 1.0;

// ── Undo record ───────────────────────────────────────────────────────────────

interface UndoRecord {
  kind: 'place' | 'delete';
  gx: number;
  gy: number;
  gz: number;
  r: number;
  g: number;
  b: number;
}

// ── System ────────────────────────────────────────────────────────────────────

export class HandSculptSystem extends createSystem({
  sculptor: { required: [VoxelSculptor] },
  voxels: { required: [VoxelBlock] },
}) {
  // ── pre-allocated work vectors ────────────────────────────────────────────
  private _handPos = new Vector3();
  private _prevHandPos = [new Vector3(), new Vector3()];
  private _handVel = new Vector3();
  private _placePos = new Vector3();

  // ── state ─────────────────────────────────────────────────────────────────
  /** Currently held (preview) entity per hand index (0=left,1=right). */
  private _held: [Entity | null, Entity | null] = [null, null];

  /** Was pinching last frame, per hand. */
  private _wasPinching: [boolean, boolean] = [false, false];

  /** Occupied grid cells: gridKey → Entity. */
  private _grid = new Map<number, Entity>();

  /** Undo stack (newest last). */
  private _undoStack: UndoRecord[] = [];

  get undoStack(): UndoRecord[] { return this._undoStack; }
  get grid(): Map<number, Entity> { return this._grid; }

  /** Injected by src/index.ts */
  audioSystem: AudioSystem | null = null;
  onboardingSystem: OnboardingSystem | null = null;
  surfaceSystem: SurfaceSystem | null = null;

  init(): void {
    // Nothing to pre-allocate beyond class properties
  }

  update(delta: number): void {
    const sculptorEntity = this._getSculptor();
    if (sculptorEntity == null) return;

    const hands = this.world.input.xr?.visualAdapters?.hand;
    if (hands == null) return;

    const handAdapters = [hands.left, hands.right] as const;
    // Gamepad refs for emulator fallback (Trigger = discrete select on controllers/emulator)
    const gamepads = [
      this.world.input.xr.gamepads['left'],
      this.world.input.xr.gamepads['right'],
    ] as const;

    for (let h = 0; h < 2; h++) {
      const adapter = handAdapters[h]!;
      if (adapter == null) continue;

      // getPinchStrength() is joint-distance based — works on real hands only.
      // In the emulator (controller mode) joints are absent and it stays 0.
      // Fall back to the gamepad's Trigger select state so the emulator works.
      const jointStrength = adapter.getPinchStrength?.() ?? 0;
      const gamepadSelecting = gamepads[h]?.getSelecting() ?? false;
      const pinchStrength = jointStrength > 0 ? jointStrength : (gamepadSelecting ? 1.0 : 0.0);
      const isPinching = pinchStrength >= PINCH_COMMIT;
      const wasP = this._wasPinching[h]!;

      // Get index-tip world position via raySpace / gripSpace fallback
      // IWSDK exposes raySpaces and gripSpaces on player
      const handSpace = h === 0
        ? this.player.raySpaces.left
        : this.player.raySpaces.right;

      if (handSpace == null) continue;
      handSpace.updateWorldMatrix(true, false);
      this._handPos.setFromMatrixPosition(handSpace.matrixWorld);

      // Hand velocity (m/frame → m/s)
      this._handVel.subVectors(this._handPos, this._prevHandPos[h]!);
      const speed = this._handVel.length() / Math.max(delta, 0.001);
      this._prevHandPos[h]!.copy(this._handPos);

      if (!wasP && isPinching) {
        this._onPinchStart(h, sculptorEntity);
      } else if (wasP && isPinching) {
        this._onPinchHold(h);
      } else if (wasP && !isPinching && pinchStrength < PINCH_RELEASE) {
        if (speed > THROW_SPEED) {
          this._onThrowDelete(sculptorEntity);
        } else {
          this._onPinchRelease(h, sculptorEntity);
        }
      }

      this._wasPinching[h] = isPinching;
    }
  }

  // ── Pinch handlers ────────────────────────────────────────────────────────

  private _onPinchStart(hand: number, sculptor: Entity): void {
    if (this._held[hand] != null) return;
    if (this.queries.voxels.entities.size >= MAX_VOXELS) return;

    const r = sculptor.getValue(VoxelSculptor, 'activeColorR') ?? 0.4;
    const g = sculptor.getValue(VoxelSculptor, 'activeColorG') ?? 0.8;
    const b = sculptor.getValue(VoxelSculptor, 'activeColorB') ?? 1.0;

    // Spawn preview voxel asynchronously
    this.world.assets.instantiate<Object3D>('voxel').then((obj) => {
      this._tintVoxelObject(obj, r, g, b, 0.55);

      const entity = this.world.createTransformEntity(obj);
      entity.addComponent(VoxelBlock, {
        color: [r, g, b, 1.0],
        gridX: 0,
        gridY: 0,
        gridZ: 0,
        isPreview: true,
      });

      this._held[hand] = entity;
      this._updatePreviewPosition(hand, entity);
    }).catch(() => { /* asset not ready */ });
  }

  private _onPinchHold(hand: number): void {
    const entity = this._held[hand];
    if (entity != null) this._updatePreviewPosition(hand, entity);
  }

  private _onPinchRelease(hand: number, sculptor: Entity): void {
    const entity = this._held[hand];
    if (entity == null) return;

    const gx = entity.getValue(VoxelBlock, 'gridX') ?? 0;
    const gy = entity.getValue(VoxelBlock, 'gridY') ?? 0;
    const gz = entity.getValue(VoxelBlock, 'gridZ') ?? 0;
    const key = gridKey(gx, gy, gz);

    if (this._grid.has(key)) {
      entity.dispose();
    } else {
      const colorView = entity.getVectorView(VoxelBlock, 'color');
      const cr = colorView[0] ?? 0.4;
      const cg = colorView[1] ?? 0.8;
      const cb = colorView[2] ?? 1.0;

      entity.setValue(VoxelBlock, 'isPreview', false);
      this._tintVoxelObject(entity.object3D!, cr, cg, cb, 1.0);

      this._placePos.set(gridToWorld(gx ?? 0), gridToWorld(gy ?? 0), gridToWorld(gz ?? 0));
      entity.object3D!.position.copy(this._placePos);

      this._grid.set(key, entity);
      this._pushUndo({ kind: 'place', gx, gy, gz, r: cr, g: cg, b: cb });
      this.audioSystem?.playPlace();

      const total = sculptor.getValue(VoxelSculptor, 'totalVoxels') ?? 0;
      sculptor.setValue(VoxelSculptor, 'totalVoxels', total + 1);
      sculptor.setValue(VoxelSculptor, 'undoDepth', this._undoStack.length);

      this._spawnFeedback(this._placePos, 0);
    }

    this._held[hand] = null;
  }

  private _onThrowDelete(sculptor: Entity): void {
    let nearest: Entity | null = null;
    let nearestKey = 0;
    let nearestDist = Infinity;

    this.queries.voxels.entities.forEach((e) => {
      if (e.getValue(VoxelBlock, 'isPreview')) return;
      const obj = e.object3D;
      if (obj == null) return;
      const d = this._handPos.distanceToSquared(obj.position);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e;
        nearestKey = gridKey(
          e.getValue(VoxelBlock, 'gridX') ?? 0,
          e.getValue(VoxelBlock, 'gridY') ?? 0,
          e.getValue(VoxelBlock, 'gridZ') ?? 0,
        );
      }
    });

    if (nearest != null && nearestDist < (VOXEL_SIZE * 4) ** 2) {
      const n = nearest as Entity;
      const colorView = n.getVectorView(VoxelBlock, 'color');
      const gx = n.getValue(VoxelBlock, 'gridX') ?? 0;
      const gy = n.getValue(VoxelBlock, 'gridY') ?? 0;
      const gz = n.getValue(VoxelBlock, 'gridZ') ?? 0;
      this._pushUndo({
        kind: 'delete', gx, gy, gz,
        r: colorView[0] ?? 0.4, g: colorView[1] ?? 0.8, b: colorView[2] ?? 1.0,
      });

      const pos = n.object3D!.position.clone();
      this._grid.delete(nearestKey);
      n.dispose();
      this.audioSystem?.playDelete();
      this.onboardingSystem?.notifyDelete();

      const total = sculptor.getValue(VoxelSculptor, 'totalVoxels') ?? 0;
      sculptor.setValue(VoxelSculptor, 'totalVoxels', Math.max(0, total - 1));
      sculptor.setValue(VoxelSculptor, 'undoDepth', this._undoStack.length);

      this._spawnFeedback(pos, 1);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _updatePreviewPosition(hand: number, entity: Entity): void {
    const handSpace = hand === 0
      ? this.player.raySpaces.left
      : this.player.raySpaces.right;
    if (handSpace == null) return;

    handSpace.updateWorldMatrix(true, false);
    this._handPos.setFromMatrixPosition(handSpace.matrixWorld);

    const gx = worldToGrid(this._handPos.x);
    // Clamp preview Y so blocks are never placed below the detected surface.
    const surfaceY = this.surfaceSystem?.surfaceY ?? 0;
    const rawGy = worldToGrid(this._handPos.y);
    const surfaceGy = worldToGrid(surfaceY);
    const gy = Math.max(rawGy, surfaceGy);
    const gz = worldToGrid(this._handPos.z);

    entity.setValue(VoxelBlock, 'gridX', gx);
    entity.setValue(VoxelBlock, 'gridY', gy);
    entity.setValue(VoxelBlock, 'gridZ', gz);

    this._placePos.set(gridToWorld(gx), gridToWorld(gy), gridToWorld(gz));
    entity.object3D!.position.copy(this._placePos);

    const occupied = this._grid.has(gridKey(gx, gy, gz));
    const colorView = entity.getVectorView(VoxelBlock, 'color');
    if (occupied) {
      this._tintVoxelObject(entity.object3D!, 1.0, 0.2, 0.2, 0.4);
    } else {
      this._tintVoxelObject(entity.object3D!, colorView[0] ?? 0.4, colorView[1] ?? 0.8, colorView[2] ?? 1.0, 0.6);
    }
  }

  private _tintVoxelObject(obj: Object3D, r: number, g: number, b: number, opacity: number): void {
    obj.traverse((child) => {
      if (child instanceof Mesh && child.name === 'voxel-face') {
        child.material = new MeshStandardMaterial({
          color: new Color(r, g, b),
          roughness: 0.3,
          metalness: 0.1,
          transparent: opacity < 1.0,
          opacity,
          emissive: new Color(r * 0.15, g * 0.15, b * 0.15),
        });
      }
    });
  }

  private _spawnFeedback(pos: Vector3, type: number): void {
    this.world.assets.instantiate<Object3D>('particle').then((obj) => {
      obj.position.copy(pos);
      const entity = this.world.createTransformEntity(obj);
      entity.addComponent(FeedbackParticle, { life: 1.0, type });
    }).catch(() => { /* non-critical */ });
  }

  private _pushUndo(record: UndoRecord): void {
    this._undoStack.push(record);
    if (this._undoStack.length > 32) this._undoStack.shift();
  }

  // ── Called by UndoSystem ──────────────────────────────────────────────────

  popUndo(sculptor: Entity): void {
    const record = this._undoStack.pop();
    if (record == null) return;

    if (record.kind === 'place') {
      const key = gridKey(record.gx, record.gy, record.gz);
      const e = this._grid.get(key);
      if (e != null) {
        this._grid.delete(key);
        e.dispose();
        const total = sculptor.getValue(VoxelSculptor, 'totalVoxels') ?? 0;
        sculptor.setValue(VoxelSculptor, 'totalVoxels', Math.max(0, total - 1));
      }
    } else {
      this.world.assets.instantiate<Object3D>('voxel').then((obj) => {
        this._tintVoxelObject(obj, record.r, record.g, record.b, 1.0);
        const pos = new Vector3(gridToWorld(record.gx), gridToWorld(record.gy), gridToWorld(record.gz));
        obj.position.copy(pos);
        const entity = this.world.createTransformEntity(obj);
        entity.addComponent(VoxelBlock, {
          color: [record.r, record.g, record.b, 1.0],
          gridX: record.gx,
          gridY: record.gy,
          gridZ: record.gz,
          isPreview: false,
        });
        this._grid.set(gridKey(record.gx, record.gy, record.gz), entity);
        const total = sculptor.getValue(VoxelSculptor, 'totalVoxels') ?? 0;
        sculptor.setValue(VoxelSculptor, 'totalVoxels', total + 1);
      }).catch(() => { /* non-critical */ });
    }

    sculptor.setValue(VoxelSculptor, 'undoDepth', this._undoStack.length);
  }

  // ── Called by SurfaceSystem ───────────────────────────────────────────────

  /**
   * Shifts every placed voxel (and their grid keys) by `dy` world-units on Y.
   * Called when the user repositions the build surface with the both-hands gesture.
   */
  shiftGridY(dy: number): void {
    const dGridY = Math.round(dy / VOXEL_SIZE);
    if (dGridY === 0) return;

    // Re-key the entire grid map with shifted Y values
    const entries = Array.from(this._grid.entries());
    this._grid.clear();

    for (const [, entity] of entries) {
      const gx = entity.getValue(VoxelBlock, 'gridX') ?? 0;
      const gy = entity.getValue(VoxelBlock, 'gridY') ?? 0;
      const gz = entity.getValue(VoxelBlock, 'gridZ') ?? 0;
      const newGy = gy + dGridY;

      entity.setValue(VoxelBlock, 'gridY', newGy);
      this._placePos.set(gridToWorld(gx), gridToWorld(newGy), gridToWorld(gz));
      entity.object3D!.position.copy(this._placePos);

      this._grid.set(gridKey(gx, newGy, gz), entity);
    }

    // Shift undo records so undo still lands in the right place
    for (const record of this._undoStack) {
      record.gy += dGridY;
    }
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  private _getSculptor(): Entity | null {
    for (const e of this.queries.sculptor.entities) return e;
    return null;
  }
}
