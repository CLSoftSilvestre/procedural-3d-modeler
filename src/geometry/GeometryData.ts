import * as THREE from 'three';
import type { MaterialSpec } from '@/material/MaterialData';

/**
 * GeometryData — the intermediate representation that flows through the entire system.
 *
 * It is:
 *  - **flat & transferable** (typed arrays) so it can cross the worker boundary cheaply,
 *  - **1:1 with THREE.BufferGeometry** so the viewport can render it directly,
 *  - **printable** so the code generator can emit three.js code that reproduces it.
 *
 * See ARCHITECTURE.md §3.
 */
export interface GeometryData {
  positions: Float32Array; // xyz triples
  indices?: Uint32Array; // triangle list (optional; non-indexed if absent)
  normals?: Float32Array;
  uvs?: Float32Array;
  /** Named extra attributes (e.g. color). */
  attributes?: Record<string, { array: Float32Array; itemSize: number }>;
  /** Material groups for multi-material meshes (index into `materials`). */
  groups?: { start: number; count: number; materialIndex: number }[];
  /** Per-group materials, indexed by group.materialIndex. Present on assemblies/painted parts. */
  materials?: MaterialSpec[];
  metadata: GeometryMetadata;
}

export interface GeometryMetadata {
  triCount: number;
  boundingBox?: { min: [number, number, number]; max: [number, number, number] };
}

/** An empty geometry (no triangles). Used when a modifier has no input. */
export function emptyGeometry(): GeometryData {
  return { positions: new Float32Array(0), metadata: { triCount: 0 } };
}

/**
 * Convert a GeometryData into a renderable THREE.BufferGeometry.
 * Buffers are COPIED so the returned geometry owns its data — in-place three.js ops
 * (applyMatrix4, translate, …) must never mutate the source GeometryData, which may be
 * a cached upstream result shared by other nodes.
 */
export function toBufferGeometry(data: GeometryData): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(data.positions.slice(), 3));
  if (data.indices) geom.setIndex(new THREE.BufferAttribute(data.indices.slice(), 1));
  if (data.normals) geom.setAttribute('normal', new THREE.BufferAttribute(data.normals.slice(), 3));
  if (data.uvs) geom.setAttribute('uv', new THREE.BufferAttribute(data.uvs.slice(), 2));
  if (data.attributes) {
    for (const [name, attr] of Object.entries(data.attributes)) {
      geom.setAttribute(name, new THREE.BufferAttribute(attr.array.slice(), attr.itemSize));
    }
  }
  if (data.groups) {
    for (const g of data.groups) geom.addGroup(g.start, g.count, g.materialIndex);
  }
  if (!data.normals) geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

/** Build a GeometryData from a THREE.BufferGeometry (used by primitive nodes). */
export function fromBufferGeometry(geom: THREE.BufferGeometry): GeometryData {
  const position = geom.getAttribute('position') as THREE.BufferAttribute;
  const normal = geom.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const uv = geom.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const index = geom.getIndex();

  geom.computeBoundingBox();
  const bb = geom.boundingBox;

  const triCount = index ? index.count / 3 : position.count / 3;

  return {
    positions: new Float32Array(position.array),
    indices: index ? new Uint32Array(index.array) : undefined,
    normals: normal ? new Float32Array(normal.array) : undefined,
    uvs: uv ? new Float32Array(uv.array) : undefined,
    metadata: {
      triCount,
      boundingBox: bb
        ? { min: [bb.min.x, bb.min.y, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z] }
        : undefined,
    },
  };
}

/** Render-element count used for a whole-geometry material group (index or vertex units). */
function renderCount(data: GeometryData): number {
  return data.indices ? data.indices.length : data.positions.length / 3;
}

/**
 * Tag a geometry with a single material covering all of it (one group).
 * `override = false` (implicit tagging, e.g. a component's own material): keep any existing
 * material groups so a nested assembly's per-part materials persist.
 * `override = true` (explicit Apply Material): replace whatever material(s) it already had.
 */
export function withMaterial(data: GeometryData, material: MaterialSpec, override = false): GeometryData {
  if (!override && data.materials && data.materials.length) return data;
  if (data.metadata.triCount === 0) return data;
  return {
    ...data,
    groups: [{ start: 0, count: renderCount(data), materialIndex: 0 }],
    materials: [material],
  };
}

/** Collect the transferable ArrayBuffers in a GeometryData (for postMessage). */
export function geometryTransferables(data: GeometryData): Transferable[] {
  const out: Transferable[] = [data.positions.buffer];
  if (data.indices) out.push(data.indices.buffer);
  if (data.normals) out.push(data.normals.buffer);
  if (data.uvs) out.push(data.uvs.buffer);
  if (data.attributes) {
    for (const attr of Object.values(data.attributes)) out.push(attr.array.buffer);
  }
  return out;
}
