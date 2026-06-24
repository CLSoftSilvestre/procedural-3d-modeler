import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph } from '@/engine/evaluate';
import { generateModule } from '@/codegen/generate';
import { runGenerated } from '@/codegen/runGenerated';
import { randomUnit } from '@/geometry/rng';
import { GRAPH_VERSION, type Edge, type Graph, type GraphNode } from '@/graph/types';

registerBuiltinNodes();

function graph(nodes: GraphNode[], edges: Edge[]): Graph {
  return { version: GRAPH_VERSION, nodes, edges, params: [], outputNodeId: 'out' };
}

const n = (id: string, type: string, values: Record<string, unknown> = {}): GraphNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  values: values as GraphNode['values'],
});

function genPositions(g: Graph): Float32Array {
  return runGenerated(generateModule(g)).geometry.getAttribute('position').array as Float32Array;
}
function maxDiff(a: Float32Array, b: Float32Array): number {
  expect(a.length).toBe(b.length);
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!));
  return m;
}

describe('Random node', () => {
  it('produces a deterministic value in [min, max]', () => {
    const expected = 2 + randomUnit(7) * (5 - 2);
    const g = graph(
      [
        n('r', 'value.random', { seed: 7, min: 2, max: 5 }),
        n('b', 'primitive.box'),
        n('out', 'output.mesh'),
      ],
      [
        { id: 'e1', source: 'r', sourceSocket: 'value', target: 'b', targetSocket: 'width' },
        { id: 'e2', source: 'b', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' },
      ],
    );
    const bb = evaluateGraph(g).geometry!.metadata.boundingBox!;
    expect(bb.max[0] - bb.min[0]).toBeCloseTo(expected, 5); // width driven by random
  });

  it('a value node drives a numeric input with codegen parity', () => {
    const g = graph(
      [
        n('r', 'value.random', { seed: 42, min: 0.5, max: 3 }),
        n('s', 'primitive.sphere'),
        n('out', 'output.mesh'),
      ],
      [
        { id: 'e1', source: 'r', sourceSocket: 'value', target: 's', targetSocket: 'radius' },
        { id: 'e2', source: 's', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' },
      ],
    );
    expect(maxDiff(evaluateGraph(g).geometry!.positions, genPositions(g))).toBeLessThan(1e-3);
  });
});

describe('Expression node', () => {
  it('evaluates a formula of a and b', () => {
    const g = graph(
      [
        n('x', 'value.expression', { a: 2, b: 3, formula: 'a * b + 1' }),
        n('b', 'primitive.box'),
        n('out', 'output.mesh'),
      ],
      [
        { id: 'e1', source: 'x', sourceSocket: 'value', target: 'b', targetSocket: 'width' },
        { id: 'e2', source: 'b', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' },
      ],
    );
    const bb = evaluateGraph(g).geometry!.metadata.boundingBox!;
    expect(bb.max[0] - bb.min[0]).toBeCloseTo(7, 5); // 2*3+1
  });

  it('matches codegen output (formula emitted raw, not quoted)', () => {
    const g = graph(
      [
        n('x', 'value.expression', { a: 1.5, b: 4, formula: 'Math.max(a, b)' }),
        n('c', 'primitive.cylinder'),
        n('out', 'output.mesh'),
      ],
      [
        { id: 'e1', source: 'x', sourceSocket: 'value', target: 'c', targetSocket: 'height' },
        { id: 'e2', source: 'c', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' },
      ],
    );
    const code = generateModule(g).code;
    expect(code).toContain('return (Math.max(a, b));'); // raw, unquoted
    expect(maxDiff(evaluateGraph(g).geometry!.positions, genPositions(g))).toBeLessThan(1e-3);
  });

  it('invalid formula yields 0 without crashing', () => {
    const g = graph(
      [
        n('x', 'value.expression', { a: 1, b: 2, formula: 'a * (' }),
        n('b', 'primitive.box', { width: 1 }),
        n('out', 'output.mesh'),
      ],
      [
        { id: 'e1', source: 'x', sourceSocket: 'value', target: 'b', targetSocket: 'height' },
        { id: 'e2', source: 'b', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' },
      ],
    );
    const res = evaluateGraph(g);
    expect(res.errors).toHaveLength(0);
    expect(res.geometry!.metadata.boundingBox!.max[1] - res.geometry!.metadata.boundingBox!.min[1]).toBeCloseTo(0, 5);
  });
});
