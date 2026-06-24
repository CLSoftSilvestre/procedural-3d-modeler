import { emptyGeometry } from '@/geometry/GeometryData';
import { booleanOp, type BooleanOp } from '@/geometry/csg';
import type { NodeDef } from '../NodeDef';
import { geom, str } from '../helpers';

/**
 * Boolean — mesh CSG of two geometry inputs (A op B). The first node with TWO geometry
 * input sockets, validating multi-input handling in the engine and graph UI.
 */
export const booleanNode: NodeDef = {
  type: 'boolean.op',
  category: 'Booleans',
  label: 'Boolean',
  description: 'Union, subtract, or intersect two meshes (CSG).',
  inputs: [
    { id: 'a', label: 'A', type: 'geometry' },
    { id: 'b', label: 'B', type: 'geometry' },
    {
      id: 'operation',
      label: 'Operation',
      type: 'string',
      default: 'subtract',
      control: {
        kind: 'select',
        options: [
          { label: 'Union (A + B)', value: 'union' },
          { label: 'Subtract (A − B)', value: 'subtract' },
          { label: 'Intersect (A ∩ B)', value: 'intersect' },
        ],
      },
    },
  ],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate(inputs) {
    const a = geom(inputs, 'a');
    const b = geom(inputs, 'b');
    if (!a && !b) return emptyGeometry();
    if (!a) return b!;
    if (!b) return a;
    return booleanOp(a, b, str(inputs, 'operation', 'subtract') as BooleanOp);
  },

  codegen(ctx) {
    const a = ctx.inputExpr('a');
    const b = ctx.inputExpr('b');
    const v = ctx.uniqueVar('booleanResult');
    const opConst = `{ union: ADDITION, subtract: SUBTRACTION, intersect: INTERSECTION }[${ctx.inputExpr('operation')}]`;
    return {
      statements: [
        `const ${v}_ev = new Evaluator();`,
        `${v}_ev.useGroups = false;`,
        `const ${v}_a = new Brush(${a});`,
        `const ${v}_b = new Brush(${b});`,
        `${v}_a.updateMatrixWorld();`,
        `${v}_b.updateMatrixWorld();`,
        `const ${v} = ${v}_ev.evaluate(${v}_a, ${v}_b, ${opConst}).geometry;`,
      ],
      outputVar: v,
      imports: ['three-bvh-csg'],
    };
  },
};
