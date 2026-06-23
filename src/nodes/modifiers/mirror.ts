import { emptyGeometry } from '@/geometry/GeometryData';
import { mergeGeometriesData, mirrorGeometry, type Axis } from '@/geometry/ops';
import type { NodeDef } from '../NodeDef';
import { bool, geom, str } from '../helpers';

/**
 * Mirror — reflects geometry across an axis plane, optionally keeping the original
 * (the common "make it symmetric" operation).
 */
export const mirrorNode: NodeDef = {
  type: 'modifier.mirror',
  category: 'Modifiers',
  label: 'Mirror',
  inputs: [
    { id: 'geometry', label: 'Geometry', type: 'geometry' },
    {
      id: 'axis',
      label: 'Axis',
      type: 'string',
      default: 'x',
      control: {
        kind: 'select',
        options: [
          { label: 'X', value: 'x' },
          { label: 'Y', value: 'y' },
          { label: 'Z', value: 'z' },
        ],
      },
    },
    { id: 'keepOriginal', label: 'Keep Original', type: 'boolean', default: true, control: { kind: 'checkbox' } },
  ],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate(inputs) {
    const input = geom(inputs);
    if (!input) return emptyGeometry();
    const axis = str(inputs, 'axis', 'x') as Axis;
    const mirrored = mirrorGeometry(input, axis);
    return bool(inputs, 'keepOriginal', true) ? mergeGeometriesData([input, mirrored]) : mirrored;
  },

  codegen(ctx) {
    const g = ctx.inputExpr('geometry');
    const v = ctx.uniqueVar('mirrorGeometry');
    const sx = `${ctx.inputExpr('axis')} === 'x' ? -1 : 1`;
    const sy = `${ctx.inputExpr('axis')} === 'y' ? -1 : 1`;
    const sz = `${ctx.inputExpr('axis')} === 'z' ? -1 : 1`;
    return {
      statements: [
        `const ${v}_m = ${g}.clone();`,
        `${v}_m.applyMatrix4(new THREE.Matrix4().makeScale(${sx}, ${sy}, ${sz}));`,
        `// note: negative scale reverses winding; Phase 4 codegen will emit an index flip`,
        `const ${v} = ${ctx.inputExpr('keepOriginal')} ? BufferGeometryUtils.mergeGeometries([${g}, ${v}_m], false) : ${v}_m;`,
      ],
      outputVar: v,
      imports: ['three', 'three/examples/jsm/utils/BufferGeometryUtils.js'],
    };
  },
};
