/**
 * VoxSculpt — OnboardingSystem
 *
 * Sequential first-run hint system rendered inside the existing voxsculpt-hud
 * UIKitML panel. Uses a single hint-box div whose hint-text span is updated via
 * setProperties({ text }) — no display toggling, which avoids a Chrome crash
 * in the emulator when sceneUnderstanding is false.
 *
 * Steps (0-indexed):
 *   0 — "Pinch to place your first block"
 *       Advance: totalVoxels >= 1
 *   1 — "Touch a color ball on your left hand to change color"
 *       Advance: active color changed from default
 *   2 — "Throw a block away to delete it. Pinch both hands to undo."
 *       Advance: first delete OR first undo, OR auto after 6 s
 *   3 — "Pinch and hold flat on your desk to set your building surface"
 *       Advance: surface set gesture fires (notified by SurfaceSystem),
 *                OR auto after 6 s
 *
 * Persistence: localStorage key "voxsculpt_onboarded" = "1".
 * URL reset: ?onboarding=1 clears the stored flag before reading it.
 * Skip button (hint-skip): marks done immediately.
 * All localStorage calls are wrapped in try/catch.
 *
 * ECS rules: allocate in init(), never in update().
 * Query entities are Set<Entity> — iterate with for...of or forEach.
 */

import { createSystem, UIKitMLAsset, VisibilityState } from '@iwsdk/core';
import { VoxelSculptor } from '../voxel-components.js';

const STORAGE_KEY = 'voxsculpt_onboarded';
const AUTO_ADVANCE_SEC = 6.0;

/** One message per step. Index = step number. */
const HINT_MESSAGES = [
  'Pinch to place your first block',
  'Touch a color ball on your left hand to change color',
  'Throw a block away to delete it. Pinch both hands to undo.',
  'Pinch and hold flat on your desk to set your building surface',
] as const;

/**
 * How long (seconds) to wait on step 1 before checking colour drift.
 * The palette swatch ring spawns at a fixed world position for the first
 * few async frames; the emulator ray can briefly overlap it and write a
 * non-default colour before wrist tracking begins.  Delaying the check
 * avoids a false advance.
 */
const COLOR_CHECK_DELAY_SEC = 1.0;

