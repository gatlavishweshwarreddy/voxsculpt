/**
 * VoxSculpt — SurfaceSystem
 *
 * Establishes the working surface Y height for the voxel grid.
 *
 * Source priority:
 *   1. XRMesh with semanticLabel 'table' or 'desk' closest below head.
 *   2. Any horizontal XRPlane closest below head (0.3–1.2 m below head Y).
 *   3. Both-hands-pinch gesture (1 s hold) as a universal fallback.
 *
 * Rules:
 *   - Only accepts surfaces between 0.2 m and 1.5 m world-Y.
 *   - Prefers 'table'/'desk' semantic labels over generic planes.
 *   - Auto-detected planes/meshes apply ONLY when totalVoxels === 0.
 *     Once voxels exist, only the explicit both-hands gesture can
 *     reposition the grid (and it shifts all existing voxels with it).
 *   - Calls onboardingSystem.notifySurface() when set by gesture.
 *   - Never crashes if no planes or meshes exist.
 *   - Does not interfere with single-hand block placement.
 *
 * Grid base:
 *   A LineSegments grid is drawn at surfaceY, showing the build footprint.
 *
 * ECS rules: allocate in init(), never in update().
 * Queries return Set<Entity>.
 */

import {
  BufferGeometry,
  Color,
  createSystem,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  Vector3,
  XRMesh,
  XRPlane,
} from '@iwsdk/core';
import type { OnboardingSystem } from './onboarding-system.js';
import type { HandSculptSystem } from './hand-sculpt-system.js';
import { GRID_HALF_SIZE, VOXEL_SIZE } from '../voxel-constants.js';
import { VoxelSculptor } from '../voxel-components.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Preferred semantic labels for surface detection (XRMesh). */
const PREFERRED_LABELS = new Set(['table', 'desk', 'TABLE', 'DESK']);
/** Absolute world-Y bounds for valid surfaces. */
const SURFACE_MIN_Y = 0.20;
const SURFACE_MAX_Y = 1.50;
/** How far below the player's head a surface must be (min/max). */
const BELOW_HEAD_MIN = 0.30;
const BELOW_HEAD_MAX = 1.20;
/** Both-hands pinch must be held this many seconds to set surface. */
const GESTURE_HOLD_SEC = 1.0;
/** Pinch commit threshold — shared constant, must match HandSculptSystem. */
const PINCH_COMMIT = 0.85;
/** Minimum change in Y (meters) before the grid is re-placed. */
const CHANGE_THRESHOLD = VOXEL_SIZE * 0.5;

// ── Grid mesh ─────────────────────────────────────────────────────────────────

function buildGridLineSegments(): LineSegments {
  const half = GRID_HALF_SIZE * VOXEL_SIZE;
  const divs = GRID_HALF_SIZE * 2;
  const step = VOXEL_SIZE;
  const verts: number[] = [];

  for (let i = 0; i <= divs; i++) {
    const t = -half + i * step;
    verts.push(-half, 0, t, half, 0, t); // X-parallel
    verts.push(t, 0, -half, t, 0, half); // Z-parallel
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(verts, 3));
  const mat = new LineBasicMaterial({
    color: new Color(0.45, 0.65, 1.0),
    transparent: true,
    opacity: 0.20,
  });
  const ls = new LineSegments(geo, mat);
  ls.name = 'surface-grid';
  return ls;
}

// ── System ────────────────────────────────────────────────────────────────────

