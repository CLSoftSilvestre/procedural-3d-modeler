import { polygonPoints, type ShapeData } from '@/geometry/ShapeData';
import type { NodeDef } from '../NodeDef';
import { num } from '../helpers';

/** Polygon — a regular n-sided 2D profile. Feed it to Extrude or Lathe. */
export const polygonNode: NodeDef = {
  type: 'curve.polygon',
  category: 'Curves',
  label: 'Polygon',
  inputs: [
    { id: 'sides', label: 'Sides', type: 'number', default: 6, control: { kind: 'slider', min: 3, max: 64, step: 1 } },
    { id: 'radius', label: 'Radius', type: 'number', default: 1, control: { kind: 'slider', min: 0.01, max: 10, step: 0.01 } },
  ],
  outputs: [{ id: 'shape', label: 'Shape', type: 'shape' }],

  evaluate(inputs) {
    const profile: ShapeData = {
      kind: 'shape',
      points: polygonPoints(num(inputs, 'sides', 6), num(inputs, 'radius', 1)),
      closed: true,
    };
    return profile;
  },

  codegen(ctx) {
    const v = ctx.uniqueVar('polygon');
    return {
      statements: [
        `const ${v} = [];`,
        `for (let i = 0; i < ${ctx.inputExpr('sides')}; i++) {`,
        `  const a = (i / ${ctx.inputExpr('sides')}) * Math.PI * 2;`,
        `  ${v}.push(new THREE.Vector2(Math.cos(a) * ${ctx.inputExpr('radius')}, Math.sin(a) * ${ctx.inputExpr('radius')}));`,
        `}`,
      ],
      outputVar: v,
      imports: ['three'],
    };
  },
};
