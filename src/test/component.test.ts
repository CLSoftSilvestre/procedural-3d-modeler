import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph } from '@/engine/evaluate';
import { generateModule } from '@/codegen/generate';
import { runGenerated } from '@/codegen/runGenerated';
import { GRAPH_VERSION, type ExposedParam, type Graph, type GraphNode } from '@/graph/types';

registerBuiltinNodes();

/** A reusable sub-model: a box whose width is an exposed parameter. */
function widthBoxModel(defaultWidth = 1): Graph {
  const params: ExposedParam[] = [
    {
      id: 'p1',
      name: 'width',
      label: 'Width',
      type: 'number',
      default: defaultWidth,
      min: 0.1,
      max: 10,
      nodeId: 'b',
      socketId: 'width',
    },
  ];
  return {
    version: GRAPH_VERSION,
    nodes: [
      { id: 'b', type: 'primitive.box', position: { x: 0, y: 0 }, values: { width: defaultWidth, height: 1, depth: 1 } },
      { id: 'out', type: 'output.mesh', position: { x: 200, y: 0 }, values: {} },
    ],
    edges: [{ id: 'e', source: 'b', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' }],
    params,
    outputNodeId: 'out',
  };
}

/** Host graph containing one component instance wired to its output. */
function hostWith(component: GraphNode['component'], values: Record<string, number> = {}): Graph {
  return {
    version: GRAPH_VERSION,
    nodes: [
      { id: 'c', type: 'component.instance', position: { x: 0, y: 0 }, values, component },
      { id: 'out', type: 'output.mesh', position: { x: 200, y: 0 }, values: {} },
    ],
    edges: [{ id: 'e', source: 'c', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' }],
    params: [],
    outputNodeId: 'out',
  };
}

const componentOf = (graph: Graph) => ({ sourceId: 's1', name: 'WidthBox', graph, params: graph.params });

describe('component instances (assemblies)', () => {
  it('evaluates the embedded sub-model', () => {
    const { geometry, errors } = evaluateGraph(hostWith(componentOf(widthBoxModel(1))));
    expect(errors).toHaveLength(0);
    expect(geometry!.metadata.triCount).toBe(12); // a box
  });

  it('per-instance parameter overrides the sub-model default', () => {
    const graph = hostWith(componentOf(widthBoxModel(1)), { width: 4 });
    const bb = evaluateGraph(graph).geometry!.metadata.boundingBox!;
    expect(bb.max[0] - bb.min[0]).toBeCloseTo(4, 1); // width param applied
  });

  it('applies the instance transform (placement)', () => {
    const graph = hostWith(componentOf(widthBoxModel(1)), { tx: 5 });
    const bb = evaluateGraph(graph).geometry!.metadata.boundingBox!;
    expect((bb.min[0] + bb.max[0]) / 2).toBeCloseTo(5, 1); // centered at tx=5
  });

  it('exports code (component → helper function) that matches evaluation', () => {
    const graph = hostWith(componentOf(widthBoxModel(1)), { width: 3, tx: 2 });
    const evalPos = evaluateGraph(graph).geometry!.positions;
    const result = generateModule(graph);
    expect(result.code).toContain('function part_WidthBox('); // sub-model emitted as a helper
    const runPos = runGenerated(result).geometry.getAttribute('position').array as Float32Array;
    expect(runPos.length).toBe(evalPos.length);
    let max = 0;
    for (let i = 0; i < runPos.length; i++) max = Math.max(max, Math.abs(runPos[i]! - evalPos[i]!));
    expect(max).toBeLessThan(1e-3);
  });

  it('guards against self-referential nesting', () => {
    // A component whose embedded graph contains a component pointing at the same model.
    const inner = widthBoxModel(1);
    const selfGraph: Graph = {
      ...inner,
      nodes: [
        { id: 'c', type: 'component.instance', position: { x: 0, y: 0 }, values: {}, component: undefined },
        { id: 'out', type: 'output.mesh', position: { x: 200, y: 0 }, values: {} },
      ],
      edges: [{ id: 'e', source: 'c', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' }],
    };
    // Make the inner component reference selfGraph recursively.
    const self = selfGraph.nodes[0]!;
    self.component = { sourceId: 's1', name: 'Recursive', graph: selfGraph, params: [] };
    const { errors } = evaluateGraph(hostWith({ sourceId: 's1', name: 'Recursive', graph: selfGraph, params: [] }));
    expect(errors.some((e) => /too deep/i.test(e.message))).toBe(true);
  });
});
