import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph } from '@/engine/evaluate';
import { generateModule } from '@/codegen/generate';
import { runGenerated } from '@/codegen/runGenerated';
import { GRAPH_VERSION, type Edge, type Graph, type GraphNode } from '@/graph/types';

registerBuiltinNodes();

/** Build a graph from node specs + edges. */
function makeGraph(
  specs: { id: string; type: string; values?: Record<string, unknown> }[],
  edges: Edge[],
  outputNodeId = 'out',
): Graph {
  const nodes: GraphNode[] = specs.map((s) => ({
    id: s.id,
    type: s.type,
    position: { x: 0, y: 0 },
    values: (s.values ?? {}) as GraphNode['values'],
  }));
  return { version: GRAPH_VERSION, nodes, edges, params: [], outputNodeId };
}

const edge = (id: string, source: string, target: string, sock = 'geometry'): Edge => ({
  id,
  source,
  sourceSocket: sock,
  target,
  targetSocket: sock,
});

/** Max abs difference between two position buffers (asserts equal length). */
function maxDiff(a: Float32Array, b: Float32Array): number {
  expect(a.length).toBe(b.length);
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!));
  return m;
}

/** Evaluate the graph and run its generated code; assert positions match. */
function expectParity(graph: Graph, eps = 1e-3) {
  const evaluated = evaluateGraph(graph);
  expect(evaluated.errors).toHaveLength(0);
  expect(evaluated.geometry).not.toBeNull();

  const result = generateModule(graph);
  const mesh = runGenerated(result);
  const genPos = mesh.geometry.getAttribute('position').array as Float32Array;

  expect(maxDiff(evaluated.geometry!.positions, genPos)).toBeLessThan(eps);
}

