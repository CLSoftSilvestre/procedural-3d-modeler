import { GRAPH_VERSION, type Graph } from './types';
import { getNodeDef } from '@/nodes/registry';

/** Serialize a graph to a pretty JSON string (the native save format). */
export function serializeGraph(graph: Graph): string {
  return JSON.stringify(graph, null, 2);
}

export type DeserializeResult =
  | { ok: true; graph: Graph; warnings: string[] }
  | { ok: false; error: string };

/**
 * Parse and validate a `.graph.json` document. Tolerant of minor version drift, but
 * rejects structurally invalid graphs or graphs referencing unknown node types.
 */
export function deserializeGraph(json: string): DeserializeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'File is not valid JSON' };
  }

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Graph must be an object' };
  }
  const g = raw as Partial<Graph>;
  if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) {
    return { ok: false, error: 'Graph is missing nodes/edges arrays' };
  }

  const warnings: string[] = [];
  if (g.version !== GRAPH_VERSION) {
    warnings.push(`Graph version ${g.version ?? '(none)'} differs from ${GRAPH_VERSION}`);
  }
  for (const node of g.nodes) {
    if (!getNodeDef(node.type)) {
      return { ok: false, error: `Unknown node type: ${node.type}` };
    }
  }

  const graph: Graph = {
    version: GRAPH_VERSION,
    nodes: g.nodes,
    edges: g.edges,
    params: g.params ?? [],
    outputNodeId: g.outputNodeId ?? null,
  };
  return { ok: true, graph, warnings };
}

/** Trigger a browser download of the graph as a `.graph.json` file. */
export function downloadGraph(graph: Graph, filename = 'model.graph.json'): void {
  const blob = new Blob([serializeGraph(graph)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
