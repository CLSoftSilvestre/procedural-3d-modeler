import type { GeometryData } from '@/geometry/GeometryData';
import type { MaterialSpec } from '@/material/MaterialData';
import { mulberry32 } from '@/geometry/rng';
import type { Edge, Graph, GraphNode, LiteralValue, SocketValue } from '@/graph/types';
import { requireNodeDef } from '@/nodes/registry';
import type { EvalQuality, ResolvedInputs } from '@/nodes/NodeDef';
import { topoSort } from '@/graph/topology';
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
export function evaluateGraph(
  graph: Graph,
  seed = 1,
  cache?: EvalCache,
  quality: EvalQuality = 'full',
): EvalResult {
  const errors: EvalError[] = [];
  if (!graph.outputNodeId) return { geometry: null, material: null, errors };

  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const order = topoSort(graph);
  if (!order) {
    errors.push({ nodeId: '', message: 'Graph contains a cycle' });
    return { geometry: null, material: null, errors };
  }

  const outputs = new Map<string, Record<string, SocketValue>>();
  const nodeHashes = new Map<string, string>();
  const random = mulberry32(seed);

  // Exposed-parameter overrides: nodeId:socketId -> current param value.
  const paramOverrides = new Map<string, LiteralValue>();
  for (const p of graph.params) paramOverrides.set(`${p.nodeId}:${p.socketId}`, p.default);

  for (const nodeId of order) {
    const node = nodesById.get(nodeId);
    if (!node) continue;
    const def = requireNodeDef(node.type);
    const inputs = resolveInputs(node, graph.edges, outputs, paramOverrides);
    const outSocket = def.outputs[0]?.id ?? 'geometry';

    // Content hash = node type + effective literal values + seed + upstream node hashes.
    const upstream = graph.edges
      .filter((e) => e.target === nodeId)
      .map((e) => `${e.targetSocket}<-${nodeHashes.get(e.source) ?? '∅'}`)
      .sort()
      .join('|');
    const hash = fnv1a(
      `${node.type}#${stableValues(node.values)}#${paramSig(nodeId, paramOverrides)}#s${seed}#q${quality}#${upstream}`,
    );
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
      const result = def.evaluate(inputs, { random, quality }) as SocketValue;
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
  const outInputs = resolveInputs(outNode, graph.edges, outputs, paramOverrides);
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

/** Hash contribution of the param overrides bound to a node. */
function paramSig(nodeId: string, overrides: Map<string, LiteralValue>): string {
  const parts: string[] = [];
  for (const [key, val] of overrides) {
    if (key.startsWith(`${nodeId}:`)) parts.push(`${key}=${JSON.stringify(val)}`);
  }
  return parts.sort().join(',');
}

/** Resolve a node's inputs: connected edges win, then exposed params, then literals / defaults. */
function resolveInputs(
  node: GraphNode,
  edges: Edge[],
  outputs: Map<string, Record<string, SocketValue>>,
  paramOverrides: Map<string, LiteralValue>,
): ResolvedInputs {
  const def = requireNodeDef(node.type);
  const inputs: ResolvedInputs = {};
  for (const socket of def.inputs) {
    const edge = edges.find((e) => e.target === node.id && e.targetSocket === socket.id);
    const override = paramOverrides.get(`${node.id}:${socket.id}`);
    if (edge) {
      inputs[socket.id] = outputs.get(edge.source)?.[edge.sourceSocket];
    } else if (override !== undefined) {
      inputs[socket.id] = override;
    } else if (socket.id in node.values) {
      inputs[socket.id] = node.values[socket.id];
    } else if (socket.default !== undefined) {
      inputs[socket.id] = socket.default;
    }
  }
  return inputs;
}
