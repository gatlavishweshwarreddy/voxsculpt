/**
 * VoxSculpt — UndoSystem
 *
 * Detects the two-hand undo gesture:
 *   Both hands pinching simultaneously, then releasing together.
 *   On dual-release, calls HandSculptSystem.popUndo() to reverse the last action.
 *
 * Query entities are Set<Entity>.
 */

import { createSystem } from '@iwsdk/core';
import { VoxelSculptor } from '../voxel-components.js';
import type { HandSculptSystem } from './hand-sculpt-system.js';
import type { AudioSystem } from './audio-system.js';

const PINCH_COMMIT = 0.85;
const PINCH_RELEASE = 0.55;

export class UndoSystem extends createSystem({
  sculptor: { required: [VoxelSculptor] },
}) {
  private _bothPinchingLastFrame = false;
  private _glowTimer = 0;

  /** Injected by src/index.ts after both systems are registered. */
  handSculptSystem: HandSculptSystem | null = null;
  audioSystem: AudioSystem | null = null;

  update(delta: number): void {
    const hands = this.world.input.xr?.visualAdapters?.hand;
    if (hands == null) return;

    // Same emulator fallback as HandSculptSystem: use gamepad select when joints absent.
    const gpLeft = this.world.input.xr.gamepads['left'];
    const gpRight = this.world.input.xr.gamepads['right'];
    const rawLeft = hands.left?.getPinchStrength?.() ?? 0;
    const rawRight = hands.right?.getPinchStrength?.() ?? 0;
    const leftStrength = rawLeft > 0 ? rawLeft : ((gpLeft?.getSelecting() ?? false) ? 1.0 : 0.0);
    const rightStrength = rawRight > 0 ? rawRight : ((gpRight?.getSelecting() ?? false) ? 1.0 : 0.0);
    const bothPinching = leftStrength >= PINCH_COMMIT && rightStrength >= PINCH_COMMIT;

    if (bothPinching) {
      this._glowTimer += delta;
    } else {
      const wasReleased =
        this._bothPinchingLastFrame &&
        leftStrength < PINCH_RELEASE &&
        rightStrength < PINCH_RELEASE &&
        this._glowTimer > 0.15;

      if (wasReleased && this.handSculptSystem != null) {
        let sculptor = null;
        for (const e of this.queries.sculptor.entities) { sculptor = e; break; }
        if (sculptor != null) {
          this.handSculptSystem.popUndo(sculptor);
          sculptor.setValue(VoxelSculptor, 'undoDepth', this.handSculptSystem.undoStack.length);
          this.audioSystem?.playUndo();
        }
      }
      this._glowTimer = 0;
    }

    this._bothPinchingLastFrame = bothPinching;
  }
}
