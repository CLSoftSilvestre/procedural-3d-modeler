import type { GeometryData } from '@/geometry/GeometryData';
import type { NodeDef, ResolvedInputs } from '../NodeDef';

/**
 * Output — the terminal node. Whatever geometry reaches it is what the viewport shows
 * and what the code generator exports. An optional Material input styles the result;
 * the engine reads both sockets directly (see evaluate.ts).
 */
export const outputNode: NodeDef = {
  type: 'output.mesh',
  category: 'Output',
  label: 'Output',
  inputs: [
    { id: 'geometry', label: 'Geometry', type: 'geometry' },
    { id: 'material', label: 'Material', type: 'material' },
  ],
  outputs: [],

  evaluate(inputs: ResolvedInputs) {
    // Pass the incoming geometry through unchanged; material is read by the engine.
    return inputs.geometry as GeometryData;
  },

  codegen(ctx) {
    // The Phase-4 generator assembles `new THREE.Mesh(geometry, material)` from the
    // output's two input sockets; here we just surface the geometry var.
    return {
      statements: [],
      outputVar: ctx.inputExpr('geometry'),
    };
  },
};
