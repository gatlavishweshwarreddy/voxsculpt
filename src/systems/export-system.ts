/**
 * VoxSculpt — ExportSystem
 *
 * Exports the current voxel sculpture as a .glTF 2.0 file.
 * Triggered by HUDSystem calling exportSystem.triggerExport().
 * Uses dynamic import so the GLTFExporter bundle loads only when needed.
 *
 * Query entities are Set<Entity>.
 */

import {
  BoxGeometry,
  Color,
  createSystem,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from '@iwsdk/core';
import { VoxelBlock } from '../voxel-components.js';
import { gridToWorld, VOXEL_SIZE } from '../voxel-constants.js';

export class ExportSystem extends createSystem({
  voxels: { required: [VoxelBlock] },
}) {
  private _exportRequested = false;

  triggerExport(): void {
    this._exportRequested = true;
  }

  update(): void {
    if (!this._exportRequested) return;
    this._exportRequested = false;
    this._doExport();
  }

  private _doExport(): void {
    const placed: typeof this.queries.voxels.entities extends Set<infer T> ? T[] : never[] = [];
    this.queries.voxels.entities.forEach((e) => {
      if (!e.getValue(VoxelBlock, 'isPreview')) placed.push(e);
    });

    if (placed.length === 0) return;

    const scene = new Group();
    scene.name = 'VoxSculpt_Export';

    // Shared geometry — GLTFExporter deduplicates it
    const geo = new BoxGeometry(VOXEL_SIZE * 0.92, VOXEL_SIZE * 0.92, VOXEL_SIZE * 0.92);

    for (const entity of placed) {
      const colorView = entity.getVectorView(VoxelBlock, 'color');
      const gx = entity.getValue(VoxelBlock, 'gridX') ?? 0;
      const gy = entity.getValue(VoxelBlock, 'gridY') ?? 0;
      const gz = entity.getValue(VoxelBlock, 'gridZ') ?? 0;

      const mat = new MeshStandardMaterial({
        color: new Color(colorView[0] ?? 0.4, colorView[1] ?? 0.8, colorView[2] ?? 1.0),
        roughness: 0.3,
        metalness: 0.1,
      });

      const mesh = new Mesh(geo, mat);
      mesh.position.set(gridToWorld(gx), gridToWorld(gy), gridToWorld(gz));
      scene.add(mesh);
    }

    import('three/addons/exporters/GLTFExporter.js')
      .then(({ GLTFExporter }) => {
        const exporter = new GLTFExporter();
        exporter.parse(
          scene,
          (gltfData) => {
            const blob = new Blob(
              [JSON.stringify(gltfData)],
              { type: 'model/gltf+json' },
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `voxsculpt-${Date.now()}.gltf`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          },
          (err) => console.error('[VoxSculpt] Export failed:', err),
          { binary: false },
        );
      })
      .catch((err) => console.error('[VoxSculpt] GLTFExporter load failed:', err));
  }
}
