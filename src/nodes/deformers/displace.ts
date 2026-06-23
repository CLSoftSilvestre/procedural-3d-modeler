import { emptyGeometry } from '@/geometry/GeometryData';
import { deformGeometry } from '@/geometry/ops';
import { makeNoise3 } from '@/geometry/noise';
import type { NodeDef } from '../NodeDef';
import { geom, num } from '../helpers';

/**
 * Displace — pushes vertices along their normals by seeded coherent noise sampled at
 * (position × frequency). Deterministic for a given seed.
 */
export const displaceNode: NodeDef = {
  type: 'deformer.displace',
  category: 'Deformers',
  label: 'Displace',
  inputs: [
    { id: 'geometry', label: 'Geometry', type: 'geometry' },
    { id: 'strength', label: 'Strength', type: 'number', default: 0.2, control: { kind: 'slider', min: -2, max: 2, step: 0.01 } },
    { id: 'frequency', label: 'Frequency', type: 'number', default: 1, control: { kind: 'slider', min: 0.1, max: 10, step: 0.1 } },
    { id: 'seed', label: 'Seed', type: 'number', default: 1, control: { kind: 'slider', min: 0, max: 1000, step: 1 } },
  ],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate(inputs) {
    const input = geom(inputs);
    if (!input) return emptyGeometry();
    const strength = num(inputs, 'strength', 0.2);
    const freq = num(inputs, 'frequency', 1);
    const noise = makeNoise3(num(inputs, 'seed', 1));
    return deformGeometry(input, (p, n) => {
      const d = strength * noise(p.x * freq, p.y * freq, p.z * freq);
      p.addScaledVector(n, d);
    });
  },

  codegen(ctx) {
    // Uses the injected `makeNoise3` helper; displaces along the existing normals (to
    // match the live evaluation), then recomputes normals.
    const g = ctx.inputExpr('geometry');
    const nz = ctx.uniqueVar('noise');
    return {
      statements: [
        `{`,
        `  const ${nz} = makeNoise3(${ctx.inputExpr('seed')});`,
        `  const pos = ${g}.attributes.position;`,
        `  const nrm = ${g}.attributes.normal;`,
        `  const f = ${ctx.inputExpr('frequency')}, s = ${ctx.inputExpr('strength')};`,
        `  for (let i = 0; i < pos.count; i++) {`,
        `    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);`,
        `    const d = s * ${nz}(x * f, y * f, z * f);`,
        `    pos.setXYZ(i, x + nrm.getX(i) * d, y + nrm.getY(i) * d, z + nrm.getZ(i) * d);`,
        `  }`,
        `  pos.needsUpdate = true;`,
        `}`,
        `${g}.computeVertexNormals();`,
      ],
      outputVar: g,
      imports: ['three'],
      helpers: ['noise'],
    };
  },
};
