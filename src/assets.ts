/**
 * VoxSculpt — asset manifest.
 * Procedural Object3D prototypes are registered as bare values.
 * URL-based assets use { url, type, name }.
 * deterministic & side-effect free — no World, no DOM.
 */

import { AssetType, defineAssets } from '@iwsdk/core';
import voxelProto from './scene-assets/voxel.scene-asset.js';
import { SWATCH_PROTOTYPES } from './scene-assets/palette.scene-asset.js';
import particleProto from './scene-assets/particle.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

export default defineAssets({
  // ── Voxel block prototype (bare Object3D — procedural) ───────────────────
  voxel: voxelProto,

  // ── Palette swatches (bare Object3Ds, one per color) ─────────────────────
  'swatch-0': SWATCH_PROTOTYPES[0]!,
  'swatch-1': SWATCH_PROTOTYPES[1]!,
  'swatch-2': SWATCH_PROTOTYPES[2]!,
  'swatch-3': SWATCH_PROTOTYPES[3]!,
  'swatch-4': SWATCH_PROTOTYPES[4]!,
  'swatch-5': SWATCH_PROTOTYPES[5]!,
  'swatch-6': SWATCH_PROTOTYPES[6]!,
  'swatch-7': SWATCH_PROTOTYPES[7]!,

  // ── Pop particle prototype (bare Object3D) ────────────────────────────────
  particle: particleProto,

  // ── HUD panel (UIKitML — URL-based) ──────────────────────────────────────
  'voxsculpt-hud': {
    url: publicAssetUrl('ui/voxsculpt-hud.uikitml'),
    type: AssetType.UIKitML,
    name: 'VoxSculpt HUD',
  },
});
