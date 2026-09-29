/**
 * VoxSculpt — procedural color-palette swatch prototypes.
 *
 * Exports an array of swatch meshes (one per palette color), each a
 * small sphere with a pre-assigned MeshStandardMaterial. Systems clone
 * individual swatches and register them as ColorSwatch entities.
 *
 * deterministic, side-effect free — no World, no DOM.
 */

import { Group, Mesh, MeshStandardMaterial, SphereGeometry } from '@iwsdk/core';

export interface PaletteColor {
  r: number;
  g: number;
  b: number;
  hex: number;
  label: string;
}

/**
 * The 8-color palette. Colors are picked for maximum visual contrast in
 * mixed-reality passthrough: vivid, but not eye-straining at 72 fps.
 */
export const PALETTE_COLORS: PaletteColor[] = [
  { r: 0.20, g: 0.60, b: 1.00, hex: 0x3399ff, label: 'Sky'      },
  { r: 0.15, g: 0.85, b: 0.55, hex: 0x26d98c, label: 'Mint'     },
  { r: 1.00, g: 0.85, b: 0.10, hex: 0xffd91a, label: 'Sun'      },
  { r: 1.00, g: 0.35, b: 0.25, hex: 0xff5940, label: 'Flame'    },
  { r: 0.75, g: 0.30, b: 1.00, hex: 0xbf4dff, label: 'Violet'   },
  { r: 1.00, g: 0.55, b: 0.10, hex: 0xff8c1a, label: 'Amber'    },
  { r: 0.95, g: 0.95, b: 0.95, hex: 0xf2f2f2, label: 'White'    },
  { r: 0.15, g: 0.15, b: 0.20, hex: 0x262633, label: 'Obsidian' },
];

/** Radius of the swatch sphere in meters */
export const SWATCH_RADIUS = 0.025;

/** Radius of the palette ring the swatches orbit */
export const PALETTE_RING_RADIUS = 0.12;

function buildSwatchPrototype(color: PaletteColor): Group {
  const geo = new SphereGeometry(SWATCH_RADIUS, 16, 12);
  const mat = new MeshStandardMaterial({
    color: color.hex,
    roughness: 0.25,
    metalness: 0.15,
    emissive: color.hex,
    emissiveIntensity: 0.15,
  });
  const mesh = new Mesh(geo, mat);
  mesh.name = 'swatch-sphere';
  const group = new Group();
  group.name = `swatch-${color.label.toLowerCase()}`;
  group.add(mesh);
  return group;
}

/**
 * One prototype group per palette entry, in PALETTE_COLORS order.
 * The asset manifest registers each under `swatch-N`.
 */
export const SWATCH_PROTOTYPES: Group[] = PALETTE_COLORS.map(buildSwatchPrototype);
