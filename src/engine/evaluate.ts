import { withMaterial, type GeometryData } from '@/geometry/GeometryData';
import type { MaterialSpec } from '@/material/MaterialData';
import { mulberry32 } from '@/geometry/rng';
import type { Edge, Graph, GraphNode, LiteralValue, SocketValue } from '@/graph/types';
import { requireNodeDef } from '@/nodes/registry';
import type { EvalQuality, ResolvedInputs } from '@/nodes/NodeDef';
import { applyTransform, hasTransform } from '@/nodes/transformShared';
import { topoSort } from '@/graph/topology';
import { fnv1a } from './hash';

/** Guard against a component (directly or indirectly) referencing itself. */
const MAX_COMPONENT_DEPTH = 8;

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
  time = 0,
  depth = 0,
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
    // Time only enters the hash for time-dependent nodes, so static subgraphs stay cached
    // while the animated path recomputes each frame.
    const timeSig = def.timeDependent ? `#t${time}` : '';
    // Components hash their embedded sub-model so different parts don't collide (same node type).
    let compSig = '';
    if (node.component) {
      try {
        compSig = `#c${fnv1a(JSON.stringify(node.component.graph) + node.component.sourceId)}`;
      } catch {
        compSig = `#c${node.component.sourceId}`; // cyclic embed (unexpected) — fall back to id
      }
    }
    const hash = fnv1a(
      `${node.type}#${stableValues(node.values)}#${paramSig(nodeId, paramOverrides)}#s${seed}#q${quality}${timeSig}${compSig}#${upstream}`,
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
      const result =
        node.type === 'component.instance' && node.component
          ? evalComponent(node, inputs, seed, quality, time, depth, errors)
          : (def.evaluate(inputs, { random, quality, time }) as SocketValue);
      outputs.set(nodeId, { [outSocket]: result as SocketValue });
      if (result !== undefined) cache?.set(hash, result as SocketValue);
    } catch (err) {
      errors.push({ nodeId, message: err instanceof Error ? err.message : String(err) });
      return { geometry: null, material: null, errors };
    }
  }

  cache?.sweep();

  const outNode = nodesById.get(graph.outputNodeId);
  if (!outNode) return { geometry: null, material: null, errors };
  // Geometry is the output node's (merged) evaluated result; material is read off its socket.
  const geometry = (outputs.get(graph.outputNodeId)?.geometry as GeometryData | undefined) ?? null;
  const outInputs = resolveInputs(outNode, graph.edges, outputs, paramOverrides);
  const material = (outInputs.material as MaterialSpec | undefined) ?? null;
  return { geometry, material, errors };
}

/**
 * Evaluate a component instance: clone its embedded sub-model, apply this instance's parameter
 * values onto the sub-model's exposed params, recursively evaluate, then apply the instance's
 * built-in transform for placement. Recursion is depth-guarded against self-reference.
 */
function evalComponent(
  node: GraphNode,
  inputs: ResolvedInputs,
  seed: number,
  quality: EvalQuality,
  time: number,
  depth: number,
  errors: EvalError[],
): GeometryData | undefined {
  const ref = node.component!;
  if (depth >= MAX_COMPONENT_DEPTH) {
    errors.push({ nodeId: node.id, message: 'Component nesting too deep (possible self-reference)' });
    return undefined;
  }
  const sub = structuredClone(ref.graph);
  for (const p of sub.params ?? []) {
    const v = node.values[p.name];
    if (v !== undefined) p.default = v; // instance value overrides the source default
  }
  const res = evaluateGraph(sub, seed, undefined, quality, time, depth + 1);
  if (res.errors.length) {
    errors.push({ nodeId: node.id, message: `Component “${ref.name}”: ${res.errors[0]!.message}` });
  }
  let geom = res.geometry ?? undefined;
  if (geom && hasTransform(inputs)) geom = applyTransform(geom, inputs);
  // Carry the sub-model's material so each part keeps its appearance in the assembly.
  if (geom && res.material) geom = withMaterial(geom, res.material);
  return geom;
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
    // Multi-input socket: collect all incoming edges into an array of upstream values.
    if (socket.multi) {
      const vals = edges
        .filter((e) => e.target === node.id && e.targetSocket === socket.id)
        .map((e) => outputs.get(e.source)?.[e.sourceSocket])
        .filter((v): v is SocketValue => v !== undefined);
      inputs[socket.id] = vals as unknown as SocketValue;
      continue;
    }
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
