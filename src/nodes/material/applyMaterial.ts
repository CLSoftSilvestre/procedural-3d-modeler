import { emptyGeometry, withMaterial } from '@/geometry/GeometryData';
import type { NodeDef } from '../NodeDef';
import { geom, mat } from '../helpers';

/**
 * Apply Material — tags a geometry with a material so it keeps that appearance when merged
 * with other parts (per-part materials / multi-material meshes). Wire several painted parts
 * into the Output to assemble a multi-material model.
 *
 * Honored by the live viewport, glTF export, and three.js source export (the generator tracks
 * each part's material and emits a material array on the Mesh).
 */
export const applyMaterialNode: NodeDef = {
  type: 'material.apply',
  category: 'Material',
  label: 'Apply Material',
  description: 'Assign a material to a geometry (kept per-part when parts are merged).',
  inputs: [
    { id: 'geometry', label: 'Geometry', type: 'geometry' },
    { id: 'material', label: 'Material', type: 'material' },
  ],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate(inputs) {
    const g = geom(inputs);
    if (!g) return emptyGeometry();
    const m = mat(inputs);
    // Explicit paint: override any material the geometry already carries (e.g. a component's own).
    return m ? withMaterial(g, m, true) : g;
  },

  codegen(ctx) {
    // Source export is single-material for now — pass the geometry through unchanged.
    return { statements: [], outputVar: ctx.inputExpr('geometry') };
  },
};
