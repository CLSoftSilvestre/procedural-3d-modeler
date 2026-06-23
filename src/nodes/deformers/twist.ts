import * as THREE from 'three';
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

/** Twist — rotates vertices around an axis by an angle proportional to their position
 * along that axis (degrees per unit length). */
export const twistNode: NodeDef = {
  type: 'deformer.twist',
  category: 'Deformers',
  label: 'Twist',
  inputs: [
    { id: 'geometry', label: 'Geometry', type: 'geometry' },
    axisSocket,
    { id: 'angle', label: 'Angle (°/unit)', type: 'number', default: 45, control: { kind: 'slider', min: -360, max: 360, step: 1 } },
  ],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate(inputs) {
    const input = geom(inputs);
    if (!input) return emptyGeometry();
    const axis = str(inputs, 'axis', 'y') as Axis;
    const k = THREE.MathUtils.degToRad(num(inputs, 'angle', 45));
    const ai = axisIndex(axis);
    const axisVec = new THREE.Vector3(ai === 0 ? 1 : 0, ai === 1 ? 1 : 0, ai === 2 ? 1 : 0);
    return deformGeometry(input, (p) => {
      const coord = p.getComponent(ai);
      p.applyAxisAngle(axisVec, k * coord);
    });
  },

  codegen(ctx) {
    const g = ctx.inputExpr('geometry');
    return {
      statements: [
        `{`,
        `  const pos = ${g}.attributes.position;`,
        `  const ai = { x: 0, y: 1, z: 2 }[${ctx.inputExpr('axis')}];`,
        `  const axisVec = new THREE.Vector3(ai === 0 ? 1 : 0, ai === 1 ? 1 : 0, ai === 2 ? 1 : 0);`,
        `  const k = THREE.MathUtils.degToRad(${ctx.inputExpr('angle')});`,
        `  const v = new THREE.Vector3();`,
        `  for (let i = 0; i < pos.count; i++) {`,
        `    v.fromBufferAttribute(pos, i);`,
        `    v.applyAxisAngle(axisVec, k * v.getComponent(ai));`,
        `    pos.setXYZ(i, v.x, v.y, v.z);`,
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
