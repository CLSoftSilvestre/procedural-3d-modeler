import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph } from '@/engine/evaluate';
import { generateModule } from '@/codegen/generate';
import { runGenerated } from '@/codegen/runGenerated';
import { GRAPH_VERSION, type Edge, type Graph, type GraphNode } from '@/graph/types';

registerBuiltinNodes();

const n = (id: string, type: string, values: Record<string, unknown> = {}): GraphNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  values: values as GraphNode['values'],
});

/** Time(speed) → box.width; box → output. Box width animates with the clock. */
function animatedGraph(speed = 1): Graph {
  const nodes = [
    n('t', 'value.time', { speed }),
    n('b', 'primitive.box', { width: 1, height: 1, depth: 1 }),
    n('out', 'output.mesh'),
  ];
  const edges: Edge[] = [
    { id: 'e1', source: 't', sourceSocket: 'value', target: 'b', targetSocket: 'width' },
    { id: 'e2', source: 'b', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' },
  ];
  return { version: GRAPH_VERSION, nodes, edges, params: [], outputNodeId: 'out' };
}

function widthAt(g: Graph, time: number): number {
  const bb = evaluateGraph(g, 1, undefined, 'full', time).geometry!.metadata.boundingBox!;
  return bb.max[0] - bb.min[0];
}

describe('procedural animation', () => {
  it('Time node drives geometry over time', () => {
    const g = animatedGraph(1);
    expect(widthAt(g, 2)).toBeCloseTo(2, 5); // width = time * speed
    expect(widthAt(g, 5)).toBeCloseTo(5, 5);
    expect(widthAt(g, 2)).not.toBeCloseTo(widthAt(g, 5), 1);
  });

  it('speed scales the clock', () => {
    expect(widthAt(animatedGraph(0.5), 4)).toBeCloseTo(2, 5);
  });

  it('exported code takes a time arg and matches eval at that time', () => {
    const g = animatedGraph(1);
    const result = generateModule(g);
    expect(result.animated).toBe(true);
    expect(result.code).toContain('time = 0');
    expect(result.code).toContain('time * ');

    const evalPos = evaluateGraph(g, 1, undefined, 'full', 3).geometry!.positions;
    const runPos = runGenerated(result, {}, 3).geometry.getAttribute('position').array as Float32Array;
    expect(evalPos.length).toBe(runPos.length);
    let maxDiff = 0;
    for (let i = 0; i < evalPos.length; i++) maxDiff = Math.max(maxDiff, Math.abs(evalPos[i]! - runPos[i]!));
    expect(maxDiff).toBeLessThan(1e-3);
  });

  it('R3F animated target emits useFrame + time dependency', () => {
    const code = generateModule(animatedGraph(1), { target: 'r3f' }).code;
    expect(code).toContain("import { useFrame } from '@react-three/fiber';");
    expect(code).toContain('useFrame((state) => setTime(state.clock.elapsedTime));');
    expect(code).toContain('[time]);'); // time is a useMemo dependency
  });

  it('static graphs are not marked animated (no time arg)', () => {
    const g: Graph = {
      version: GRAPH_VERSION,
      nodes: [n('b', 'primitive.box'), n('out', 'output.mesh')],
      edges: [{ id: 'e', source: 'b', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' }],
      params: [],
      outputNodeId: 'out',
    };
    const result = generateModule(g);
    expect(result.animated).toBe(false);
    expect(result.code).not.toContain('time');
  });
});
