/**
 * VoxSculpt — HUDSystem
 *
 * Manages the floating minimal HUD panel (voxsculpt-hud.uikitml):
 *   • Shows voxel count and undo depth from VoxelSculptor
 *   • "Export" button triggers ExportSystem
 *   • "Clear" button disposes all voxels
 *
 * Query entities are Set<Entity>.
 */

import {
  createSystem,
  UIKitMLAsset,
  VisibilityState,
} from '@iwsdk/core';
import { VoxelBlock, VoxelSculptor } from '../voxel-components.js';
import type { ExportSystem } from './export-system.js';

const HUD_REFRESH_RATE = 0.25;

export class HUDSystem extends createSystem({
  sculptor: { required: [VoxelSculptor] },
  voxels: { required: [VoxelBlock] },
}) {
  exportSystem: ExportSystem | null = null;

  private _refreshTimer = 0;
  private _panel: UIKitMLAsset | null = null;
  private _lastVoxelCount = -1;
  private _lastUndoDepth = -1;

  init(): void {
    this._panel = this.world.getSceneObject<UIKitMLAsset>('voxsculpt-hud') ?? null;
    if (this._panel == null) return;

    const exportBtn = this._panel.getElementById('btn-export');
    if (exportBtn != null) {
      const onExport = () => this.exportSystem?.triggerExport();
      exportBtn.addEventListener('click', onExport);
      this.cleanupFuncs.push(() => exportBtn.removeEventListener('click', onExport));
    }

    const clearBtn = this._panel.getElementById('btn-clear');
    if (clearBtn != null) {
      const onClear = () => this._clearAll();
      clearBtn.addEventListener('click', onClear);
      this.cleanupFuncs.push(() => clearBtn.removeEventListener('click', onClear));
    }

    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        const inXR = state !== VisibilityState.NonImmersive;
        this._panel?.getElementById('hud-root')?.setProperties({
          display: inXR ? 'flex' : 'none',
        });
      }),
    );
  }

  update(delta: number): void {
    this._refreshTimer += delta;
    if (this._refreshTimer < HUD_REFRESH_RATE) return;
    this._refreshTimer = 0;

    if (this._panel == null) return;

    let sculptor = null;
    for (const e of this.queries.sculptor.entities) { sculptor = e; break; }
    if (sculptor == null) return;

    const count = sculptor.getValue(VoxelSculptor, 'totalVoxels') ?? 0;
    const undo = sculptor.getValue(VoxelSculptor, 'undoDepth') ?? 0;

    if (count !== this._lastVoxelCount) {
      this._lastVoxelCount = count;
      this._panel.getElementById('txt-count')?.setProperties({ text: `${count} voxels` });
    }

    if (undo !== this._lastUndoDepth) {
      this._lastUndoDepth = undo;
      this._panel.getElementById('btn-undo-hint')?.setProperties({
        display: undo > 0 ? 'flex' : 'none',
      });
    }
  }

  private _clearAll(): void {
    const toDispose: (typeof this.queries.voxels.entities extends Set<infer T> ? T : never)[] = [];
    this.queries.voxels.entities.forEach((e) => {
      if (!e.getValue(VoxelBlock, 'isPreview')) toDispose.push(e);
    });
    for (const entity of toDispose) entity.dispose();

    let sculptor = null;
    for (const e of this.queries.sculptor.entities) { sculptor = e; break; }
    if (sculptor != null) {
      sculptor.setValue(VoxelSculptor, 'totalVoxels', 0);
      sculptor.setValue(VoxelSculptor, 'undoDepth', 0);
    }
  }
}
