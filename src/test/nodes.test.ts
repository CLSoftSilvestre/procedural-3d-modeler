import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes, allNodeDefs } from '@/nodes';
import { evaluateGraph } from '@/engine/evaluate';
import { GRAPH_VERSION, type Graph } from '@/graph/types';

registerBuiltinNodes();

/** A graph: one primitive feeding the output. */
function primGraph(type: string, values: Record<string, number> = {}): Graph {
  return {
    version: GRAPH_VERSION,
    nodes: [
      { id: 'p', type, position: { x: 0, y: 0 }, values },
      { id: 'out', type: 'output.mesh', position: { x: 300, y: 0 }, values: {} },
    ],
    edges: [{ id: 'e', source: 'p', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' }],
    params: [],
    outputNodeId: 'out',
  };
}

describe('primitive nodes', () => {
  const types = [
    'primitive.box',
    'primitive.sphere',
    'primitive.cylinder',
    'primitive.cone',
    'primitive.torus',
    'primitive.plane',
  ];

  it('all primitives evaluate to non-empty geometry', () => {
    for (const type of types) {
      const { geometry, errors } = evaluateGraph(primGraph(type));
      expect(errors, type).toHaveLength(0);
      expect(geometry, type).not.toBeNull();
      expect(geometry!.metadata.triCount, type).toBeGreaterThan(0);
      expect(geometry!.positions.length, type).toBeGreaterThan(0);
    }
  });

  it('sphere radius drives bounding box', () => {
    const { geometry } = evaluateGraph(primGraph('primitive.sphere', { radius: 2 }));
    const bb = geometry!.metadata.boundingBox!;
    expect(bb.max[0] - bb.min[0]).toBeCloseTo(4, 1); // diameter ~= 4
  });
});

describe('transform modifier (geometry-in -> geometry-out)', () => {
  function boxThenTransform(values: Record<string, number>): Graph {
    return {
      version: GRAPH_VERSION,
      nodes: [
        { id: 'box', type: 'primitive.box', position: { x: 0, y: 0 }, values: { width: 1, height: 1, depth: 1 } },
        { id: 'tf', type: 'modifier.transform', position: { x: 200, y: 0 }, values },
        { id: 'out', type: 'output.mesh', position: { x: 400, y: 0 }, values: {} },
      ],
      edges: [
        { id: 'e1', source: 'box', sourceSocket: 'geometry', target: 'tf', targetSocket: 'geometry' },
        { id: 'e2', source: 'tf', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' },
      ],
      params: [],
      outputNodeId: 'out',
    };
  }

  it('translates the geometry (validates modifier chaining through the engine)', () => {
    const { geometry, errors } = evaluateGraph(boxThenTransform({ tx: 5 }));
    expect(errors).toHaveLength(0);
    const bb = geometry!.metadata.boundingBox!;
    // Unit box centered at origin shifted +5 in x -> spans [4.5, 5.5].
    expect(bb.min[0]).toBeCloseTo(4.5);
    expect(bb.max[0]).toBeCloseTo(5.5);
  });

  it('scales the geometry', () => {
    const { geometry } = evaluateGraph(boxThenTransform({ sx: 3 }));
    const bb = geometry!.metadata.boundingBox!;
    expect(bb.max[0] - bb.min[0]).toBeCloseTo(3);
  });

  it('returns empty geometry when no input is connected', () => {
    const g = boxThenTransform({});
    g.edges = g.edges.filter((e) => e.id !== 'e1'); // disconnect box -> transform
    const { geometry } = evaluateGraph(g);
    expect(geometry!.metadata.triCount).toBe(0);
  });
});

describe('registry', () => {
  it('registers the expected number of nodes', () => {
    // 6 primitives + transform + array + mirror + boolean + output
    expect(allNodeDefs().length).toBe(11);
  });
});
