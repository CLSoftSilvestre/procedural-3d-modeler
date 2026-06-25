import { emptyGeometry, withMaterial } from '@/geometry/GeometryData';
import type { NodeDef } from '../NodeDef';
import { geom, mat } from '../helpers';

/**
 * Apply Material — tags a geometry with a material so it keeps that appearance when merged
 * with other parts (per-part materials / multi-material meshes). Wire several painted parts
 * into the Output to assemble a multi-material model.
 *
 * Note: live viewport + glTF export honor per-part materials; three.js *source* export is
 * still single-material (handled at the Output), so this is a geometry pass-through there.
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
    return m ? withMaterial(g, m) : g;
  },

  codegen(ctx) {
    // Source export is single-material for now — pass the geometry through unchanged.
    return { statements: [], outputVar: ctx.inputExpr('geometry') };
  },
};
