import * as THREE from 'three';
import { emptyGeometry } from '@/geometry/GeometryData';
import { axisIndex, deformGeometry, type Axis } from '@/geometry/ops';
import type { SocketSpec } from '@/graph/types';
import type { NodeDef } from '../NodeDef';
import { geom, num, str } from '../helpers';

const axisSocket: SocketSpec = {
  id: 'axis',
  label: 'Length Axis',
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

// The bend rotates each vertex about a perpendicular axis (cyclic: x→y, y→z, z→x) by an
// angle proportional to its coordinate along the length axis — curling a straight bar into an arc.
const ROT_OF: Record<Axis, Axis> = { x: 'y', y: 'z', z: 'x' };

/** Bend — like Twist, but the rotation axis is perpendicular to the length axis, so the
 *  geometry curves into an arc instead of twisting in place. */
export const bendNode: NodeDef = {
  type: 'deformer.bend',
  category: 'Deformers',
  label: 'Bend',
  description: 'Curve geometry into an arc — rotation perpendicular to the length axis.',
  inputs: [
    { id: 'geometry', label: 'Geometry', type: 'geometry' },
    axisSocket,
    { id: 'angle', label: 'Bend (°/unit)', type: 'number', default: 45, control: { kind: 'slider', min: -360, max: 360, step: 1 } },
  ],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate(inputs) {
    const input = geom(inputs);
    if (!input) return emptyGeometry();
    const axis = str(inputs, 'axis', 'y') as Axis;
    const ai = axisIndex(axis);
    const ri = axisIndex(ROT_OF[axis]);
    const rotVec = new THREE.Vector3(ri === 0 ? 1 : 0, ri === 1 ? 1 : 0, ri === 2 ? 1 : 0);
    const k = THREE.MathUtils.degToRad(num(inputs, 'angle', 45));
    return deformGeometry(input, (p) => {
      p.applyAxisAngle(rotVec, k * p.getComponent(ai));
    });
  },

  codegen(ctx) {
    const g = ctx.inputExpr('geometry');
    return {
      statements: [
        `{`,
        `  const pos = ${g}.attributes.position;`,
        `  const ai = { x: 0, y: 1, z: 2 }[${ctx.inputExpr('axis')}];`,
        `  const ri = { x: 1, y: 2, z: 0 }[${ctx.inputExpr('axis')}];`,
        `  const rotVec = new THREE.Vector3(ri === 0 ? 1 : 0, ri === 1 ? 1 : 0, ri === 2 ? 1 : 0);`,
        `  const k = THREE.MathUtils.degToRad(${ctx.inputExpr('angle')});`,
        `  const v = new THREE.Vector3();`,
        `  for (let i = 0; i < pos.count; i++) {`,
        `    v.fromBufferAttribute(pos, i);`,
        `    v.applyAxisAngle(rotVec, k * v.getComponent(ai));`,
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
