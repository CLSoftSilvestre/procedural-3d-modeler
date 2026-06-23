import type { Graph } from '@/graph/types';
import { topoSort } from '@/graph/topology';
import { requireNodeDef } from '@/nodes/registry';
import type { CodegenContext } from '@/nodes/NodeDef';
import { renderLiteral } from './literal';
import { importStatementsFor } from './imports';
import { helperSourceFor } from './helpers';

export interface CodegenResult {
  /** Full, ready-to-paste ES module (imports + helpers + function). */
  code: string;
  /** Just the function body (statements + return), no imports/helpers — for the parity harness. */
  functionBody: string;
  /** Concatenated helper sources used (for the parity harness). */
  helperSource: string;
  /** Module specifiers referenced (for the parity harness). */
  modules: string[];
  functionName: string;
}

export interface CodegenOptions {
  functionName?: string;
}

/** Generate a vanilla three.js module that builds the graph's output mesh. */
export function generateModule(graph: Graph, opts: CodegenOptions = {}): CodegenResult {
  const functionName = opts.functionName ?? 'createModel';
  const order = topoSort(graph);
  if (!order) throw new Error('Cannot generate code: graph contains a cycle');

  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  // outVar[nodeId][socketId] = variable name
  const outVar = new Map<string, Record<string, string>>();
  const statements: string[] = [];
  const modules = new Set<string>();
  const helpers = new Set<string>();
  const counters = new Map<string, number>();

  const uniqueVar = (hint: string): string => {
    const base = hint.replace(/[^a-zA-Z0-9_]/g, '') || 'v';
    const n = (counters.get(base) ?? 0) + 1;
    counters.set(base, n);
    return `${base}${n}`;
  };

  /** Resolve an input socket to an upstream variable or a rendered literal. */
  const exprFor = (nodeId: string, socketId: string): string => {
    const node = nodesById.get(nodeId)!;
    const def = requireNodeDef(node.type);
    const socket = def.inputs.find((s) => s.id === socketId);
    const edge = graph.edges.find((e) => e.target === nodeId && e.targetSocket === socketId);
    if (edge) {
      const v = outVar.get(edge.source)?.[edge.sourceSocket];
      if (v) return v;
    }
    const value = node.values[socketId] ?? socket?.default;
    return renderLiteral(value, socket?.type ?? 'number');
  };

  for (const nodeId of order) {
    const node = nodesById.get(nodeId);
    if (!node) continue;
    const def = requireNodeDef(node.type);
    const ctx: CodegenContext = {
      uniqueVar,
      inputExpr: (socketId) => exprFor(nodeId, socketId),
    };
    const frag = def.codegen(ctx);
    if (frag.statements.length) statements.push(...frag.statements);
    frag.imports?.forEach((m) => modules.add(m));
    frag.helpers?.forEach((h) => helpers.add(h));
    const outSocket = def.outputs[0];
    if (outSocket) outVar.set(nodeId, { [outSocket.id]: frag.outputVar });
  }

  // Assemble the output mesh from the Output node's geometry + material inputs.
  modules.add('three');
  const outNodeId = graph.outputNodeId;
  let returnStmt = 'return new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial());';
  if (outNodeId && nodesById.has(outNodeId)) {
    const geomEdge = graph.edges.find((e) => e.target === outNodeId && e.targetSocket === 'geometry');
    const matEdge = graph.edges.find((e) => e.target === outNodeId && e.targetSocket === 'material');
    const geomVar = geomEdge && outVar.get(geomEdge.source)?.[geomEdge.sourceSocket];
    const matVar = matEdge && outVar.get(matEdge.source)?.[matEdge.sourceSocket];
    if (geomVar) {
      const material = matVar ?? 'new THREE.MeshStandardMaterial({ color: 0x6ea8fe, roughness: 0.5 })';
      returnStmt = `return new THREE.Mesh(${geomVar}, ${material});`;
    }
  }

  const functionBody = [...statements, returnStmt].join('\n');
  const helperSource = helperSourceFor(helpers);
  const importLines = importStatementsFor(modules);

  const indentedBody = functionBody
    .split('\n')
    .map((l) => (l.length ? `  ${l}` : l))
    .join('\n');

  const codeParts = [
    importLines.join('\n'),
    helperSource,
    `/** Procedurally generated with Procedural 3D Modeler. */\nexport function ${functionName}() {\n${indentedBody}\n}`,
  ].filter(Boolean);

  return {
    code: codeParts.join('\n\n') + '\n',
    functionBody,
    helperSource,
    modules: [...modules],
    functionName,
  };
}
