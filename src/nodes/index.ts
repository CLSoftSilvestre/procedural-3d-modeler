import { registerNode } from './registry';
import { primitiveNodes } from './primitives/primitives';
import { transformNode } from './modifiers/transform';
import { outputNode } from './output/output';

let registered = false;

/** Register all built-in nodes. Idempotent. */
export function registerBuiltinNodes(): void {
  if (registered) return;
  registered = true;
  for (const def of primitiveNodes) registerNode(def);
  registerNode(transformNode);
  registerNode(outputNode);
}

export * from './registry';
export type { NodeDef } from './NodeDef';
