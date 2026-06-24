import { emptyGeometry } from '@/geometry/GeometryData';
import { axisIndex, deformGeometry, type Axis } from '@/geometry/ops';
import type { SocketSpec } from '@/graph/types';
import type { NodeDef } from '../NodeDef';
import { geom, num, str } from '../helpers';

const axisSocket: SocketSpec = {
  id: 'axis',
  label: 'Axis',
  type: 'string',
  default: 'y',
  control: {
    kind: 'select',
    options: [
      { label: 'X', value: 'x' },
      { label: 'Y', value: 'y' },
      { label: 'Z', value: 'z' },
    ],
  },
};

/**
 * Taper — scales the two axes perpendicular to `axis` by a factor that interpolates from
 * 1 at the low end of the geometry to `endScale` at the high end (e.g. 0 → a point).
 */
export const taperNode: NodeDef = {
  type: 'deformer.taper',
  category: 'Deformers',
  label: 'Taper',
  description: 'Scale the cross-section from 1 to endScale along an axis.',
  inputs: [
    { id: 'geometry', label: 'Geometry', type: 'geometry' },
    axisSocket,
    { id: 'endScale', label: 'End Scale', type: 'number', default: 0.3, control: { kind: 'slider', min: 0, max: 3, step: 0.01 } },
  ],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate(inputs) {
    const input = geom(inputs);
    if (!input) return emptyGeometry();
    const bb = input.metadata.boundingBox;
    if (!bb) return input;
    const axis = str(inputs, 'axis', 'y') as Axis;
    const ai = axisIndex(axis);
    const min = bb.min[ai];
    const range = bb.max[ai] - min || 1;
    const endScale = num(inputs, 'endScale', 0.3);
    return deformGeometry(input, (p) => {
      const t = (p.getComponent(ai) - min) / range;
      const s = 1 + (endScale - 1) * t;
      for (let c = 0; c < 3; c++) if (c !== ai) p.setComponent(c, p.getComponent(c) * s);
    });
  },

  codegen(ctx) {
    const g = ctx.inputExpr('geometry');
    return {
      statements: [
        `{`,
        `  ${g}.computeBoundingBox();`,
        `  const bb = ${g}.boundingBox;`,
        `  const ai = { x: 0, y: 1, z: 2 }[${ctx.inputExpr('axis')}];`,
        `  const min = bb.min.getComponent(ai);`,
        `  const range = (bb.max.getComponent(ai) - min) || 1;`,
        `  const endScale = ${ctx.inputExpr('endScale')};`,
        `  const pos = ${g}.attributes.position;`,
        `  for (let i = 0; i < pos.count; i++) {`,
        `    const cx = pos.getX(i), cy = pos.getY(i), cz = pos.getZ(i);`,
        `    const coord = ai === 0 ? cx : ai === 1 ? cy : cz;`,
        `    const t = (coord - min) / range;`,
        `    const s = 1 + (endScale - 1) * t;`,
        `    pos.setXYZ(i, ai === 0 ? cx : cx * s, ai === 1 ? cy : cy * s, ai === 2 ? cz : cz * s);`,
        `  }`,
        `  pos.needsUpdate = true;`,
        `  ${g}.computeVertexNormals();`,
        `}`,
      ],
      outputVar: g,
      imports: ['three'],
    };
  },
};
