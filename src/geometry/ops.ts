import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { emptyGeometry, fromBufferGeometry, toBufferGeometry, type GeometryData } from './GeometryData';

/**
 * Apply a 4x4 transform to geometry (positions + normals), returning new GeometryData.
 * Reuses three's BufferGeometry math so it stays consistent with the runtime.
 */
export function transformGeometry(data: GeometryData, matrix: THREE.Matrix4): GeometryData {
  const geom = toBufferGeometry(data);
  geom.applyMatrix4(matrix);
  const out = fromBufferGeometry(geom);
  geom.dispose();
  return out;
}

export type Axis = 'x' | 'y' | 'z';

/** Merge several geometries into one. Empty inputs are skipped. */
export function mergeGeometriesData(list: GeometryData[]): GeometryData {
  const nonEmpty = list.filter((d) => d.metadata.triCount > 0);
  if (nonEmpty.length === 0) return emptyGeometry();
  if (nonEmpty.length === 1) return nonEmpty[0]!;
  const geoms = nonEmpty.map(toBufferGeometry);
  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  if (!merged) return emptyGeometry();
  const out = fromBufferGeometry(merged);
  merged.dispose();
  return out;
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
  return out;
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
