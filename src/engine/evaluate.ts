import type { GeometryData } from '@/geometry/GeometryData';
import type { MaterialSpec } from '@/material/MaterialData';
import { mulberry32 } from '@/geometry/rng';
import type { Edge, Graph, GraphNode, SocketValue } from '@/graph/types';
import { requireNodeDef } from '@/nodes/registry';
import type { ResolvedInputs } from '@/nodes/NodeDef';
import { fnv1a } from './hash';

export interface EvalError {
  nodeId: string;
  message: string;
}

export interface EvalResult {
  geometry: GeometryData | null;
  material: MaterialSpec | null;
  errors: EvalError[];
}

/**
 * Persistent content-hash cache. Keyed by a hash of (nodeType, literal inputs, seed,
 * upstream output hashes), so identical subgraphs are reused across evaluations and only
 * genuinely-changed subgraphs recompute. Lives in the worker; survives between evaluates.
 * See ARCHITECTURE.md §4.
 */
export class EvalCache {
  private map = new Map<string, SocketValue>();
  /** Hashes touched during the current evaluation, used for garbage collection. */
  private live = new Set<string>();

  get(hash: string): SocketValue | undefined {
    return this.map.get(hash);
  }
  set(hash: string, value: SocketValue): void {
    this.map.set(hash, value);
  }
  markLive(hash: string): void {
    this.live.add(hash);
  }
  /** Drop cache entries not touched in the last evaluation. */
  sweep(): void {
    for (const key of this.map.keys()) {
      if (!this.live.has(key)) this.map.delete(key);
    }
    this.live.clear();
  }
  clear(): void {
    this.map.clear();
    this.live.clear();
  }
  get size(): number {
    return this.map.size;
  }
}

/**
 * Evaluate a graph to the geometry at its output node.
 * Topo-sorts the DAG, evaluates each node (reusing cached results by content hash),
 * and threads outputs along edges.
 */
export function evaluateGraph(graph: Graph, seed = 1, cache?: EvalCache): EvalResult {
  const errors: EvalError[] = [];
  if (!graph.outputNodeId) return { geometry: null, material: null, errors };

  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const order = topoSort(graph, errors);
  if (!order) return { geometry: null, material: null, errors };

  const outputs = new Map<string, Record<string, SocketValue>>();
  const nodeHashes = new Map<string, string>();
  const random = mulberry32(seed);

  for (const nodeId of order) {
    const node = nodesById.get(nodeId);
    if (!node) continue;
    const def = requireNodeDef(node.type);
    const inputs = resolveInputs(node, graph.edges, outputs);
    const outSocket = def.outputs[0]?.id ?? 'geometry';

    // Content hash = node type + literal values + seed + upstream node hashes.
    const upstream = graph.edges
      .filter((e) => e.target === nodeId)
      .map((e) => `${e.targetSocket}<-${nodeHashes.get(e.source) ?? '∅'}`)
      .sort()
      .join('|');
    const hash = fnv1a(`${node.type}#${stableValues(node.values)}#s${seed}#${upstream}`);
    nodeHashes.set(nodeId, hash);

    if (cache) {
      cache.markLive(hash);
      const cached = cache.get(hash);
      if (cached !== undefined) {
        outputs.set(nodeId, { [outSocket]: cached });
        continue;
      }
    }

    try {
      const result = def.evaluate(inputs, { random }) as SocketValue;
      outputs.set(nodeId, { [outSocket]: result });
      cache?.set(hash, result);
    } catch (err) {
      errors.push({ nodeId, message: err instanceof Error ? err.message : String(err) });
      return { geometry: null, material: null, errors };
    }
  }

  cache?.sweep();

  const outNode = nodesById.get(graph.outputNodeId);
  if (!outNode) return { geometry: null, material: null, errors };
  const outInputs = resolveInputs(outNode, graph.edges, outputs);
  const geometry = (outInputs.geometry as GeometryData | undefined) ?? null;
  const material = (outInputs.material as MaterialSpec | undefined) ?? null;
  return { geometry, material, errors };
}

/** Stable stringification of a node's literal values (sorted keys). */
function stableValues(values: GraphNode['values']): string {
  return Object.keys(values)
    .sort()
    .map((k) => `${k}=${JSON.stringify(values[k])}`)
    .join(',');
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
function topoSort(graph: Graph, errors: EvalError[]): string[] | null {
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
