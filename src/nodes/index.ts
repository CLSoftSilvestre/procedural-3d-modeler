import { registerNode } from './registry';
import { primitiveNodes } from './primitives/primitives';
import { transformNode } from './modifiers/transform';
import { arrayNode } from './modifiers/array';
import { mirrorNode } from './modifiers/mirror';
import { booleanNode } from './booleans/boolean';
import { outputNode } from './output/output';

let registered = false;

/** Register all built-in nodes. Idempotent. */
export function registerBuiltinNodes(): void {
  if (registered) return;
  registered = true;
  for (const def of primitiveNodes) registerNode(def);
  registerNode(transformNode);
  registerNode(arrayNode);
  registerNode(mirrorNode);
  registerNode(booleanNode);
  registerNode(outputNode);
}

export * from './registry';
export type { NodeDef } from './NodeDef';
