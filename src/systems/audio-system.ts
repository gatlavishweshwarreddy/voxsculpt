/**
 * VoxSculpt — AudioSystem
 *
 * Procedural sound effects using the Web Audio API — no external files.
 * All sounds are synthesised from oscillators and noise buffers each time
 * they are triggered, so the AudioContext is the only dependency.
 *
 * Public API (called by other systems via injection):
 *   audioSystem.playPlace()       — soft satisfying "pop" on voxel placement
 *   audioSystem.playDelete()      — short "whoosh" on voxel deletion
 *   audioSystem.playColorPick()   — bright "chime" on palette selection
 *   audioSystem.playUndo()        — reversed "pop" on undo
 *
 * Design rules:
 *   • AudioContext is created lazily on first user interaction (browser policy).
 *   • All synthesis is done with the Web Audio graph — no allocations in update().
 *   • Sounds are short (< 300 ms) so polyphony is self-limiting.
 *   • Volume is conservative so it complements the AR experience.
 *
 * ECS pattern: createSystem({}) with no queries — pure side-effect system.
 */

import { createSystem, VisibilityState } from '@iwsdk/core';

export class AudioSystem extends createSystem({}) {
  private _ctx: AudioContext | null = null;
  private _master: GainNode | null = null;

  /** Call once; safe to call multiple times. */
  private _ensureCtx(): AudioContext | null {
    if (this._ctx != null) return this._ctx;
    try {
      this._ctx = new AudioContext();
      this._master = this._ctx.createGain();
      this._master.gain.value = 0.55;
      this._master.connect(this._ctx.destination);
    } catch {
      return null;
    }
    return this._ctx;
  }

  init(): void {
    // Resume context on XR entry (gesture-gated policy)
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state !== VisibilityState.NonImmersive) {
          const ctx = this._ensureCtx();
          if (ctx?.state === 'suspended') ctx.resume();
        }
      }),
    );
  }

  update(): void {
    // No per-frame work — all audio is event-driven.
  }

  // ── Public sound triggers ─────────────────────────────────────────────────

  /** Soft satisfying "pop" — placement confirmation. */
  playPlace(): void {
    const ctx = this._ensureCtx();
    if (ctx == null || this._master == null) return;
    const t = ctx.currentTime;

    // Sine oscillator with fast attack, short decay
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.12);
    env.gain.setValueAtTime(0.0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(env);
    env.connect(this._master);
    osc.start(t);
    osc.stop(t + 0.2);

    // Subtle click transient layered on top
    this._click(ctx, t, 0.18);
  }

  /** Short "whoosh" — deletion. */
  playDelete(): void {
    const ctx = this._ensureCtx();
    if (ctx == null || this._master == null) return;
    const t = ctx.currentTime;

    // Band-pass filtered noise swept downward
    const buf = this._noiseBuffer(ctx, 0.25);
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(1200, t);
    bpf.frequency.exponentialRampToValueAtTime(180, t + 0.22);
    bpf.Q.value = 2.5;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.6, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    src.connect(bpf);
    bpf.connect(env);
    env.connect(this._master);
    src.start(t);
    src.stop(t + 0.26);
  }

  /** Bright ascending "chime" — color selection. */
  playColorPick(): void {
    const ctx = this._ensureCtx();
    if (ctx == null || this._master == null) return;
    const t = ctx.currentTime;

    // Two detuned sine partials rising in pitch — bell-like
    const freqs = [880, 1108];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, t + 0.1);
      env.gain.setValueAtTime(0.0, t);
      env.gain.linearRampToValueAtTime(0.28 - i * 0.06, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(env);
      env.connect(this._master!);
      osc.start(t + i * 0.018);
      osc.stop(t + 0.3);
    });
  }

  /** Reversed "pop" — time-reversed envelope, lower pitch. */
  playUndo(): void {
    const ctx = this._ensureCtx();
    if (ctx == null || this._master == null) return;
    const t = ctx.currentTime;

    // Oscillator with reversed envelope: slow attack → fast cut
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(360, t + 0.14);
    env.gain.setValueAtTime(0.001, t);
    env.gain.exponentialRampToValueAtTime(0.45, t + 0.13);
    env.gain.linearRampToValueAtTime(0.0, t + 0.16);
    osc.connect(env);
    env.connect(this._master);
    osc.start(t);
    osc.stop(t + 0.18);

    // Noise tail
    const buf = this._noiseBuffer(ctx, 0.12);
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = buf;
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0.12, t);
    nEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    nSrc.connect(nEnv);
    nEnv.connect(this._master);
    nSrc.start(t);
    nSrc.stop(t + 0.13);
  }

  // ── Synthesis helpers ─────────────────────────────────────────────────────

  /** Short stereo white-noise AudioBuffer. */
  private _noiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const sr = ctx.sampleRate;
    const len = Math.ceil(sr * durationSec);
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  /** Tiny transient click — adds physicality to pop sounds. */
  private _click(ctx: AudioContext, t: number, gain: number): void {
    if (this._master == null) return;
    const buf = this._noiseBuffer(ctx, 0.004);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.004);
    src.connect(env);
    env.connect(this._master);
    src.start(t);
    src.stop(t + 0.005);
  }
}
