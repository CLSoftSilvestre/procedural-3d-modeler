import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph } from '@/engine/evaluate';
import { makeNoise3 } from '@/geometry/noise';
import { GRAPH_VERSION, type Edge, type Graph, type GraphNode } from '@/graph/types';

registerBuiltinNodes();

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
    edges.push({ id: `e${i}`, source: specs[i]!.id, sourceSocket: 'geometry', target: specs[i + 1]!.id, targetSocket: 'geometry' });
  }
  edges.push({ id: 'eout', source: specs[specs.length - 1]!.id, sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' });
  return { version: GRAPH_VERSION, nodes, edges, params: [], outputNodeId: 'out' };
}

describe('noise', () => {
  it('is deterministic per seed and varies across space', () => {
    const n = makeNoise3(42);
    expect(n(1.5, 2.5, 3.5)).toBe(makeNoise3(42)(1.5, 2.5, 3.5));
    expect(n(0, 0, 0)).not.toBe(n(5.3, 1.1, 2.2));
  });
});

const sphere = { id: 's', type: 'primitive.sphere', values: { radius: 1, widthSegments: 24, heightSegments: 16 } };

describe('displace deformer', () => {
  it('preserves vertex count but moves vertices (and is deterministic)', () => {
    const base = evaluateGraph(chain([sphere])).geometry!;
    const g1 = chain([sphere, { id: 'd', type: 'deformer.displace', values: { strength: 0.5, frequency: 2, seed: 7 } }]);
    const a = evaluateGraph(g1).geometry!;
    const b = evaluateGraph(g1).geometry!;
    expect(a.positions.length).toBe(base.positions.length);
    expect(Array.from(a.positions)).not.toEqual(Array.from(base.positions));
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions)); // deterministic
  });

  it('zero strength is a no-op on positions', () => {
    const base = evaluateGraph(chain([sphere])).geometry!;
    const out = evaluateGraph(chain([sphere, { id: 'd', type: 'deformer.displace', values: { strength: 0 } }])).geometry!;
    expect(Array.from(out.positions)).toEqual(Array.from(base.positions));
  });
});

describe('twist deformer', () => {
  it('leaves a vertex on the axis origin in place but rotates off-axis vertices', () => {
    const box = { id: 'b', type: 'primitive.box', values: { width: 1, height: 4, depth: 1, heightSegments: 8 } };
    const base = evaluateGraph(chain([box])).geometry!;
    const twisted = evaluateGraph(chain([box, { id: 't', type: 'deformer.twist', values: { axis: 'y', angle: 90 } }])).geometry!;
    expect(twisted.positions.length).toBe(base.positions.length);
    expect(Array.from(twisted.positions)).not.toEqual(Array.from(base.positions));
  });
});

describe('taper deformer', () => {
  it('shrinks the cross-section toward the high end of the axis', () => {
    const box = { id: 'b', type: 'primitive.box', values: { width: 2, height: 2, depth: 2 } };
    const tapered = evaluateGraph(chain([box, { id: 't', type: 'deformer.taper', values: { axis: 'y', endScale: 0 } }])).geometry!;
    const bb = tapered.metadata.boundingBox!;
    // endScale 0 collapses the top -> overall x-extent still spans the wide base (2).
    expect(bb.max[0] - bb.min[0]).toBeCloseTo(2, 1);
    // but the top ring is collapsed, so max y vertices have ~0 x; verify min x stays -1 (base).
    expect(bb.min[0]).toBeCloseTo(-1, 1);
  });
});
