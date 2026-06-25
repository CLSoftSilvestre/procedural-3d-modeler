import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { toBufferGeometry, type GeometryData } from '@/geometry/GeometryData';
import { defaultMaterialSpec, toThreeMaterial, type MaterialSpec } from '@/material/MaterialData';

/**
 * Export evaluated geometry + material as glTF (.gltf JSON) or GLB (.glb binary).
 * Baked-asset interchange (Target C) — complements the procedural code export.
 */
export function exportGLTF(
  geometry: GeometryData,
  material: MaterialSpec | null,
  binary: boolean,
): Promise<Blob> {
  // Multi-material assemblies → a material array indexed by the geometry's groups.
  const meshMaterial =
    geometry.materials && geometry.materials.length
      ? geometry.materials.map((m) => toThreeMaterial(m))
      : toThreeMaterial(material ?? defaultMaterialSpec());
  const mesh = new THREE.Mesh(toBufferGeometry(geometry), meshMaterial);
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      mesh,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(new Blob([result], { type: 'model/gltf-binary' }));
        } else {
          resolve(new Blob([JSON.stringify(result, null, 2)], { type: 'model/gltf+json' }));
        }
      },
      (err) => reject(err),
      { binary },
    );
  });
}

export async function downloadGLTF(
  geometry: GeometryData,
  material: MaterialSpec | null,
  binary: boolean,
  filename = binary ? 'model.glb' : 'model.gltf',
): Promise<void> {
  const blob = await exportGLTF(geometry, material, binary);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
