import type { Edge, Graph } from './types';
import { requireNodeDef } from '@/nodes/registry';

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * Validate a proposed edge before it is added:
 *  - both endpoints exist and sockets are real,
 *  - socket types match,
 *  - the connection does not introduce a cycle.
 */
export function validateConnection(graph: Graph, edge: Omit<Edge, 'id'>): ValidationResult {
  if (edge.source === edge.target) return { ok: false, reason: 'Cannot connect a node to itself' };

  const sourceNode = graph.nodes.find((n) => n.id === edge.source);
  const targetNode = graph.nodes.find((n) => n.id === edge.target);
  if (!sourceNode || !targetNode) return { ok: false, reason: 'Unknown node' };

  const sourceDef = requireNodeDef(sourceNode.type);
  const targetDef = requireNodeDef(targetNode.type);
  const outSocket = sourceDef.outputs.find((s) => s.id === edge.sourceSocket);
  const inSocket = targetDef.inputs.find((s) => s.id === edge.targetSocket);
  if (!outSocket || !inSocket) return { ok: false, reason: 'Unknown socket' };

  if (outSocket.type !== inSocket.type) {
    return {
      ok: false,
      reason: `Type mismatch: ${outSocket.type} → ${inSocket.type}`,
    };
  }

  if (wouldCreateCycle(graph, edge.source, edge.target)) {
    return { ok: false, reason: 'Connection would create a cycle' };
  }

  return { ok: true };
}

/** Does adding source→target create a cycle? True if target can already reach source. */
function wouldCreateCycle(graph: Graph, source: string, target: string): boolean {
  const stack = [target];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === source) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of graph.edges) {
      if (e.source === id) stack.push(e.target);
    }
  }
  return false;
}
