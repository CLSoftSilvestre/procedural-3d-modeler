import type { ComponentRef, ExposedParam, Graph } from '@/graph/types';
import { topoSort } from '@/graph/topology';
import { requireNodeDef } from '@/nodes/registry';
import type { CodegenContext } from '@/nodes/NodeDef';
import { transformStatements } from '@/nodes/transformShared';
import { fnv1a } from '@/engine/hash';
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

const DEFAULT_MATERIAL = 'new THREE.MeshStandardMaterial({ color: 0x6ea8fe, roughness: 0.5 })';
const MAX_COMPONENT_DEPTH = 8;

const indent = (src: string, pad = '  ') =>
  src
    .split('\n')
    .map((l) => (l.length ? pad + l : l))
    .join('\n');

/** `{ name: <default>, ... }` literal for a function signature default. */
function paramDefaultsLiteral(params: ExposedParam[]): string {
  if (!params.length) return '{}';
  return `{\n${params.map((p) => `  ${p.name}: ${renderLiteral(p.default, p.type)},`).join('\n')}\n}`;
}

/** `{ name: <instance value> }` arguments for a component instance call. */
function renderParamArgs(params: ExposedParam[], values: Record<string, unknown>): string {
  if (!params.length) return '{}';
  const entries = params.map(
    (p) => `${p.name}: ${renderLiteral((values[p.name] ?? p.default) as never, p.type)}`,
  );
  return `{ ${entries.join(', ')} }`;
}

/**
 * Generate a module that builds the graph's output mesh.
 * `target: 'vanilla'` → `createModel(params)` returning a THREE.Mesh.
 * `target: 'r3f'` → a React Three Fiber `<Model>` component.
 *
 * Assembly components are emitted as nested helper functions (one per distinct sub-model,
 * deduped) and called per instance with that instance's parameter values + transform.
 */
export function generateModule(graph: Graph, opts: CodegenOptions = {}): CodegenResult {
  const target = opts.target ?? 'vanilla';
  const functionName = opts.functionName ?? (target === 'r3f' ? 'Model' : 'createModel');

  // Shared across the whole module (host body + all nested component helpers).
  const modules = new Set<string>();
  const helpers = new Set<string>();
  const componentHelpers = new Map<string, { name: string; src: string }>();
  const helperNameCounts = new Map<string, number>();

  const uniqueHelperName = (hint: string): string => {
    const base = `part_${hint}`.replace(/[^A-Za-z0-9_]/g, '') || 'part';
    const n = (helperNameCounts.get(base) ?? 0) + 1;
    helperNameCounts.set(base, n);
    return n === 1 ? base : `${base}${n}`;
  };

  /** Register (once) a helper function for a sub-model and return its name. */
  function ensureComponentHelper(ref: ComponentRef, depth: number): string {
    let key: string;
    try {
      key = ref.sourceId + fnv1a(JSON.stringify(ref.graph));
    } catch {
      key = ref.sourceId;
    }
    const existing = componentHelpers.get(key);
    if (existing) return existing.name;

    const name = uniqueHelperName(ref.name);
    componentHelpers.set(key, { name, src: '' }); // reserve to break recursion
    modules.add('three');

    if (depth >= MAX_COMPONENT_DEPTH) {
      componentHelpers.set(key, {
        name,
        src: `function ${name}(params = {}) {\n  return new THREE.BufferGeometry(); // component nesting too deep\n}`,
      });
      return name;
    }

    const body = buildBody(ref.graph, depth + 1);
    const subAnimated = ref.graph.nodes.some((n) => requireNodeDef(n.type).timeDependent);
    const inner = [
      ...(subAnimated ? ['const time = 0; // animated sub-models bake at t=0 on export'] : []),
      ...body.statements,
      `return ${body.geomVar};`,
    ].join('\n');
    componentHelpers.set(key, {
      name,
      src: `function ${name}(params = ${paramDefaultsLiteral(ref.graph.params)}) {\n${indent(inner)}\n}`,
    });
    return name;
  }

  /** Build the geometry-producing statements for one graph (host or a sub-model). */
  function buildBody(g: Graph, depth: number): { statements: string[]; geomVar: string; matExpr: string } {
    const order = topoSort(g);
    if (!order) throw new Error('Cannot generate code: graph contains a cycle');
    const nodesById = new Map(g.nodes.map((n) => [n.id, n]));
    const outVar = new Map<string, Record<string, string>>();
    const statements: string[] = [];
    const counters = new Map<string, number>();
    const paramBySocket = new Map<string, ExposedParam>();
    for (const p of g.params) paramBySocket.set(`${p.nodeId}:${p.socketId}`, p);

    const uniqueVar = (hint: string): string => {
      const base = hint.replace(/[^a-zA-Z0-9_]/g, '') || 'v';
      const n = (counters.get(base) ?? 0) + 1;
      counters.set(base, n);
      return `${base}${n}`;
    };

    const exprFor = (nodeId: string, socketId: string): string => {
      const node = nodesById.get(nodeId)!;
      const def = requireNodeDef(node.type);
      const socket = def.inputs.find((s) => s.id === socketId);
      const edge = g.edges.find((e) => e.target === nodeId && e.targetSocket === socketId);
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
          const edge = g.edges.find((e) => e.target === nodeId && e.targetSocket === socketId);
          if (edge) return undefined;
          const socket = def.inputs.find((s) => s.id === socketId);
          return node.values[socketId] ?? socket?.default;
        },
      };

      // Component instance: call its sub-model helper with this instance's params + transform.
      if (node.type === 'component.instance' && node.component) {
        const fnName = ensureComponentHelper(node.component, depth);
        const v = uniqueVar('component');
        statements.push(`const ${v} = ${fnName}(${renderParamArgs(node.component.params, node.values)});`);
        statements.push(...transformStatements(ctx, v));
        modules.add('three');
        outVar.set(nodeId, { geometry: v });
        continue;
      }

      const frag = def.codegen(ctx);
      if (frag.statements.length) statements.push(...frag.statements);
      frag.imports?.forEach((m) => modules.add(m));
      frag.helpers?.forEach((h) => helpers.add(h));
      const outSocket = def.outputs[0];
      if (outSocket) outVar.set(nodeId, { [outSocket.id]: frag.outputVar });
    }

    // Resolve the Output node: merge all connected geometries; pick up the material.
    modules.add('three');
    let geomVar = 'new THREE.BufferGeometry()';
    let matExpr = DEFAULT_MATERIAL;
    const outNodeId = g.outputNodeId;
    if (outNodeId && nodesById.has(outNodeId)) {
      const geomVars = g.edges
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
      const matEdge = g.edges.find((e) => e.target === outNodeId && e.targetSocket === 'material');
      const m = matEdge && outVar.get(matEdge.source)?.[matEdge.sourceSocket];
      if (m) matExpr = m;
    }
    return { statements, geomVar, matExpr };
  }

  const top = buildBody(graph, 0);
  const componentSrcs = [...componentHelpers.values()].map((h) => h.src).filter(Boolean);
  // Nested helper declarations live at the top of the function body (hoisted, self-contained).
  const statements = [...componentSrcs, ...top.statements];
  const { geomVar, matExpr } = top;

  // Exposed parameters → default object (host graph only).
  const paramDefaults: Record<string, unknown> = {};
  for (const p of graph.params) paramDefaults[p.name] = p.default;
  const defaultsLiteral = paramDefaultsLiteral(graph.params);

  // Animated if any host node reads the time clock (components bake at t=0).
  const animated = graph.nodes.some((nd) => requireNodeDef(nd.type).timeDependent);

  const helperSource = helperSourceFor(helpers);

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
