import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph } from '@/engine/evaluate';
import { GRAPH_VERSION, type Edge, type Graph, type GraphNode } from '@/graph/types';

registerBuiltinNodes();

function makeGraph(specs: { id: string; type: string; values?: Record<string, unknown> }[], edges: Edge[]): Graph {
  const nodes: GraphNode[] = specs.map((s) => ({
    id: s.id,
    type: s.type,
    position: { x: 0, y: 0 },
    values: (s.values ?? {}) as GraphNode['values'],
  }));
  return { version: GRAPH_VERSION, nodes, edges, params: [], outputNodeId: 'out' };
}
const e = (id: string, source: string, sourceSocket: string, target: string, targetSocket: string): Edge => ({
  id,
  source,
  sourceSocket,
  target,
  targetSocket,
});

describe('per-part materials', () => {
  it('two painted boxes merge into a multi-material geometry (one group each)', () => {
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
        e('e1', 'b1', 'geometry', 'a1', 'geometry'),
        e('e2', 'm1', 'material', 'a1', 'material'),
        e('e3', 'b2', 'geometry', 'a2', 'geometry'),
        e('e4', 'm2', 'material', 'a2', 'material'),
        e('e5', 'a1', 'geometry', 'out', 'geometry'),
        e('e6', 'a2', 'geometry', 'out', 'geometry'),
      ],
    );
    const { geometry, errors } = evaluateGraph(graph);
    expect(errors).toHaveLength(0);
    expect(geometry!.materials).toHaveLength(2);
    expect(geometry!.groups).toHaveLength(2);
    expect(geometry!.metadata.triCount).toBe(24);
    // group counts cover all triangles (de-indexed → 24 tris * 3 = 72 verts total)
    const totalVerts = geometry!.groups!.reduce((n, g) => n + g.count, 0);
    expect(totalVerts).toBe(geometry!.positions.length / 3);
  });

  it('identical materials are de-duplicated into one slot', () => {
    const graph = makeGraph(
      [
        { id: 'b1', type: 'primitive.box', values: { tx: -1 } },
        { id: 'b2', type: 'primitive.box', values: { tx: 1 } },
        { id: 'm', type: 'material.standard', values: { color: '#00ff00' } },
        { id: 'a1', type: 'material.apply' },
        { id: 'a2', type: 'material.apply' },
        { id: 'out', type: 'output.mesh' },
      ],
      [
        e('e1', 'b1', 'geometry', 'a1', 'geometry'),
        e('e2', 'm', 'material', 'a1', 'material'),
        e('e3', 'b2', 'geometry', 'a2', 'geometry'),
        e('e4', 'm', 'material', 'a2', 'material'),
        e('e5', 'a1', 'geometry', 'out', 'geometry'),
        e('e6', 'a2', 'geometry', 'out', 'geometry'),
      ],
    );
    const { geometry } = evaluateGraph(graph);
    expect(geometry!.materials).toHaveLength(1); // same spec → one slot
    expect(geometry!.groups).toHaveLength(2); // still two groups, both pointing at slot 0
    expect(geometry!.groups!.every((g) => g.materialIndex === 0)).toBe(true);
  });

  it('untagged geometry stays single-material (no groups)', () => {
    const graph = makeGraph(
      [
        { id: 'b1', type: 'primitive.box', values: { tx: -1 } },
        { id: 'b2', type: 'primitive.box', values: { tx: 1 } },
        { id: 'out', type: 'output.mesh' },
      ],
      [e('e5', 'b1', 'geometry', 'out', 'geometry'), e('e6', 'b2', 'geometry', 'out', 'geometry')],
    );
    const { geometry } = evaluateGraph(graph);
    expect(geometry!.materials).toBeUndefined();
    expect(geometry!.groups).toBeUndefined();
  });
});
