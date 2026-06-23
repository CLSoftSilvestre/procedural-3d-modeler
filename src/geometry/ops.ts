import * as THREE from 'three';
import { fromBufferGeometry, toBufferGeometry, type GeometryData } from './GeometryData';

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