describe('codegen parity (generated code === live evaluation)', () => {
  it('box', () => {
    expectParity(
      makeGraph(
        [
          { id: 'a', type: 'primitive.box', values: { width: 2, height: 1, depth: 1.5 } },
          { id: 'out', type: 'output.mesh' },
        ],
        [edge('e', 'a', 'out')],
      ),
    );
  });

  it('all primitives', () => {
    for (const type of [
      'primitive.sphere',
      'primitive.cylinder',
      'primitive.cone',
      'primitive.torus',
      'primitive.plane',
      'primitive.capsule',
      'primitive.circle',
      'primitive.ring',
      'primitive.torusKnot',
      'primitive.tetrahedron',
      'primitive.octahedron',
      'primitive.dodecahedron',
      'primitive.icosahedron',
    ]) {
      expectParity(makeGraph([{ id: 'a', type }, { id: 'out', type: 'output.mesh' }], [edge('e', 'a', 'out')]));
    }
  });

  it('primitive built-in transform', () => {
    // A box positioned/rotated/scaled via its own transform sockets (no Transform node).
    expectParity(
      makeGraph(
        [
          { id: 'a', type: 'primitive.box', values: { tx: 1.5, ty: -0.5, rz: 45, sx: 2, sz: 0.5 } },
          { id: 'out', type: 'output.mesh' },
        ],
        [edge('e', 'a', 'out')],
      ),
    );
  });

  it('primitive transform is omitted from codegen when at identity', () => {
    const result = generateModule(
      makeGraph([{ id: 'a', type: 'primitive.box' }, { id: 'out', type: 'output.mesh' }], [edge('e', 'a', 'out')]),
    );
    expect(result.code).not.toContain('applyMatrix4');
  });

  it('primitive transform is emitted when non-identity', () => {
    const result = generateModule(
      makeGraph(
        [{ id: 'a', type: 'primitive.box', values: { tx: 2 } }, { id: 'out', type: 'output.mesh' }],
        [edge('e', 'a', 'out')],
      ),
    );
    expect(result.code).toContain('.applyMatrix4(');
  });

  it('transform', () => {
    expectParity(
      makeGraph(
        [
          { id: 'a', type: 'primitive.box' },
          { id: 't', type: 'modifier.transform', values: { tx: 1, ry: 30, sz: 2 } },
          { id: 'out', type: 'output.mesh' },
        ],
        [edge('e1', 'a', 't'), edge('e2', 't', 'out')],
      ),
    );
  });

  it('array (linear + radial)', () => {
    for (const values of [{ mode: 'linear', count: 4, ox: 2 }, { mode: 'radial', count: 6, radius: 3, axis: 'y' }]) {
      expectParity(
        makeGraph(
          [
            { id: 'a', type: 'primitive.box' },
            { id: 'm', type: 'modifier.array', values },
            { id: 'out', type: 'output.mesh' },
          ],
          [edge('e1', 'a', 'm'), edge('e2', 'm', 'out')],
        ),
      );
    }
  });

  it('mirror', () => {
    expectParity(
      makeGraph(
        [
          { id: 'a', type: 'primitive.box', values: { width: 1 } },
          { id: 'm', type: 'modifier.mirror', values: { axis: 'x', keepOriginal: true } },
          { id: 'out', type: 'output.mesh' },
        ],
        [edge('e1', 'a', 'm'), edge('e2', 'm', 'out')],
      ),
    );
  });

  it('deformers (twist, taper, displace, bend)', () => {
    const cases = [
      { type: 'deformer.twist', values: { axis: 'y', angle: 60 } },
      { type: 'deformer.taper', values: { axis: 'y', endScale: 0.3 } },
      { type: 'deformer.displace', values: { strength: 0.4, frequency: 2, seed: 9 } },
      { type: 'deformer.bend', values: { axis: 'y', angle: 40 } },
    ];
    for (const c of cases) {
      expectParity(
        makeGraph(
          [
            { id: 'a', type: 'primitive.sphere', values: { widthSegments: 16, heightSegments: 12 } },
            { id: 'd', type: c.type, values: c.values },
            { id: 'out', type: 'output.mesh' },
          ],
          [edge('e1', 'a', 'd'), edge('e2', 'd', 'out')],
        ),
      );
    }
  });

  it('extrude + lathe (with shape socket)', () => {
    expectParity(
      makeGraph(
        [
          { id: 'p', type: 'curve.polygon', values: { sides: 6, radius: 1 } },
          { id: 'g', type: 'generator.extrude', values: { depth: 2, bevel: false } },
          { id: 'out', type: 'output.mesh' },
        ],
        [{ id: 'e1', source: 'p', sourceSocket: 'shape', target: 'g', targetSocket: 'shape' }, edge('e2', 'g', 'out')],
      ),
    );
    expectParity(
      makeGraph(
        [
          { id: 'p', type: 'curve.star', values: { points: 5 } },
          { id: 'g', type: 'generator.lathe', values: { segments: 24 } },
          { id: 'out', type: 'output.mesh' },
        ],
        [{ id: 'e1', source: 'p', sourceSocket: 'shape', target: 'g', targetSocket: 'shape' }, edge('e2', 'g', 'out')],
      ),
    );
  });

  it('multiple geometries merged into the output', () => {
    // Two boxes wired into the (multi-input) output socket should merge — eval and codegen.
    const graph = makeGraph(
      [
        { id: 'a', type: 'primitive.box', values: { tx: -1 } },
        { id: 'b', type: 'primitive.box', values: { tx: 1 } },
        { id: 'out', type: 'output.mesh' },
      ],
      [edge('e1', 'a', 'out'), edge('e2', 'b', 'out')],
    );
    const evaluated = evaluateGraph(graph);
    expect(evaluated.errors).toHaveLength(0);
    // Merged tri count = sum of both boxes (12 each).
    expect(evaluated.geometry!.metadata.triCount).toBe(24);
    expectParity(graph);
  });

  it('multi-material output (per-part materials via Apply Material)', () => {
    const graph = makeGraph(
      [
        { id: 'b1', type: 'primitive.box', values: { tx: -1 } },
        { id: 'm1', type: 'material.standard', values: { color: '#ff0000' } },
        { id: 'a1', type: 'material.apply' },
        { id: 'b2', type: 'primitive.box', values: { tx: 1 } },
        { id: 'm2', type: 'material.standard', values: { color: '#0000ff' } },
        { id: 'a2', type: 'material.apply' },
        { id: 'out', type: 'output.mesh' },
      ],
      [
        { id: 'e1', source: 'b1', sourceSocket: 'geometry', target: 'a1', targetSocket: 'geometry' },
        { id: 'e2', source: 'm1', sourceSocket: 'material', target: 'a1', targetSocket: 'material' },
        { id: 'e3', source: 'b2', sourceSocket: 'geometry', target: 'a2', targetSocket: 'geometry' },
        { id: 'e4', source: 'm2', sourceSocket: 'material', target: 'a2', targetSocket: 'material' },
        edge('e5', 'a1', 'out'),
        edge('e6', 'a2', 'out'),
      ],
    );
    const result = generateModule(graph);
    // material array on the mesh + grouped merge
    expect(result.code).toContain('mergeGeometries([');
    expect(result.code).toMatch(/new THREE\.Mesh\([^,]+, \[/);
    expectParity(graph); // positions match (both use mergeGeometries(..., true))
  });

  it('boolean (CSG subtract)', () => {
    expectParity(
      makeGraph(
        [
          { id: 'a', type: 'primitive.box', values: { width: 2, height: 2, depth: 2 } },
          { id: 'b', type: 'primitive.sphere', values: { radius: 1.2 } },
          { id: 'op', type: 'boolean.op', values: { operation: 'subtract' } },
          { id: 'out', type: 'output.mesh' },
        ],
        [
          { id: 'e1', source: 'a', sourceSocket: 'geometry', target: 'op', targetSocket: 'a' },
          { id: 'e2', source: 'b', sourceSocket: 'geometry', target: 'op', targetSocket: 'b' },
          edge('e3', 'op', 'out'),
        ],
      ),
    );
  });

  it('full pipeline with material does not throw and matches geometry', () => {
    expectParity(
      makeGraph(
        [
          { id: 'p', type: 'curve.star', values: { points: 6 } },
          { id: 'g', type: 'generator.extrude', values: { depth: 1, bevel: true, bevelSize: 0.1 } },
          { id: 't', type: 'modifier.transform', values: { ry: 15 } },
          { id: 'mat', type: 'material.standard', values: { color: '#cc4444', metalness: 0.8 } },
          { id: 'out', type: 'output.mesh' },
        ],
        [
          { id: 'e1', source: 'p', sourceSocket: 'shape', target: 'g', targetSocket: 'shape' },
          edge('e2', 'g', 't'),
          edge('e3', 't', 'out'),
          { id: 'e4', source: 'mat', sourceSocket: 'material', target: 'out', targetSocket: 'material' },
        ],
      ),
    );
  });
});

describe('exposed parameters', () => {
  function boxWithWidthParam(defaultWidth: number): Graph {
    const g = makeGraph(
      [
        { id: 'a', type: 'primitive.box', values: { width: defaultWidth, height: 1, depth: 1 } },
        { id: 'out', type: 'output.mesh' },
      ],
      [edge('e', 'a', 'out')],
    );
    g.params = [
      { id: 'p1', name: 'width', label: 'Width', type: 'number', default: defaultWidth, nodeId: 'a', socketId: 'width' },
    ];
    return g;
  }

  it('emits a parameterized signature and references params.<name>', () => {
    const result = generateModule(boxWithWidthParam(2));
    expect(result.code).toContain('width: 2');
    expect(result.code).toContain('new THREE.BoxGeometry(params.width');
    expect(result.paramDefaults).toEqual({ width: 2 });
  });

  it('default run matches eval; override matches eval-with-that-value', () => {
    const graph = boxWithWidthParam(2);
    const result = generateModule(graph);

    // Defaults → same as live eval.
    const evalDefault = evaluateGraph(graph).geometry!;
    const runDefault = runGenerated(result).geometry.getAttribute('position').array as Float32Array;
    expect(maxDiff(evalDefault.positions, runDefault)).toBeLessThan(1e-3);

    // Override width=5 → matches eval with the param set to 5, and differs from default.
    const override = runGenerated(result, { width: 5 }).geometry.getAttribute('position').array as Float32Array;
    const eval5 = evaluateGraph(boxWithWidthParam(5)).geometry!;
    expect(maxDiff(eval5.positions, override)).toBeLessThan(1e-3);
    expect(maxDiff(evalDefault.positions, override)).toBeGreaterThan(0.5);
  });
});

describe('generated code shape', () => {
  it('emits an importable module with the function and three import', () => {
    const result = generateModule(
      makeGraph([{ id: 'a', type: 'primitive.box' }, { id: 'out', type: 'output.mesh' }], [edge('e', 'a', 'out')]),
    );
    expect(result.code).toContain("import * as THREE from 'three';");
    expect(result.code).toContain('export function createModel(');
    expect(result.code).toContain('return new THREE.Mesh(');
  });
});

describe('R3F export target', () => {
  function paramBox(): Graph {
    const g = makeGraph(
      [
        { id: 'a', type: 'primitive.box', values: { width: 2 } },
        { id: 'mat', type: 'material.standard', values: { color: '#cc4444' } },
        { id: 'out', type: 'output.mesh' },
      ],
      [edge('e', 'a', 'out'), { id: 'em', source: 'mat', sourceSocket: 'material', target: 'out', targetSocket: 'material' }],
    );
    g.params = [{ id: 'p1', name: 'width', label: 'Width', type: 'number', default: 2, nodeId: 'a', socketId: 'width' }];
    return g;
  }

  it('emits an R3F component with useMemo, params and a <mesh>', () => {
    const result = generateModule(paramBox(), { target: 'r3f' });
    expect(result.target).toBe('r3f');
    expect(result.code).toContain("import { useMemo } from 'react';");
    expect(result.code).toContain('export function Model(props = {})');
    expect(result.code).toContain('width: props.width ?? 2');
    expect(result.code).toContain('useMemo(() =>');
    expect(result.code).toContain('}, [params.width]);');
    expect(result.code).toContain('<mesh geometry={geometry} material={material} />');
  });

  it('shares the geometry-building body with the vanilla target (same params/runnable body)', () => {
    const r3f = generateModule(paramBox(), { target: 'r3f' });
    const vanilla = generateModule(paramBox(), { target: 'vanilla' });
    // The runnable functionBody (used by the parity harness) is identical across targets,
    // so R3F geometry is correct by construction.
    expect(r3f.functionBody).toBe(vanilla.functionBody);
    expect(r3f.paramDefaults).toEqual(vanilla.paramDefaults);
    // And that body is parity-correct: run it and compare to eval.
    const evalPos = evaluateGraph(paramBox()).geometry!.positions;
    const runPos = runGenerated(vanilla).geometry.getAttribute('position').array as Float32Array;
    expect(maxDiff(evalPos, runPos)).toBeLessThan(1e-3);
  });
});
