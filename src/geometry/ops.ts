import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { emptyGeometry, fromBufferGeometry, toBufferGeometry, type GeometryData } from './GeometryData';
import { defaultMaterialSpec } from '@/material/MaterialData';

/** Preserve material grouping across an op that keeps vertex order/count (transform/deform/mirror). */
function carryMaterials(out: GeometryData, src: GeometryData): GeometryData {
  if (src.materials && src.groups) {
    out.groups = src.groups;
    out.materials = src.materials;
  }
  return out;
}

/**
 * Apply a 4x4 transform to geometry (positions + normals), returning new GeometryData.
 * Reuses three's BufferGeometry math so it stays consistent with the runtime.
 */
export function transformGeometry(data: GeometryData, matrix: THREE.Matrix4): GeometryData {
  const geom = toBufferGeometry(data);
  geom.applyMatrix4(matrix);
  const out = fromBufferGeometry(geom);
  geom.dispose();
  return carryMaterials(out, data);
}

export type Axis = 'x' | 'y' | 'z';

/**
 * Apply a per-vertex function to positions, returning new GeometryData with normals
 * recomputed. The input is never mutated (its buffers are copied), so cached upstream
 * geometry stays intact. `fn` may read the vertex normal (for displacement along it).
 */
export function deformGeometry(
  data: GeometryData,
  fn: (p: THREE.Vector3, normal: THREE.Vector3, i: number) => void,
): GeometryData {
  if (data.metadata.triCount === 0) return data;
  const positions = new Float32Array(data.positions);
  const normals = data.normals;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const count = positions.length / 3;
  for (let i = 0; i < count; i++) {
    p.set(positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!);
    if (normals) n.set(normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!);
    else n.set(0, 0, 0);
    fn(p, n, i);
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (data.indices) geom.setIndex(new THREE.BufferAttribute(data.indices.slice(), 1));
  if (data.uvs) geom.setAttribute('uv', new THREE.BufferAttribute(data.uvs.slice(), 2));
  geom.computeVertexNormals();
  const out = fromBufferGeometry(geom);
  geom.dispose();
  return carryMaterials(out, data);
}

/** Read/write a vector's coordinate by axis. */
export function axisIndex(axis: Axis): 0 | 1 | 2 {
  return axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
}

/** Merge several geometries into one. Empty inputs are skipped. When any input carries a
 *  material, the result is a multi-material geometry (material groups) so assembled parts keep
 *  their own appearance; otherwise it's a plain single merge. */
export function mergeGeometriesData(list: GeometryData[]): GeometryData {
  const nonEmpty = list.filter((d) => d.metadata.triCount > 0);
  if (nonEmpty.length === 0) return emptyGeometry();
  if (nonEmpty.length === 1) return nonEmpty[0]!;
  if (nonEmpty.some((d) => d.materials && d.materials.length)) return mergeWithMaterials(nonEmpty);
  try {
    const geoms = nonEmpty.map(toBufferGeometry);
    const merged = mergeGeometries(geoms, false);
    geoms.forEach((g) => g.dispose());
    if (!merged) return emptyGeometry();
    const out = fromBufferGeometry(merged);
    merged.dispose();
    return out;
  } catch {
    return emptyGeometry();
  }
}

/** Merge geometries that carry materials into one multi-material geometry. Uses three's
 *  group merge (one group per input, materialIndex = input order) so it stays in lock-step with
 *  the code generator. One material per part (a nested assembly collapses to its first material). */
function mergeWithMaterials(list: GeometryData[]): GeometryData {
  const geoms = list.map(toBufferGeometry);
  try {
    const merged = mergeGeometries(geoms, true);
    geoms.forEach((g) => g.dispose());
    if (!merged) return emptyGeometry();
    const out = fromBufferGeometry(merged);
    out.groups = merged.groups.map((g) => ({
      start: g.start,
      count: g.count,
      materialIndex: g.materialIndex ?? 0,
    }));
    out.materials = list.map((d) => (d.materials && d.materials[0]) || defaultMaterialSpec());
    merged.dispose();
    return out;
  } catch {
    geoms.forEach((g) => g.dispose());
    return emptyGeometry();
  }
}

/** Mirror geometry across the plane normal to `axis`, fixing triangle winding. */
export function mirrorGeometry(data: GeometryData, axis: Axis): GeometryData {
  const geom = toBufferGeometry(data);
  geom.applyMatrix4(
    new THREE.Matrix4().makeScale(axis === 'x' ? -1 : 1, axis === 'y' ? -1 : 1, axis === 'z' ? -1 : 1),
  );
  const out = fromBufferGeometry(geom);
  geom.dispose();
  // Negative scale flips face orientation; reverse winding so normals stay consistent.
  if (out.indices) {
    for (let i = 0; i < out.indices.length; i += 3) {
      const t = out.indices[i]!;
      out.indices[i] = out.indices[i + 2]!;
      out.indices[i + 2] = t;
    }
  }
  return carryMaterials(out, data);
}

/** Build a TRS matrix from translation, rotation (radians), and scale. */
export function composeMatrix(
  translate: [number, number, number],
  rotationRad: [number, number, number],
  scale: [number, number, number],
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(translate[0], translate[1], translate[2]),
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rotationRad[0], rotationRad[1], rotationRad[2]),
    ),
    new THREE.Vector3(scale[0], scale[1], scale[2]),
  );
}
