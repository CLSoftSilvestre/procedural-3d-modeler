import * as THREE from 'three';
import { emptyGeometry, fromBufferGeometry } from '@/geometry/GeometryData';
import { toThreeShape } from '@/geometry/ShapeData';
import type { NodeDef } from '../NodeDef';
import { bool, num, shape } from '../helpers';

/** Extrude — sweeps a 2D profile along Z into a solid, with optional bevel. */
export const extrudeNode: NodeDef = {
  type: 'generator.extrude',
  category: 'Generators',
  label: 'Extrude',
  inputs: [
    { id: 'shape', label: 'Shape', type: 'shape' },
    { id: 'depth', label: 'Depth', type: 'number', default: 1, control: { kind: 'slider', min: 0.01, max: 10, step: 0.01 } },
    { id: 'steps', label: 'Steps', type: 'number', default: 1, control: { kind: 'slider', min: 1, max: 64, step: 1 } },
    { id: 'bevel', label: 'Bevel', type: 'boolean', default: false, control: { kind: 'checkbox' } },
    { id: 'bevelThickness', label: 'Bevel Thickness', type: 'number', default: 0.1, control: { kind: 'slider', min: 0, max: 2, step: 0.01 } },
    { id: 'bevelSize', label: 'Bevel Size', type: 'number', default: 0.1, control: { kind: 'slider', min: 0, max: 2, step: 0.01 } },
    { id: 'bevelSegments', label: 'Bevel Segments', type: 'number', default: 2, control: { kind: 'slider', min: 1, max: 16, step: 1 } },
  ],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate(inputs) {
    const profile = shape(inputs);
    if (!profile || profile.points.length < 3) return emptyGeometry();
    const depth = num(inputs, 'depth', 1);
    const geom = new THREE.ExtrudeGeometry(toThreeShape(profile), {
      depth,
      steps: Math.max(1, Math.floor(num(inputs, 'steps', 1))),
      bevelEnabled: bool(inputs, 'bevel', false),
      bevelThickness: num(inputs, 'bevelThickness', 0.1),
      bevelSize: num(inputs, 'bevelSize', 0.1),
      bevelSegments: Math.max(1, Math.floor(num(inputs, 'bevelSegments', 2))),
    });
    geom.translate(0, 0, -depth / 2); // center along Z
    geom.computeVertexNormals();
    const data = fromBufferGeometry(geom);
    geom.dispose();
    return data;
  },

  codegen(ctx) {
    const p = ctx.inputExpr('shape');
    const v = ctx.uniqueVar('extrudeGeometry');
    return {
      statements: [
        `const ${v} = new THREE.ExtrudeGeometry(new THREE.Shape(${p}), {`,
        `  depth: ${ctx.inputExpr('depth')},`,
        `  steps: ${ctx.inputExpr('steps')},`,
        `  bevelEnabled: ${ctx.inputExpr('bevel')},`,
        `  bevelThickness: ${ctx.inputExpr('bevelThickness')},`,
        `  bevelSize: ${ctx.inputExpr('bevelSize')},`,
        `  bevelSegments: ${ctx.inputExpr('bevelSegments')},`,
        `});`,
        `${v}.translate(0, 0, -(${ctx.inputExpr('depth')}) / 2);`,
        `${v}.computeVertexNormals();`,
      ],
      outputVar: v,
      imports: ['three'],
    };
  },
};
