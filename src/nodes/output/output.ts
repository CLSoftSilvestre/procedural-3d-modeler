import { mergeGeometriesData } from '@/geometry/ops';
import { withMaterial, type GeometryData } from '@/geometry/GeometryData';
import type { NodeDef, ResolvedInputs } from '../NodeDef';
import { mat } from '../helpers';

/**
 * Output — the terminal node. Whatever geometry reaches it is what the viewport shows
 * and what the code generator exports. The geometry socket is multi-input: connect several
 * geometries and they're merged into one mesh (assembling parts without chaining Boolean
 * nodes). An optional Material input styles the result; the engine reads both sockets.
 */
export const outputNode: NodeDef = {
  type: 'output.mesh',
  category: 'Output',
  label: 'Output',
  description: 'The final mesh. Connect one or more geometries (merged) plus a material.',
  inputs: [
    { id: 'geometry', label: 'Geometry', type: 'geometry', multi: true },
    { id: 'material', label: 'Material', type: 'material' },
  ],
  outputs: [],

  evaluate(inputs: ResolvedInputs) {
    // Multi-input: geometry resolves to an array; merge all connected parts into one mesh.
    const parts = (inputs.geometry as GeometryData[] | undefined) ?? [];
    if (parts.length === 0) return undefined as unknown as GeometryData; // nothing connected
    // If it's a multi-material assembly, untagged parts take the Output's material socket as
    // their fallback (so a plain object next to painted parts still gets the chosen material).
    const fallback = mat(inputs);
    const anyTagged = parts.some((p) => p.materials && p.materials.length);
    const prepared =
      anyTagged && fallback
        ? parts.map((p) => (p.materials && p.materials.length ? p : withMaterial(p, fallback)))
        : parts;
    return mergeGeometriesData(prepared);
  },

  codegen(ctx) {
    // The generator assembles `new THREE.Mesh(geometry, material)` and handles merging of
    // multiple geometry inputs itself (see generate.ts); nothing to emit here.
    return { statements: [], outputVar: ctx.inputExpr('geometry') };
  },
};
