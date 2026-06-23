import * as THREE from 'three';

/**
 * MaterialSpec — a plain, serializable description of a PBR material that flows along
 * 'material' sockets. The `kind` discriminator distinguishes it from other socket values
 * (e.g. GeometryData) at runtime. Maps onto MeshStandard/MeshPhysical materials and is
 * printable by the code generator.
 */
export interface MaterialSpec {
  kind: 'material';
  type: 'standard' | 'physical';
  color: string; // hex, e.g. "#6ea8fe"
  roughness: number;
  metalness: number;
  opacity: number;
  flatShading: boolean;
  wireframe: boolean;
}

export function defaultMaterialSpec(): MaterialSpec {
  return {
    kind: 'material',
    type: 'standard',
    color: '#6ea8fe',
    roughness: 0.5,
    metalness: 0.05,
    opacity: 1,
    flatShading: false,
    wireframe: false,
  };
}

export function isMaterialSpec(v: unknown): v is MaterialSpec {
  return typeof v === 'object' && v !== null && (v as { kind?: string }).kind === 'material';
}

/** Build a three.js material from a spec. */
export function toThreeMaterial(spec: MaterialSpec): THREE.Material {
  const params: THREE.MeshStandardMaterialParameters = {
    color: new THREE.Color(spec.color),
    roughness: spec.roughness,
    metalness: spec.metalness,
    flatShading: spec.flatShading,
    wireframe: spec.wireframe,
    transparent: spec.opacity < 1,
    opacity: spec.opacity,
  };
  return spec.type === 'physical'
    ? new THREE.MeshPhysicalMaterial(params)
    : new THREE.MeshStandardMaterial(params);
}
