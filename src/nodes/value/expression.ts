import type { NodeDef } from '../NodeDef';
import { num, str } from '../helpers';

/**
 * Expression — evaluates a JS math formula of inputs `a` and `b` (and `Math`) to a number.
 * e.g. `a * sin(b)` won't work (no `sin` global) but `a * Math.sin(b)` does; `a + b`,
 * `a * b`, `Math.max(a, b)` all work. Wire its output into any numeric input.
 */
export const expressionNode: NodeDef = {
  type: 'value.expression',
  category: 'Value',
  label: 'Expression',
  description: 'Compute a number from a formula of a, b and Math (e.g. "a * b + 1").',
  inputs: [
    { id: 'a', label: 'a', type: 'number', default: 1, control: { kind: 'number', step: 0.01 } },
    { id: 'b', label: 'b', type: 'number', default: 1, control: { kind: 'number', step: 0.01 } },
    { id: 'formula', label: 'Formula', type: 'string', default: 'a * b', control: { kind: 'text' } },
  ],
  outputs: [{ id: 'value', label: 'Value', type: 'number' }],

  evaluate(inputs) {
    const a = num(inputs, 'a', 0);
    const b = num(inputs, 'b', 0);
    const formula = str(inputs, 'formula', 'a + b');
    try {
      // User-authored formula; runs in the worker. Restricted to a, b and Math.
      const fn = new Function('a', 'b', 'Math', `return (${formula});`) as (
        a: number,
        b: number,
        m: Math,
      ) => unknown;
      const r = fn(a, b, Math);
      return typeof r === 'number' && Number.isFinite(r) ? r : 0;
    } catch {
      return 0; // invalid/partial formula → 0 (no crash while typing)
    }
  },

  codegen(ctx) {
    const v = ctx.uniqueVar('expr');
    const formula = String(ctx.rawInput('formula') ?? 'a + b');
    return {
      statements: [
        `const ${v} = (() => {`,
        `  const a = ${ctx.inputExpr('a')}, b = ${ctx.inputExpr('b')};`,
        `  return (${formula});`,
        `})();`,
      ],
      outputVar: v,
    };
  },
};
