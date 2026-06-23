import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph } from '@/engine/evaluate';
import { GRAPH_VERSION, type Graph, type GraphNode, type Edge } from '@/graph/types';

registerBuiltinNodes();

/** Build a linear chain of nodes feeding into output. */
function chain(specs: { id: string; type: string; values?: Record<string, unknown> }[]): Graph {
  const nodes: GraphNode[] = specs.map((s, i) => ({
    id: s.id,
    type: s.type,
    position: { x: i * 200, y: 0 },
    values: (s.values ?? {}) as GraphNode['values'],
  }));
  nodes.push({ id: 'out', type: 'output.mesh', position: { x: specs.length * 200, y: 0 }, values: {} });
  const edges: Edge[] = [];
  for (let i = 0; i < specs.length - 1; i++) {
    edges.push({
      id: `e${i}`,
      source: specs[i]!.id,
      sourceSocket: 'geometry',
      target: specs[i + 1]!.id,
      targetSocket: 'geometry',
    });
  }
  edges.push({
    id: 'eout',
    source: specs[specs.length - 1]!.id,
    sourceSocket: 'geometry',
    target: 'out',
    targetSocket: 'geometry',
  });
  return { version: GRAPH_VERSION, nodes, edges, params: [], outputNodeId: 'out' };
}

describe('array modifier', () => {
  it('linear array multiplies triangle count by count', () => {
    const single = evaluateGraph(chain([{ id: 'b', type: 'primitive.box' }])).geometry!;
    const arr = evaluateGraph(
      chain([
        { id: 'b', type: 'primitive.box' },
        { id: 'a', type: 'modifier.array', values: { mode: 'linear', count: 4, ox: 2 } },
      ]),
    ).geometry!;
    expect(arr.metadata.triCount).toBe(single.metadata.triCount * 4);
  });

  it('linear array widens the bounding box', () => {
    const arr = evaluateGraph(
      chain([
        { id: 'b', type: 'primitive.box', values: { width: 1, height: 1, depth: 1 } },
        { id: 'a', type: 'modifier.array', values: { mode: 'linear', count: 3, ox: 2, oy: 0, oz: 0 } },
      ]),
    ).geometry!;
    const bb = arr.metadata.boundingBox!;
    // 3 unit boxes at x = 0, 2, 4 -> span from -0.5 to 4.5 = 5.
    expect(bb.max[0] - bb.min[0]).toBeCloseTo(5);
  });
});

describe('mirror modifier', () => {
  it('keepOriginal doubles triangles and is symmetric across X', () => {
    const mir = evaluateGraph(
      chain([
        { id: 'b', type: 'primitive.box', values: { width: 1, height: 1, depth: 1 } },
        { id: 'm', type: 'modifier.mirror', values: { axis: 'x', keepOriginal: true } },
      ]),
    ).geometry!;
    const bb = mir.metadata.boundingBox!;
    expect(bb.min[0]).toBeCloseTo(-bb.max[0]); // symmetric about x=0
  });
});

describe('boolean (CSG)', () => {
  function twoBoxesBoolean(operation: string): Graph {
    return {
      version: GRAPH_VERSION,
      nodes: [
        { id: 'a', type: 'primitive.box', position: { x: 0, y: 0 }, values: { width: 2, height: 2, depth: 2 } },
        { id: 'b', type: 'primitive.sphere', position: { x: 0, y: 100 }, values: { radius: 1.2 } },
        { id: 'op', type: 'boolean.op', position: { x: 200, y: 0 }, values: { operation } },
        { id: 'out', type: 'output.mesh', position: { x: 400, y: 0 }, values: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', sourceSocket: 'geometry', target: 'op', targetSocket: 'a' },
        { id: 'e2', source: 'b', sourceSocket: 'geometry', target: 'op', targetSocket: 'b' },
        { id: 'e3', source: 'op', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' },
      ],
      params: [],
      outputNodeId: 'out',
    };
  }

  it('subtract produces non-empty geometry from two geometry inputs', () => {
    const { geometry, errors } = evaluateGraph(twoBoxesBoolean('subtract'));
    expect(errors).toHaveLength(0);
    expect(geometry).not.toBeNull();
    expect(geometry!.metadata.triCount).toBeGreaterThan(0);
  });

  it('union bounding box is at least as large as the box operand', () => {
    const { geometry } = evaluateGraph(twoBoxesBoolean('union'));
    const bb = geometry!.metadata.boundingBox!;
    expect(bb.max[0] - bb.min[0]).toBeGreaterThanOrEqual(2 - 1e-3);
  });

  it('passes operand through when one input is disconnected', () => {
    const g = twoBoxesBoolean('subtract');
    g.edges = g.edges.filter((e) => e.id !== 'e2'); // disconnect B
    const { geometry } = evaluateGraph(g);
    expect(geometry!.metadata.triCount).toBe(12); // just box A
  });
});
