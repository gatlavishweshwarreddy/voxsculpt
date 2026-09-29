/**
 * VoxSculpt — procedural voxel block prototype.
 *
 * A single BoxGeometry with a slightly inset border bevel, shared across
 * all placed voxel instances. Per-instance color is applied by
 * HandSculptSystem by assigning a new MeshStandardMaterial to the clone
 * (clones share the geometry, but each gets its own material).
 *
 * Exported as a parentless Object3D so the asset manifest can register it.
 * Rules from src/AGENTS.md:
 *   - deterministic, side-effect free
 *   - no DOM, no World, no parenting after export
 *   - geometry and materials are shared across placed clones
 */

import {
  BoxGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
} from '@iwsdk/core';

/** Size of a single voxel in meters. Exported so systems share the constant. */
export const VOXEL_SIZE = 0.08;

/** How far the edge highlight is inset from the face (as a UV fraction). */
const EDGE_INSET = 0.92;

function buildVoxelPrototype(): Group {
  const group = new Group();

  // Main block — slightly smaller than the grid cell so gaps appear between voxels
  const blockGeo = new BoxGeometry(
    VOXEL_SIZE * EDGE_INSET,
    VOXEL_SIZE * EDGE_INSET,
    VOXEL_SIZE * EDGE_INSET,
  );

  const blockMat = new MeshStandardMaterial({
    color: 0x66ccff,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 1.0,
  });

  const blockMesh = new Mesh(blockGeo, blockMat);
  blockMesh.name = 'voxel-face';
  blockMesh.castShadow = false;
  blockMesh.receiveShadow = false;
  group.add(blockMesh);

  // Thin edge wire highlight — gives the block a satisfying LEGO-like outline
  const edgeGeo = new EdgesGeometry(
    new BoxGeometry(VOXEL_SIZE * EDGE_INSET, VOXEL_SIZE * EDGE_INSET, VOXEL_SIZE * EDGE_INSET),
  );
  const edgeMat = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
  const edges = new LineSegments(edgeGeo, edgeMat);
  edges.name = 'voxel-edge';
  group.add(edges);

  group.name = 'voxel-proto';
  return group;
}

export default buildVoxelPrototype();
