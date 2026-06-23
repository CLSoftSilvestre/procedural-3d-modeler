import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph } from '@/engine/evaluate';
import { GRAPH_VERSION, type Graph } from '@/graph/types';

registerBuiltinNodes();

function boxGraph(): Graph {
  return {
    version: GRAPH_VERSION,
    nodes: [
      {
        id: 'box1',
        type: 'primitive.box',
        position: { x: 0, y: 0 },
        values: { width: 2, height: 1, depth: 1 },
      },
      { id: 'out1', type: 'output.mesh', position: { x: 300, y: 0 }, values: {} },
    ],
    edges: [
      {
        id: 'e1',
        source: 'box1',
        sourceSocket: 'geometry',
        target: 'out1',
        targetSocket: 'geometry',
      },
    ],
    params: [],
    outputNodeId: 'out1',
  };
}

describe('evaluateGraph (box)', () => {
  it('produces geometry at the output node', () => {
    const { geometry, errors } = evaluateGraph(boxGraph());
    expect(errors).toHaveLength(0);
    expect(geometry).not.toBeNull();
    expect(geometry!.positions.length).toBeGreaterThan(0);
    expect(geometry!.metadata.triCount).toBe(12); // a box = 12 triangles
  });

  it('respects literal input values (width drives bounding box)', () => {
    const { geometry } = evaluateGraph(boxGraph());
    const bb = geometry!.metadata.boundingBox!;
    expect(bb.max[0] - bb.min[0]).toBeCloseTo(2); // width = 2
    expect(bb.max[1] - bb.min[1]).toBeCloseTo(1); // height = 1
  });

  it('is deterministic across runs', () => {
    const a = evaluateGraph(boxGraph()).geometry!;
    const b = evaluateGraph(boxGraph()).geometry!;
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  });
});
