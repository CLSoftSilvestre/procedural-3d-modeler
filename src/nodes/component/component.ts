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
  // Added from the Projects library / palette "Components" group (which embeds a project),
  // not from the generic node list — a bare instance has no sub-model to render.
  hidden: true,
  inputs: [...transformInputs('Transform')],
  outputs: [{ id: 'geometry', label: 'Geometry', type: 'geometry' }],

  evaluate() {
    return emptyGeometry(); // real evaluation is handled in evaluate.ts (needs node.component)
  },

  codegen(ctx) {
    // Components are special-cased by the generator (it needs the per-node embedded graph to
    // emit a reusable helper function). This fallback is unused in practice.
    return { statements: [], outputVar: ctx.uniqueVar('component'), imports: ['three'] };
  },
};