export class SurfaceSystem extends createSystem({
  planes:   { required: [XRPlane] },
  meshes:   { required: [XRMesh]  },
  sculptor: { required: [VoxelSculptor] },
}) {
  /** Current surface world-Y. Read by HandSculptSystem each frame. */
  surfaceY = 0;

  // ── injected ──────────────────────────────────────────────────────────────
  onboardingSystem: OnboardingSystem | null = null;
  handSculptSystem: HandSculptSystem | null = null;

  // ── pre-allocated ─────────────────────────────────────────────────────────
  private _headPos   = new Vector3();
  private _leftPos   = new Vector3();
  private _rightPos  = new Vector3();

  // ── state ─────────────────────────────────────────────────────────────────
  private _gridMesh: LineSegments | null = null;
  /** Whether the surface has been committed (locked from XRMesh/Plane updates). */
  private _lockedByGesture = false;
  private _holdTimer = 0;

  init(): void {
    // Place an initial grid at Y=0 (matches previous behaviour)
    this._placeGrid(0);
  }

  update(delta: number): void {
    // Probe planes/meshes only until the gesture has locked the surface
    if (!this._lockedByGesture) {
      this._tryDetectedSurfaces();
    }
    // Gesture is always available as an explicit override
    this._checkBothHandsGesture(delta);
  }

  // ── Detected surface sources ──────────────────────────────────────────────

  private _tryDetectedSurfaces(): void {
    this.player.head.updateWorldMatrix(true, false);
    this._headPos.setFromMatrixPosition(this.player.head.matrixWorld);
    const headY = this._headPos.y;

    let bestY: number | null = null;
    let bestScore = -1; // higher = preferred; 2=labelled mesh, 1=plane, 0=unlabelled mesh

    // ── XRMesh (labelled geometry, highest trust) ─────────────────────────
    this.queries.meshes.entities.forEach((entity) => {
      if (!entity.getValue(XRMesh, 'isBounded3D')) return;
      const label = entity.getValue(XRMesh, 'semanticLabel') ?? '';
      const maxVec = entity.getVectorView(XRMesh, 'max'); // Float32Array [x,y,z]
      const surfY = maxVec[1] ?? 0; // top face of the mesh

      if (!this._inValidRange(surfY, headY)) return;

      const score = PREFERRED_LABELS.has(label) ? 2 : 0;
      if (score > bestScore || (score === bestScore && bestY != null && Math.abs(surfY - (headY - 0.75)) < Math.abs(bestY - (headY - 0.75)))) {
        bestScore = score;
        bestY = surfY;
      }
    });

    // ── XRPlane (orientation-only, lower trust than labelled mesh) ────────
    if (bestScore < 2) {
      this.queries.planes.entities.forEach((entity) => {
        const obj = entity.object3D;
        if (obj == null) return;
        obj.updateWorldMatrix(true, false);
        const planeY = obj.position.y;
        if (!this._inValidRange(planeY, headY)) return;

        const score = 1;
        if (score > bestScore || (score === bestScore && bestY != null && Math.abs(planeY - (headY - 0.75)) < Math.abs(bestY - (headY - 0.75)))) {
          bestScore = score;
          bestY = planeY;
        }
      });
    }

    if (bestY != null) {
      this._commitSurface(bestY, false);
    }
  }

  // ── Both-hands pinch gesture ──────────────────────────────────────────────

  private _checkBothHandsGesture(delta: number): void {
    const hands = this.world.input.xr?.visualAdapters?.hand;
    if (hands == null) { this._holdTimer = 0; return; }

    // Pinch strength per hand (same emulator fallback used in HandSculptSystem)
    const gpLeft  = this.world.input.xr.gamepads['left'];
    const gpRight = this.world.input.xr.gamepads['right'];
    const rawL = hands.left?.getPinchStrength?.()  ?? 0;
    const rawR = hands.right?.getPinchStrength?.() ?? 0;
    const strengthL = rawL > 0 ? rawL : ((gpLeft?.getSelecting()  ?? false) ? 1.0 : 0.0);
    const strengthR = rawR > 0 ? rawR : ((gpRight?.getSelecting() ?? false) ? 1.0 : 0.0);
    const bothPinching = strengthL >= PINCH_COMMIT && strengthR >= PINCH_COMMIT;

    if (!bothPinching) { this._holdTimer = 0; return; }

    // Both hands must be at desk height
    const leftRay  = this.player.raySpaces.left;
    const rightRay = this.player.raySpaces.right;
    if (leftRay == null || rightRay == null) { this._holdTimer = 0; return; }

    leftRay.updateWorldMatrix(true, false);
    rightRay.updateWorldMatrix(true, false);
    this._leftPos.setFromMatrixPosition(leftRay.matrixWorld);
    this._rightPos.setFromMatrixPosition(rightRay.matrixWorld);

    this.player.head.updateWorldMatrix(true, false);
    this._headPos.setFromMatrixPosition(this.player.head.matrixWorld);

    const midY = (this._leftPos.y + this._rightPos.y) * 0.5;
    if (!this._inValidRange(midY, this._headPos.y)) {
      this._holdTimer = 0;
      return;
    }

    this._holdTimer += delta;
    if (this._holdTimer < GESTURE_HOLD_SEC) return;

    this._holdTimer = 0;
    this._lockedByGesture = true;
    this._commitSurface(midY, true);
    this.onboardingSystem?.notifySurface();
  }

  // ── Surface commit ────────────────────────────────────────────────────────

  private _commitSurface(y: number, fromGesture: boolean): void {
    // Snap to nearest grid step
    const snapped = Math.round(y / VOXEL_SIZE) * VOXEL_SIZE;

    if (Math.abs(snapped - this.surfaceY) < CHANGE_THRESHOLD) return;

    // Read voxel count from sculptor singleton
    let totalVoxels = 0;
    for (const e of this.queries.sculptor.entities) {
      totalVoxels = e.getValue(VoxelSculptor, 'totalVoxels') ?? 0;
      break;
    }

    // Auto-detected surfaces only apply before any voxels have been placed.
    // Once sculpting has begun, only the explicit both-hands gesture may
    // reposition the grid (it shifts all existing voxels with it).
    if (totalVoxels > 0 && !fromGesture) return;

    if (totalVoxels > 0 && fromGesture) {
      // Voxels exist — shift them all via HandSculptSystem
      const dy = snapped - this.surfaceY;
      this.handSculptSystem?.shiftGridY(dy);
    }

    this.surfaceY = snapped;
    if (this._gridMesh != null) {
      this._gridMesh.position.y = snapped;
    }
  }

  private _placeGrid(y: number): void {
    if (this._gridMesh != null) {
      this.world.scene.remove(this._gridMesh);
    }
    this._gridMesh = buildGridLineSegments();
    this._gridMesh.position.set(0, y, 0);
    this.world.scene.add(this._gridMesh);
    this.surfaceY = y;
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private _inValidRange(surfY: number, headY: number): boolean {
    if (surfY < SURFACE_MIN_Y || surfY > SURFACE_MAX_Y) return false;
    const below = headY - surfY;
    return below >= BELOW_HEAD_MIN && below <= BELOW_HEAD_MAX;
  }
}
