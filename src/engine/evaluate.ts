import type { GeometryData } from '@/geometry/GeometryData';
import { mulberry32 } from '@/geometry/rng';
import type { Edge, Graph, GraphNode, SocketValue } from '@/graph/types';
import { requireNodeDef } from '@/nodes/registry';
import type { ResolvedInputs } from '@/nodes/NodeDef';

export interface EvalResult {
  geometry: GeometryData | null;
  errors: { nodeId: string; message: string }[];
}

/**
 * Evaluate a graph to the geometry at its output node.
 *
 * Phase 1: synchronous, main-thread, no caching. Topo-sorts the DAG, evaluates each
 * node, threads outputs along edges. Caching + worker execution arrive in Phase 2.
 * See ARCHITECTURE.md §4.
 */
export function evaluateGraph(graph: Graph, seed = 1): EvalResult {
  const errors: EvalResult['errors'] = [];
  if (!graph.outputNodeId) return { geometry: null, errors };

  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const order = topoSort(graph, errors);
  if (!order) return { geometry: null, errors };

  // outputs[nodeId][socketId] = value
  const outputs = new Map<string, Record<string, SocketValue>>();
  const random = mulberry32(seed);

  for (const nodeId of order) {
    const node = nodesById.get(nodeId);
    if (!node) continue;
    const def = requireNodeDef(node.type);
    const inputs = resolveInputs(node, graph.edges, outputs);
    try {
      const result = def.evaluate(inputs, { random });
      // Single-output convention: map the result to the (first) output socket.
      const outSocket = def.outputs[0]?.id ?? 'geometry';
      outputs.set(nodeId, { [outSocket]: result as SocketValue });
    } catch (err) {
      errors.push({ nodeId, message: err instanceof Error ? err.message : String(err) });
      return { geometry: null, errors };
    }
  }

  const outNode = nodesById.get(graph.outputNodeId);
  if (!outNode) return { geometry: null, errors };
  // The output node passes its geometry input through; read it back from resolved inputs.
  const outInputs = resolveInputs(outNode, graph.edges, outputs);
  const geometry = (outInputs.geometry as GeometryData | undefined) ?? null;
  return { geometry, errors };
}

/** Resolve a node's inputs: connected edges win, otherwise literal values / socket defaults. */
function resolveInputs(
  node: GraphNode,
  edges: Edge[],
  outputs: Map<string, Record<string, SocketValue>>,
): ResolvedInputs {
  const def = requireNodeDef(node.type);
  const inputs: ResolvedInputs = {};
  for (const socket of def.inputs) {
    const edge = edges.find((e) => e.target === node.id && e.targetSocket === socket.id);
    if (edge) {
      inputs[socket.id] = outputs.get(edge.source)?.[edge.sourceSocket];
    } else if (socket.id in node.values) {
      inputs[socket.id] = node.values[socket.id];
    } else if (socket.default !== undefined) {
      inputs[socket.id] = socket.default;
    }
  }
  return inputs;
}

/** Kahn topological sort. Returns null (and records an error) if a cycle exists. */
function topoSort(graph: Graph, errors: EvalResult['errors']): string[] | null {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const n of graph.nodes) {
    indegree.set(n.id, 0);
    adjacency.set(n.id, []);
  }
  for (const e of graph.edges) {
    if (!indegree.has(e.target) || !indegree.has(e.source)) continue;
    adjacency.get(e.source)!.push(e.target);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }
  const queue = [...indegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const d = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  if (order.length !== graph.nodes.length) {
    errors.push({ nodeId: '', message: 'Graph contains a cycle' });
    return null;
  }
  return order;
}
