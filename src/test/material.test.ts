import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph } from '@/engine/evaluate';
import { isMaterialSpec } from '@/material/MaterialData';
import { GRAPH_VERSION, type Edge, type Graph, type GraphNode } from '@/graph/types';

registerBuiltinNodes();

function graphWithMaterial(connectMaterial: boolean): Graph {
  const nodes: GraphNode[] = [
    { id: 'box', type: 'primitive.box', position: { x: 0, y: 0 }, values: {} },
    { id: 'mat', type: 'material.standard', position: { x: 0, y: 150 }, values: { color: '#ff0000', metalness: 0.9, type: 'physical' } },
    { id: 'out', type: 'output.mesh', position: { x: 300, y: 0 }, values: {} },
  ];
  const edges: Edge[] = [
    { id: 'eg', source: 'box', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' },
  ];
  if (connectMaterial) {
    edges.push({ id: 'em', source: 'mat', sourceSocket: 'material', target: 'out', targetSocket: 'material' });
  }
  return { version: GRAPH_VERSION, nodes, edges, params: [], outputNodeId: 'out' };
}

describe('material', () => {
  it('flows a MaterialSpec to the output when connected', () => {
    const { geometry, material, errors } = evaluateGraph(graphWithMaterial(true));
    expect(errors).toHaveLength(0);
    expect(geometry).not.toBeNull();
    expect(isMaterialSpec(material)).toBe(true);
    expect(material!.color).toBe('#ff0000');
    expect(material!.metalness).toBeCloseTo(0.9);
    expect(material!.type).toBe('physical');
  });

  it('returns null material when none is connected (viewport uses default)', () => {
    const { geometry, material } = evaluateGraph(graphWithMaterial(false));
    expect(geometry).not.toBeNull();
    expect(material).toBeNull();
  });
});
