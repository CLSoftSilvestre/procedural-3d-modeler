import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph, EvalCache } from '@/engine/evaluate';
import { validateConnection } from '@/graph/validate';
import { serializeGraph, deserializeGraph } from '@/graph/serialize';
import { GRAPH_VERSION, type Graph } from '@/graph/types';

registerBuiltinNodes();

function boxGraph(width = 2): Graph {
  return {
    version: GRAPH_VERSION,
    nodes: [
      {
        id: 'box1',
        type: 'primitive.box',
        position: { x: 0, y: 0 },
        values: { width, height: 1, depth: 1 },
      },
      { id: 'out1', type: 'output.mesh', position: { x: 300, y: 0 }, values: {} },
    ],
    edges: [
      { id: 'e1', source: 'box1', sourceSocket: 'geometry', target: 'out1', targetSocket: 'geometry' },
    ],
    params: [],
    outputNodeId: 'out1',
  };
}

describe('EvalCache', () => {
  it('reuses cached node output for an unchanged graph', () => {
    const cache = new EvalCache();
    const a = evaluateGraph(boxGraph(), 1, cache).geometry!;
    const sizeAfterFirst = cache.size;
    const b = evaluateGraph(boxGraph(), 1, cache).geometry!;
    // Same content hash → identical (same reference) cached geometry returned.
    expect(b).toBe(a);
    expect(cache.size).toBe(sizeAfterFirst);
  });

  it('recomputes when a literal input changes', () => {
    const cache = new EvalCache();
    const a = evaluateGraph(boxGraph(2), 1, cache).geometry!;
    const b = evaluateGraph(boxGraph(3), 1, cache).geometry!;
    expect(b).not.toBe(a);
    const bbA = a.metadata.boundingBox!;
    const bbB = b.metadata.boundingBox!;
    expect(bbA.max[0] - bbA.min[0]).toBeCloseTo(2);
    expect(bbB.max[0] - bbB.min[0]).toBeCloseTo(3);
  });

  it('sweeps entries no longer referenced', () => {
    const cache = new EvalCache();
    evaluateGraph(boxGraph(2), 1, cache);
    evaluateGraph(boxGraph(3), 1, cache); // box(2) entry no longer live
    // Only the live nodes (box3 + output) remain.
    expect(cache.size).toBe(2);
  });
});

describe('validateConnection', () => {
  const g = boxGraph();
  it('accepts a valid geometry connection', () => {
    g.edges = [];
    const r = validateConnection(g, {
      source: 'box1',
      sourceSocket: 'geometry',
      target: 'out1',
      targetSocket: 'geometry',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects self-connection', () => {
    const r = validateConnection(g, {
      source: 'box1',
      sourceSocket: 'geometry',
      target: 'box1',
      targetSocket: 'width',
    });
    expect(r.ok).toBe(false);
  });

  it('rejects a cycle', () => {
    const cyclic = boxGraph();
    // out1 already feeds nothing; make a fake back-edge candidate box1->out1 exists,
    // now try out1->box1 which would close a loop.
    const r = validateConnection(cyclic, {
      source: 'out1',
      sourceSocket: 'geometry',
      target: 'box1',
      targetSocket: 'width',
    });
    expect(r.ok).toBe(false);
  });
});

describe('serialize round-trip', () => {
  it('serializes and deserializes to an equivalent graph', () => {
    const json = serializeGraph(boxGraph(2.5));
    const result = deserializeGraph(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.graph.nodes).toHaveLength(2);
      expect(result.graph.outputNodeId).toBe('out1');
    }
  });

  it('rejects unknown node types', () => {
    const bad = JSON.stringify({ version: GRAPH_VERSION, nodes: [{ type: 'nope.nope' }], edges: [] });
    const result = deserializeGraph(bad);
    expect(result.ok).toBe(false);
  });
});
