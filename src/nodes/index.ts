import { registerNode } from './registry';
import { boxNode } from './primitives/box';
import { outputNode } from './output/output';

let registered = false;

/** Register all built-in nodes. Idempotent. */
export function registerBuiltinNodes(): void {
  if (registered) return;
  registered = true;
  registerNode(boxNode);
  registerNode(outputNode);
}

export * from './registry';
export type { NodeDef } from './NodeDef';
