import type { NodeDef } from './NodeDef';

const registry = new Map<string, NodeDef>();

export function registerNode(def: NodeDef): void {
  // Overwrite rather than throw: HMR can re-run registration after a module reload,
  // and a throw there would break the whole module graph.
  if (registry.has(def.type) && import.meta.env?.DEV) {
    console.debug(`Re-registering node type: ${def.type}`);
  }
  registry.set(def.type, def);
}

export function getNodeDef(type: string): NodeDef | undefined {
  return registry.get(type);
}

export function requireNodeDef(type: string): NodeDef {
  const def = registry.get(type);
  if (!def) throw new Error(`Unknown node type: ${type}`);
  return def;
}

export function allNodeDefs(): NodeDef[] {
  return [...registry.values()];
}

export function nodeDefsByCategory(): Map<string, NodeDef[]> {
  const byCat = new Map<string, NodeDef[]>();
  for (const def of registry.values()) {
    const list = byCat.get(def.category) ?? [];
    list.push(def);
    byCat.set(def.category, list);
  }
  return byCat;
}
