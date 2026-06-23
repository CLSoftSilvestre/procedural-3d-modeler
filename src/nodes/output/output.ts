import type { GeometryData } from '@/geometry/GeometryData';
import type { NodeDef, ResolvedInputs } from '../NodeDef';

/**
 * Output — the terminal node. Whatever geometry reaches it is what the viewport
 * shows and what the code generator exports.
 */
export const outputNode: NodeDef = {
  type: 'output.mesh',
  category: 'Output',
  label: 'Output',
  inputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],
  outputs: [],

  evaluate(inputs: ResolvedInputs) {
    // Pass the incoming geometry through unchanged.
    return inputs.geometry as GeometryData;
  },

  codegen(ctx) {
    return {
      statements: [],
      outputVar: ctx.inputExpr('geometry'),
    };
  },
};
