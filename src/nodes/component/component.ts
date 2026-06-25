import { emptyGeometry } from '@/geometry/GeometryData';
import type { NodeDef } from '../NodeDef';
import { transformInputs } from '../transformShared';

/**
 * Component — an instance of another saved model (an assembly part). The embedded sub-model
 * and its exposed parameters live on the node (`node.component`); the engine evaluates that
 * sub-graph with this instance's parameter values and applies the built-in transform for
 * placement (see evaluate.ts). Its exposed parameters are edited in the Inspector.
 *
 * `evaluate`/`codegen` here are placeholders — the engine and generator special-case
 * components (they need the per-node embedded graph, which isn't a socket input).
 */
export const componentNode: NodeDef = {
  type: 'component.instance',
  category: 'Components',
  label: 'Component',
  description: 'An instance of another saved model — adjust its parameters and place it.',
  inputs: [...transformInputs('Transform')],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate() {
    return emptyGeometry(); // real evaluation is handled in evaluate.ts (needs node.component)
  },

  codegen(ctx) {
    // Phase A: components render live but export as empty geometry. Assembly export (inlining
    // the sub-model as a reusable function) is Phase B.
    const v = ctx.uniqueVar('component');
    return {
      statements: [
        `const ${v} = new THREE.BufferGeometry(); // TODO: component/assembly export coming soon`,
      ],
      outputVar: v,
      imports: ['three'],
    };
  },
};
