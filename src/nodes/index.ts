import { registerNode } from './registry';
import { primitiveNodes } from './primitives/primitives';
import { transformNode } from './modifiers/transform';
import { arrayNode } from './modifiers/array';
import { mirrorNode } from './modifiers/mirror';
import { displaceNode } from './deformers/displace';
import { twistNode } from './deformers/twist';
import { taperNode } from './deformers/taper';
import { booleanNode } from './booleans/boolean';
import { materialNode } from './material/material';
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
  registerNode(displaceNode);
  registerNode(twistNode);
  registerNode(taperNode);
  registerNode(booleanNode);
  registerNode(materialNode);
  registerNode(outputNode);
}

export * from './registry';
export type { NodeDef } from './NodeDef';
