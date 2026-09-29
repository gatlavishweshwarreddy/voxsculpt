/**
 * VoxSculpt — procedural feedback particle prototype.
 *
 * A small emissive sphere used for the "pop" effect on voxel place/delete.
 * Exported as a parentless Group; VoxelFeedbackSystem clones it, animates
 * it, then disposes the clone after the effect completes.
 *
 * deterministic, side-effect free — no World, no DOM.
 */

import { Group, Mesh, MeshStandardMaterial, SphereGeometry } from '@iwsdk/core';

function buildParticlePrototype(): Group {
  const geo = new SphereGeometry(0.012, 8, 6);
  const mat = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 1.0,
    roughness: 0.0,
    metalness: 0.0,
  });
  const mesh = new Mesh(geo, mat);
  mesh.name = 'particle';
  const group = new Group();
  group.name = 'particle-proto';
  group.add(mesh);
  return group;
}

export default buildParticlePrototype();
