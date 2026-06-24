import type { NodeDef } from '../NodeDef';
import { num } from '../helpers';

/**
 * Time — outputs the animation clock (seconds) scaled by `speed`. Wire it into an
 * Expression or any numeric input to animate the model. Press Play in the viewport to
 * advance it; exported code receives `time` as a parameter.
 */
export const timeNode: NodeDef = {
  type: 'value.time',
  category: 'Value',
  label: 'Time',
  description: 'The animation clock in seconds (× speed). Drives procedural animation.',
  timeDependent: true,
  inputs: [
    { id: 'speed', label: 'Speed', type: 'number', default: 1, control: { kind: 'slider', min: -5, max: 5, step: 0.1 } },
  ],
  outputs: [{ id: 'value', label: 'Value', type: 'number' }],

  evaluate(inputs, ctx) {
    return ctx.time * num(inputs, 'speed', 1);
  },

  codegen(ctx) {
    const v = ctx.uniqueVar('t');
    return {
      statements: [`const ${v} = time * ${ctx.inputExpr('speed')};`],
      outputVar: v,
    };
  },
};
