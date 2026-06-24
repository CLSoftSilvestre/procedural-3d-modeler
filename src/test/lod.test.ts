import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph } from '@/engine/evaluate';
import { GRAPH_VERSION, type Graph } from '@/graph/types';

registerBuiltinNodes();

function sphereGraph(): Graph {
  return {
    version: GRAPH_VERSION,
    nodes: [
      { id: 's', type: 'primitive.sphere', position: { x: 0, y: 0 }, values: { radius: 1, widthSegments: 48, heightSegments: 32 } },
      { id: 'out', type: 'output.mesh', position: { x: 200, y: 0 }, values: {} },
    ],
    edges: [{ id: 'e', source: 's', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' }],
    params: [],
    outputNodeId: 'out',
  };
}

describe('LOD (preview quality)', () => {
  it('preview reduces triangle count vs full', () => {
    const full = evaluateGraph(sphereGraph(), 1, undefined, 'full').geometry!;
    const preview = evaluateGraph(sphereGraph(), 1, undefined, 'preview').geometry!;
    expect(preview.metadata.triCount).toBeGreaterThan(0);
    expect(preview.metadata.triCount).toBeLessThan(full.metadata.triCount);
  });

  it('full is the default quality (matches explicit full)', () => {
    const def = evaluateGraph(sphereGraph()).geometry!;
    const full = evaluateGraph(sphereGraph(), 1, undefined, 'full').geometry!;
    expect(def.metadata.triCount).toBe(full.metadata.triCount);
  });
});
