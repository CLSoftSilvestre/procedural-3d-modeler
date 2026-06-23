import { starPoints, type ShapeData } from '@/geometry/ShapeData';
import type { NodeDef } from '../NodeDef';
import { num } from '../helpers';

/** Star — an alternating inner/outer-radius 2D profile (great for gears/stars). */
export const starNode: NodeDef = {
  type: 'curve.star',
  category: 'Curves',
  label: 'Star',
  inputs: [
    { id: 'points', label: 'Points', type: 'number', default: 5, control: { kind: 'slider', min: 2, max: 32, step: 1 } },
    { id: 'innerRadius', label: 'Inner Radius', type: 'number', default: 0.5, control: { kind: 'slider', min: 0.01, max: 10, step: 0.01 } },
    { id: 'outerRadius', label: 'Outer Radius', type: 'number', default: 1, control: { kind: 'slider', min: 0.01, max: 10, step: 0.01 } },
  ],
  outputs: [{ id: 'shape', label: 'Shape', type: 'shape' }],

  evaluate(inputs) {
    const profile: ShapeData = {
      kind: 'shape',
      points: starPoints(
        num(inputs, 'points', 5),
        num(inputs, 'innerRadius', 0.5),
        num(inputs, 'outerRadius', 1),
      ),
      closed: true,
    };
    return profile;
  },

  codegen(ctx) {
    const v = ctx.uniqueVar('star');
    return {
      statements: [
        `const ${v} = [];`,
        `{`,
        `  const n = ${ctx.inputExpr('points')} * 2;`,
        `  for (let i = 0; i < n; i++) {`,
        `    const a = (i / n) * Math.PI * 2 - Math.PI / 2;`,
        `    const r = i % 2 === 0 ? ${ctx.inputExpr('outerRadius')} : ${ctx.inputExpr('innerRadius')};`,
        `    ${v}.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));`,
        `  }`,
        `}`,
      ],
      outputVar: v,
      imports: ['three'],
    };
  },
};
