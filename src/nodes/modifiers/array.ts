import * as THREE from 'three';
import { emptyGeometry } from '@/geometry/GeometryData';
import { mergeGeometriesData, transformGeometry, type Axis } from '@/geometry/ops';
import type { SocketSpec } from '@/graph/types';
import type { NodeDef } from '../NodeDef';
import { geom, num, str } from '../helpers';

const slider = (id: string, label: string, def: number, range: number, step = 0.01): SocketSpec => ({
  id,
  label,
  type: 'number',
  default: def,
  control: { kind: 'slider', min: -range, max: range, step },
});

/** Perpendicular offset direction used to place radial copies. */
function radialOffset(axis: Axis, radius: number): [number, number, number] {
  return axis === 'x' ? [0, radius, 0] : [radius, 0, 0];
}

/**
 * Array — duplicates the input geometry into a pattern and merges the copies.
 * `linear` repeats along an offset vector; `radial` arranges copies around an axis.
 */
export const arrayNode: NodeDef = {
  type: 'modifier.array',
  category: 'Modifiers',
  label: 'Array',
  inputs: [
    { id: 'geometry', label: 'Geometry', type: 'geometry' },
    {
      id: 'mode',
      label: 'Mode',
      type: 'string',
      default: 'linear',
      control: {
        kind: 'select',
        options: [
          { label: 'Linear', value: 'linear' },
          { label: 'Radial', value: 'radial' },
        ],
      },
    },
    { id: 'count', label: 'Count', type: 'number', default: 3, control: { kind: 'slider', min: 1, max: 64, step: 1 } },
    slider('ox', 'Offset X', 1.5, 10),
    slider('oy', 'Offset Y', 0, 10),
    slider('oz', 'Offset Z', 0, 10),
    slider('radius', 'Radius', 2, 20),
    {
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
    },
  ],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate(inputs) {
    const input = geom(inputs);
    if (!input) return emptyGeometry();
    const mode = str(inputs, 'mode', 'linear');
    const count = Math.max(1, Math.floor(num(inputs, 'count', 3)));
    const axis = str(inputs, 'axis', 'y') as Axis;

    const copies = [];
    for (let i = 0; i < count; i++) {
      let matrix: THREE.Matrix4;
      if (mode === 'radial') {
        const angle = (i / count) * Math.PI * 2;
        const off = radialOffset(axis, num(inputs, 'radius', 2));
        const rot = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0),
          angle,
        );
        matrix = rot.multiply(new THREE.Matrix4().makeTranslation(off[0], off[1], off[2]));
      } else {
        matrix = new THREE.Matrix4().makeTranslation(
          i * num(inputs, 'ox', 1.5),
          i * num(inputs, 'oy', 0),
          i * num(inputs, 'oz', 0),
        );
      }
      copies.push(i === 0 && mode === 'linear' ? input : transformGeometry(input, matrix));
    }
    return mergeGeometriesData(copies);
  },

  codegen(ctx) {
    const g = ctx.inputExpr('geometry');
    const v = ctx.uniqueVar('arrayGeometry');
    const list = ctx.uniqueVar('arrayParts');
    return {
      statements: [
        `const ${list} = [];`,
        `for (let i = 0; i < ${ctx.inputExpr('count')}; i++) {`,
        `  const part = ${g}.clone();`,
        `  if (${ctx.inputExpr('mode')} === 'radial') {`,
        `    const angle = (i / ${ctx.inputExpr('count')}) * Math.PI * 2;`,
        `    const axis = new THREE.Vector3(${ctx.inputExpr('axis')} === 'x' ? 1 : 0, ${ctx.inputExpr('axis')} === 'y' ? 1 : 0, ${ctx.inputExpr('axis')} === 'z' ? 1 : 0);`,
        `    const off = ${ctx.inputExpr('axis')} === 'x' ? [0, ${ctx.inputExpr('radius')}, 0] : [${ctx.inputExpr('radius')}, 0, 0];`,
        `    part.applyMatrix4(new THREE.Matrix4().makeRotationAxis(axis, angle).multiply(new THREE.Matrix4().makeTranslation(off[0], off[1], off[2])));`,
        `  } else {`,
        `    part.translate(i * ${ctx.inputExpr('ox')}, i * ${ctx.inputExpr('oy')}, i * ${ctx.inputExpr('oz')});`,
        `  }`,
        `  ${list}.push(part);`,
        `}`,
        `const ${v} = BufferGeometryUtils.mergeGeometries(${list}, false);`,
      ],
      outputVar: v,
      imports: ['three', 'three/examples/jsm/utils/BufferGeometryUtils.js'],
    };
  },
};
