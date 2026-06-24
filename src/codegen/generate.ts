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
  /** Just the function body (statements + return) referencing `params` — for the parity harness. */
  functionBody: string;
  /** Concatenated helper sources used (for the parity harness). */
  helperSource: string;
  /** Module specifiers referenced (for the parity harness). */
  modules: string[];
  /** Default values for exposed params (name -> value) — for the parity harness. */
  paramDefaults: Record<string, unknown>;
  functionName: string;
  target: CodegenTarget;
  /** True if the graph reads the time clock (exported fn takes a `time` arg). */
  animated: boolean;
}

export type CodegenTarget = 'vanilla' | 'r3f';

export interface CodegenOptions {
  functionName?: string;
  target?: CodegenTarget;
}

/**
 * Generate a module that builds the graph's output mesh.
 * `target: 'vanilla'` → `createModel(params)` returning a THREE.Mesh.
 * `target: 'r3f'` → a React Three Fiber `<Model>` component.
 * Both share the exact same geometry/material-building statements, so the R3F output
 * inherits the vanilla path's parity guarantees.
 */
export function generateModule(graph: Graph, opts: CodegenOptions = {}): CodegenResult {
  const target = opts.target ?? 'vanilla';
  const functionName = opts.functionName ?? (target === 'r3f' ? 'Model' : 'createModel');
  const order = topoSort(graph);
  if (!order) throw new Error('Cannot generate code: graph contains a cycle');

  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  // outVar[nodeId][socketId] = variable name
  const outVar = new Map<string, Record<string, string>>();
  const statements: string[] = [];
  const modules = new Set<string>();
  const helpers = new Set<string>();
  const counters = new Map<string, number>();

  // Exposed params: bound socket -> param; plus the defaults object for the signature.
  const paramBySocket = new Map<string, (typeof graph.params)[number]>();
  for (const p of graph.params) paramBySocket.set(`${p.nodeId}:${p.socketId}`, p);

  const uniqueVar = (hint: string): string => {
    const base = hint.replace(/[^a-zA-Z0-9_]/g, '') || 'v';
    const n = (counters.get(base) ?? 0) + 1;
    counters.set(base, n);
    return `${base}${n}`;
  };

  /** Resolve an input socket to an upstream variable, a param reference, or a literal. */
  const exprFor = (nodeId: string, socketId: string): string => {
    const node = nodesById.get(nodeId)!;
    const def = requireNodeDef(node.type);
    const socket = def.inputs.find((s) => s.id === socketId);
    const edge = graph.edges.find((e) => e.target === nodeId && e.targetSocket === socketId);
    if (edge) {
      const v = outVar.get(edge.source)?.[edge.sourceSocket];
      if (v) return v;
    }
    const param = paramBySocket.get(`${nodeId}:${socketId}`);
    if (param) return `params.${param.name}`;
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
      rawInput: (socketId) => {
        const edge = graph.edges.find((e) => e.target === nodeId && e.targetSocket === socketId);
        if (edge) return undefined;
        const socket = def.inputs.find((s) => s.id === socketId);
        return node.values[socketId] ?? socket?.default;
      },
    };
    const frag = def.codegen(ctx);
    if (frag.statements.length) statements.push(...frag.statements);
    frag.imports?.forEach((m) => modules.add(m));
    frag.helpers?.forEach((h) => helpers.add(h));
    const outSocket = def.outputs[0];
    if (outSocket) outVar.set(nodeId, { [outSocket.id]: frag.outputVar });
  }

  // Resolve the Output node's geometry + material inputs to variables.
  modules.add('three');
  const DEFAULT_MATERIAL = 'new THREE.MeshStandardMaterial({ color: 0x6ea8fe, roughness: 0.5 })';
  const outNodeId = graph.outputNodeId;
  let geomVar = 'new THREE.BufferGeometry()';
  let matExpr = DEFAULT_MATERIAL;
  if (outNodeId && nodesById.has(outNodeId)) {
    // Geometry is multi-input: gather every connected geometry and merge if there's >1.
    const geomVars = graph.edges
      .filter((e) => e.target === outNodeId && e.targetSocket === 'geometry')
      .map((e) => outVar.get(e.source)?.[e.sourceSocket])
      .filter((v): v is string => Boolean(v));
    if (geomVars.length === 1) {
      geomVar = geomVars[0]!;
    } else if (geomVars.length > 1) {
      const merged = uniqueVar('merged');
      statements.push(
        `const ${merged} = BufferGeometryUtils.mergeGeometries([${geomVars.join(', ')}], false);`,
      );
      modules.add('three/examples/jsm/utils/BufferGeometryUtils.js');
      geomVar = merged;
    }
    const matEdge = graph.edges.find((e) => e.target === outNodeId && e.targetSocket === 'material');
    const m = matEdge && outVar.get(matEdge.source)?.[matEdge.sourceSocket];
    if (m) matExpr = m;
  }

  // Exposed parameters → default object.
  const paramDefaults: Record<string, unknown> = {};
  for (const p of graph.params) paramDefaults[p.name] = p.default;
  const defaultsLiteral = graph.params.length
    ? `{\n${graph.params.map((p) => `  ${p.name}: ${renderLiteral(p.default, p.type)},`).join('\n')}\n}`
    : '{}';

  // Animated if any node reads the time clock.
  const animated = graph.nodes.some((nd) => requireNodeDef(nd.type).timeDependent);

  const helperSource = helperSourceFor(helpers);
  const indent = (src: string, pad = '  ') =>
    src
      .split('\n')
      .map((l) => (l.length ? pad + l : l))
      .join('\n');

  // functionBody is always the runnable (mesh-returning) form used by the parity harness.
  const functionBody = [...statements, `return new THREE.Mesh(${geomVar}, ${matExpr});`].join('\n');

  let code: string;
  if (target === 'r3f') {
    const reactImport = animated
      ? "import { useMemo, useRef, useState } from 'react';\nimport { useFrame } from '@react-three/fiber';"
      : "import { useMemo } from 'react';";
    const importLines = [reactImport, ...importStatementsFor(modules)];
    const paramsObj = graph.params.length
      ? `{\n${graph.params.map((p) => `    ${p.name}: props.${p.name} ?? ${renderLiteral(p.default, p.type)},`).join('\n')}\n  }`
      : '{}';
    const deps = [...graph.params.map((p) => `params.${p.name}`), ...(animated ? ['time'] : [])].join(', ');
    const memoBody = indent(
      [...statements, `return { geometry: ${geomVar}, material: ${matExpr} };`].join('\n'),
      '    ',
    );
    const component = [
      '/** Procedurally generated React Three Fiber component. */',
      `export function ${functionName}(props = {}) {`,
      `  const params = ${paramsObj};`,
      ...(animated
        ? [
            '  const [time, setTime] = useState(0);',
            '  useFrame((state) => setTime(state.clock.elapsedTime));',
          ]
        : []),
      `  const { geometry, material } = useMemo(() => {`,
      memoBody,
      `  }, [${deps}]);`,
      `  return <mesh geometry={geometry} material={material} />;`,
      `}`,
    ].join('\n');
    code = [importLines.join('\n'), helperSource, component].filter(Boolean).join('\n\n') + '\n';
  } else {
    const importLines = importStatementsFor(modules);
    const sig = `params = ${defaultsLiteral}${animated ? ', time = 0' : ''}`;
    const fn = [
      '/** Procedurally generated with Procedural 3D Modeler. */',
      `export function ${functionName}(${sig}) {`,
      indent(functionBody),
      '}',
    ].join('\n');
    code = [importLines.join('\n'), helperSource, fn].filter(Boolean).join('\n\n') + '\n';
  }

  return {
    code,
    functionBody,
    helperSource,
    modules: [...modules],
    paramDefaults,
    functionName,
    target,
    animated,
  };
}
