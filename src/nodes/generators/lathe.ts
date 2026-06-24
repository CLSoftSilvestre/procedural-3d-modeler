import * as THREE from 'three';
import { emptyGeometry, fromBufferGeometry } from '@/geometry/GeometryData';
import { toVector2Array } from '@/geometry/ShapeData';
import type { NodeDef } from '../NodeDef';
import { num, shape } from '../helpers';

/**
 * Lathe — revolves a 2D profile around the Y axis (solid of revolution). The profile is
 * treated as a silhouette: each point's x is the radius, y the height.
 */
export const latheNode: NodeDef = {
  type: 'generator.lathe',
  category: 'Generators',
  label: 'Lathe',
  description: 'Revolve a 2D profile around the Y axis (solid of revolution).',
  inputs: [
    { id: 'shape', label: 'Shape', type: 'shape' },
    { id: 'segments', label: 'Segments', type: 'number', default: 32, control: { kind: 'slider', min: 3, max: 256, step: 1 } },
    { id: 'phiLength', label: 'Sweep°', type: 'number', default: 360, control: { kind: 'slider', min: 1, max: 360, step: 1 } },
  ],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate(inputs, ctx) {
    const profile = shape(inputs);
    if (!profile || profile.points.length < 2) return emptyGeometry();
    let segments = Math.max(3, Math.floor(num(inputs, 'segments', 32)));
    if (ctx.quality === 'preview') segments = Math.max(3, Math.ceil(segments * 0.4));
    const geom = new THREE.LatheGeometry(
      toVector2Array(profile),
      segments,
      0,
      THREE.MathUtils.degToRad(num(inputs, 'phiLength', 360)),
    );
    const data = fromBufferGeometry(geom);
    geom.dispose();
    return data;
  },

  codegen(ctx) {
    const p = ctx.inputExpr('shape');
    const v = ctx.uniqueVar('latheGeometry');
    return {
      statements: [
        `const ${v} = new THREE.LatheGeometry(${p}, ${ctx.inputExpr('segments')}, 0, THREE.MathUtils.degToRad(${ctx.inputExpr('phiLength')}));`,
      ],
      outputVar: v,
      imports: ['three'],
    };
  },
};
