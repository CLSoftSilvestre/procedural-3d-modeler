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
    for (const type of ['primitive.sphere', 'primitive.cylinder', 'primitive.cone', 'primitive.torus', 'primitive.plane']) {
      expectParity(makeGraph([{ id: 'a', type }, { id: 'out', type: 'output.mesh' }], [edge('e', 'a', 'out')]));
    }
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

  it('deformers (twist, taper, displace)', () => {
    const cases = [
      { type: 'deformer.twist', values: { axis: 'y', angle: 60 } },
      { type: 'deformer.taper', values: { axis: 'y', endScale: 0.3 } },
      { type: 'deformer.displace', values: { strength: 0.4, frequency: 2, seed: 9 } },
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

describe('generated code shape', () => {
  it('emits an importable module with the function and three import', () => {
    const result = generateModule(
      makeGraph([{ id: 'a', type: 'primitive.box' }, { id: 'out', type: 'output.mesh' }], [edge('e', 'a', 'out')]),
    );
    expect(result.code).toContain("import * as THREE from 'three';");
    expect(result.code).toContain('export function createModel()');
    expect(result.code).toContain('return new THREE.Mesh(');
  });
});
