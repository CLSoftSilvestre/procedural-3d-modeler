import { emptyGeometry } from '@/geometry/GeometryData';
import type { NodeDef } from '../NodeDef';
import { geom } from '../helpers';
import { applyTransform, transformInputs, transformStatements } from '../transformShared';

/**
 * Transform — geometry-in → geometry-out placement modifier. Primitives now carry their
 * own transform, so this node is mainly for transforming *combined* geometry (e.g. the
 * result of a boolean or merge). Rotation is authored in degrees, scale defaults to 1.
 */
export const transformNode: NodeDef = {
  type: 'modifier.transform',
  category: 'Modifiers',
  label: 'Transform',
  description: 'Translate, rotate (degrees), and scale geometry per axis.',
  inputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }, ...transformInputs()],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate(inputs) {
    const input = geom(inputs);
    if (!input) return emptyGeometry();
    return applyTransform(input, inputs);
  },

  codegen(ctx) {
    const g = ctx.inputExpr('geometry');
    return {
      statements: transformStatements(ctx, g),
      outputVar: g,
      imports: ['three'],
    };
  },
};
