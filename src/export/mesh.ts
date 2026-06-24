import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { toBufferGeometry, type GeometryData } from '@/geometry/GeometryData';

/**
 * Baked mesh interchange for 3D printing (STL) and DCC tools (OBJ). These formats are
 * geometry-only — material/PBR data isn't carried (use glTF for that). Complements the
 * procedural code and glTF exports.
 */

function meshFromGeometry(geometry: GeometryData): THREE.Mesh {
  return new THREE.Mesh(toBufferGeometry(geometry), new THREE.MeshStandardMaterial());
}

/** Export geometry as STL (binary `.stl` for printing, or human-readable ASCII). */
export function exportSTL(geometry: GeometryData, binary: boolean): Blob {
  const result = new STLExporter().parse(meshFromGeometry(geometry), { binary });
  if (binary) {
    // Binary STL: result is a DataView (cast to BlobPart — TS narrows its buffer too strictly).
    return new Blob([result as unknown as BlobPart], { type: 'model/stl' });
  }
  return new Blob([result as string], { type: 'model/stl' });
}

/** Export geometry as a Wavefront OBJ text file. */
export function exportOBJ(geometry: GeometryData): Blob {
  const text = new OBJExporter().parse(meshFromGeometry(geometry));
  return new Blob([text], { type: 'text/plain' });
}

/** Trigger a browser download of an exported mesh blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
