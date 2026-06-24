import { registerNode } from './registry';
import { primitiveNodes } from './primitives/primitives';
import { transformNode } from './modifiers/transform';
import { arrayNode } from './modifiers/array';
import { mirrorNode } from './modifiers/mirror';
import { displaceNode } from './deformers/displace';
import { twistNode } from './deformers/twist';
import { taperNode } from './deformers/taper';
import { booleanNode } from './booleans/boolean';
import { polygonNode } from './curves/polygon';
import { starNode } from './curves/star';
import { extrudeNode } from './generators/extrude';
import { latheNode } from './generators/lathe';
import { materialNode } from './material/material';
import { randomNode } from './value/random';
import { expressionNode } from './value/expression';
import { timeNode } from './value/time';
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
  registerNode(polygonNode);
  registerNode(starNode);
  registerNode(extrudeNode);
  registerNode(latheNode);
  registerNode(materialNode);
  registerNode(randomNode);
  registerNode(expressionNode);
  registerNode(timeNode);
  registerNode(outputNode);
}

export * from './registry';
export type { NodeDef } from './NodeDef';