export class OnboardingSystem extends createSystem({
  sculptor: { required: [VoxelSculptor] },
}) {
  // ── state ─────────────────────────────────────────────────────────────────
  private _step = 0;
  private _done = false;
  private _started = false;   // true once XR has been entered at least once
  private _autoTimer = 0;
  /** Accumulates time spent on step 1 before the colour-drift check arms. */
  private _colorCheckTimer = 0;
  /** Baseline colour recorded when step 1 begins. Null until then. */
  private _baseColorR: number | null = null;
  private _baseColorG: number | null = null;
  private _baseColorB: number | null = null;
  /**
   * Set to 'show' or 'hide' by the visibilityState callback; consumed on the
   * first update() tick after XR is active so setProperties runs after the
   * first rendered XR frame, not synchronously inside the callback.
   */
  private _pendingPanelInit: 'show' | 'hide' | null = null;

  // Notifications from peer systems (set by SurfaceSystem / UndoSystem)
  /** Call when a delete occurs to advance step 2. */
  notifyDelete(): void { this._onAction(); }
  /** Call when undo occurs to advance step 2. */
  notifyUndo(): void { this._onAction(); }
  /** Call when surface is set to advance step 3. */
  notifySurface(): void { if (this._step === 3) this._advance(); }

  private _panel: UIKitMLAsset | null = null;

  init(): void {
    // URL reset: ?onboarding=1 clears saved progress
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('onboarding') === '1') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* non-critical */ }

    // Already completed — flag it; the panel will be hidden on first XR entry
    if (this._isComplete()) {
      this._done = true;
    }

    // Resolve the panel once XR becomes active (panel is hidden in 2D mode).
    // We deliberately do NOT call setProperties here — the XR session is not
    // yet rendering its first frame and doing so can trigger a renderer resize
    // that exits the session.  Instead we set a flag and let update() fire the
    // actual panel writes one tick later.
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.NonImmersive) return;
        console.log('[OnboardingSystem] visibilityState → XR active; _done=%s _started=%s', this._done, this._started);
        this._ensurePanel();   // safe: only resolves the object reference, no setProperties
        if (this._done) {
          this._pendingPanelInit = 'hide';
          return;
        }
        if (!this._started) {
          this._started = true;
          this._pendingPanelInit = 'show';
        }
      }),
    );
  }

  update(delta: number): void {
    // Flush any panel work deferred from the visibilityState callback.
    // This runs on the first update() tick after XR is active, guaranteeing
    // at least one rendered frame has committed before we touch the panel.
    if (this._pendingPanelInit !== null) {
      const pending = this._pendingPanelInit;
      this._pendingPanelInit = null;
      if (pending === 'hide') {
        this._hideHintBox();
      } else {
        this._showStep(0);
      }
    }

    if (this._done || !this._started) return;

    // ── Step advancement via sculpting state ─────────────────────────────────
    let sculptorEntity = null;
    for (const e of this.queries.sculptor.entities) { sculptorEntity = e; break; }

    if (sculptorEntity != null) {
      if (this._step === 0) {
        const total = sculptorEntity.getValue(VoxelSculptor, 'totalVoxels') ?? 0;
        if (total >= 1) { this._advance(); return; }
      }

      if (this._step === 1) {
        // Record the colour that was active when step 1 started (first frame
        // we see _step === 1 with a live sculptor entity).  All subsequent
        // drift checks compare against this snapshot, not a hard-coded default.
        if (this._baseColorR === null) {
          this._baseColorR = sculptorEntity.getValue(VoxelSculptor, 'activeColorR') ?? 0;
          this._baseColorG = sculptorEntity.getValue(VoxelSculptor, 'activeColorG') ?? 0;
          this._baseColorB = sculptorEntity.getValue(VoxelSculptor, 'activeColorB') ?? 0;
        }

        // Delay the colour-drift check for COLOR_CHECK_DELAY_SEC seconds.
        // The palette swatch ring spawns at a fixed world position for the
        // first few async frames; the emulator ray can briefly overlap it and
        // write a non-default colour before wrist tracking begins.
        this._colorCheckTimer += delta;
        if (this._colorCheckTimer >= COLOR_CHECK_DELAY_SEC) {
          const cr = sculptorEntity.getValue(VoxelSculptor, 'activeColorR') ?? 0;
          const cg = sculptorEntity.getValue(VoxelSculptor, 'activeColorG') ?? 0;
          const cb = sculptorEntity.getValue(VoxelSculptor, 'activeColorB') ?? 0;
          const drift = Math.abs(cr - this._baseColorR!)
            + Math.abs(cg - this._baseColorG!)
            + Math.abs(cb - this._baseColorB!);
          if (drift > 0.05) { this._advance(); return; }
        }
      }
    }

    // Steps 2 and 3 have auto-advance fallback timers
    if (this._step === 2 || this._step === 3) {
      this._autoTimer += delta;
      if (this._autoTimer >= AUTO_ADVANCE_SEC) {
        this._advance();
      }
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _onAction(): void {
    if (this._step === 2) this._advance();
  }

  /** Update the shared hint-text span to the message for this step. No display toggling. */
  private _showStep(step: number): void {
    if (this._panel == null) return;
    this._panel.getElementById('hint-text')?.setProperties({ text: HINT_MESSAGES[step] });
    this._step = step;
    this._autoTimer = 0;
    this._colorCheckTimer = 0;  // reset delay whenever the step changes
    // Clear the colour baseline so it is re-sampled on the first frame of step 1
    this._baseColorR = null;
    this._baseColorG = null;
    this._baseColorB = null;
  }

  private _advance(): void {
    const next = this._step + 1;
    if (next >= HINT_MESSAGES.length) {
      this._markDone();
    } else {
      this._showStep(next);
    }
  }

  /** Hide the single hint-box container when onboarding is complete. */
  private _hideHintBox(): void {
    console.log('[OnboardingSystem] _hideHintBox called; panel=%s', this._panel != null ? 'resolved' : 'null');
    if (this._panel == null) this._ensurePanel();
    this._panel?.getElementById('hint-box')?.setProperties({ display: 'none' });
  }

  private _markDone(): void {
    this._done = true;
    this._hideHintBox();
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch { /* private browsing */ }
  }

  private _ensurePanel(): void {
    if (this._panel != null) return;
    this._panel = this.world.getSceneObject<UIKitMLAsset>('voxsculpt-hud') ?? null;
    if (this._panel == null) return;

    // Wire Skip button
    const skipBtn = this._panel.getElementById('hint-skip');
    if (skipBtn != null) {
      const onSkip = () => this._markDone();
      skipBtn.addEventListener('click', onSkip);
      this.cleanupFuncs.push(() => skipBtn.removeEventListener('click', onSkip));
    }
  }

  private _isComplete(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
