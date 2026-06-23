import * as THREE from 'three';
import { emptyGeometry } from '@/geometry/GeometryData';
import { composeMatrix, transformGeometry } from '@/geometry/ops';
import type { SocketSpec } from '@/graph/types';
import type { NodeDef } from '../NodeDef';
import { geom, num } from '../helpers';

const slider = (id: string, label: string, def: number, range: number, step = 0.01): SocketSpec => ({
  id,
  label,
  type: 'number',
  default: def,
  control: { kind: 'slider', min: -range, max: range, step },
});

/**
 * Transform — the first geometry-in → geometry-out modifier. Validates that the engine
 * handles nodes that both consume and produce geometry (the pattern for all modifiers
 * and booleans). Rotation is authored in degrees, scale defaults to 1.
 */
export const transformNode: NodeDef = {
  type: 'modifier.transform',
  category: 'Modifiers',
  label: 'Transform',
  inputs: [
    { id: 'geometry', label: 'Geometry', type: 'geometry' },
    slider('tx', 'Translate X', 0, 10),
    slider('ty', 'Translate Y', 0, 10),
    slider('tz', 'Translate Z', 0, 10),
    slider('rx', 'Rotate X°', 0, 180, 1),
    slider('ry', 'Rotate Y°', 0, 180, 1),
    slider('rz', 'Rotate Z°', 0, 180, 1),
    slider('sx', 'Scale X', 1, 5),
    slider('sy', 'Scale Y', 1, 5),
    slider('sz', 'Scale Z', 1, 5),
  ],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate(inputs) {
    const input = geom(inputs);
    if (!input) return emptyGeometry();
    const d2r = THREE.MathUtils.degToRad;
    const matrix = composeMatrix(
      [num(inputs, 'tx', 0), num(inputs, 'ty', 0), num(inputs, 'tz', 0)],
      [d2r(num(inputs, 'rx', 0)), d2r(num(inputs, 'ry', 0)), d2r(num(inputs, 'rz', 0))],
      [num(inputs, 'sx', 1), num(inputs, 'sy', 1), num(inputs, 'sz', 1)],
    );
    return transformGeometry(input, matrix);
  },

  codegen(ctx) {
    const g = ctx.inputExpr('geometry');
    const r = (id: string) => `THREE.MathUtils.degToRad(${ctx.inputExpr(id)})`;
    const matrix =
      `new THREE.Matrix4().compose(` +
      `new THREE.Vector3(${ctx.inputExpr('tx')}, ${ctx.inputExpr('ty')}, ${ctx.inputExpr('tz')}), ` +
      `new THREE.Quaternion().setFromEuler(new THREE.Euler(${r('rx')}, ${r('ry')}, ${r('rz')})), ` +
      `new THREE.Vector3(${ctx.inputExpr('sx')}, ${ctx.inputExpr('sy')}, ${ctx.inputExpr('sz')}))`;
    return {
      statements: [`${g}.applyMatrix4(${matrix});`],
      outputVar: g,
      imports: ['three'],
    };
  },
};
