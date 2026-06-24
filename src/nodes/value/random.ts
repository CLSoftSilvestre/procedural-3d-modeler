import { randomUnit } from '@/geometry/rng';
import type { NodeDef } from '../NodeDef';
import { num } from '../helpers';

/**
 * Random — a deterministic random number in [min, max] from a seed. Wire its output into
 * any numeric input (e.g. a primitive's radius) to vary it reproducibly.
 */
export const randomNode: NodeDef = {
  type: 'value.random',
  category: 'Value',
  label: 'Random',
  description: 'A deterministic random number in [min, max] from a seed.',
  inputs: [
    { id: 'seed', label: 'Seed', type: 'number', default: 1, control: { kind: 'slider', min: 0, max: 1000, step: 1 } },
    { id: 'min', label: 'Min', type: 'number', default: 0, control: { kind: 'number', step: 0.01 } },
    { id: 'max', label: 'Max', type: 'number', default: 1, control: { kind: 'number', step: 0.01 } },
  ],
  outputs: [{ id: 'value', label: 'Value', type: 'number' }],

  evaluate(inputs) {
    const min = num(inputs, 'min', 0);
    const max = num(inputs, 'max', 1);
    return min + randomUnit(num(inputs, 'seed', 1)) * (max - min);
  },

  codegen(ctx) {
    const v = ctx.uniqueVar('rand');
    const seed = ctx.inputExpr('seed');
    const min = ctx.inputExpr('min');
    const max = ctx.inputExpr('max');
    return {
      statements: [
        `const ${v} = (() => {`,
        `  let a = (${seed} >>> 0) || 1;`,
        `  a = (a + 0x6d2b79f5) | 0;`,
        `  let t = Math.imul(a ^ (a >>> 15), 1 | a);`,
        `  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;`,
        `  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;`,
        `  return ${min} + r * (${max} - ${min});`,
        `})();`,
      ],
      outputVar: v,
    };
  },
};
