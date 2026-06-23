import { describe, expect, it } from 'vitest';
import { registerBuiltinNodes } from '@/nodes';
import { evaluateGraph } from '@/engine/evaluate';
import { validateConnection } from '@/graph/validate';
import { GRAPH_VERSION, type Edge, type Graph, type GraphNode } from '@/graph/types';

registerBuiltinNodes();

/** profile node -> generator node -> output */
function profileToGen(
  profile: { type: string; values?: Record<string, unknown> },
  generator: { type: string; values?: Record<string, unknown> },
): Graph {
  const nodes: GraphNode[] = [
    { id: 'p', type: profile.type, position: { x: 0, y: 0 }, values: (profile.values ?? {}) as GraphNode['values'] },
    { id: 'g', type: generator.type, position: { x: 200, y: 0 }, values: (generator.values ?? {}) as GraphNode['values'] },
    { id: 'out', type: 'output.mesh', position: { x: 400, y: 0 }, values: {} },
  ];
  const edges: Edge[] = [
    { id: 'e1', source: 'p', sourceSocket: 'shape', target: 'g', targetSocket: 'shape' },
    { id: 'e2', source: 'g', sourceSocket: 'geometry', target: 'out', targetSocket: 'geometry' },
  ];
  return { version: GRAPH_VERSION, nodes, edges, params: [], outputNodeId: 'out' };
}

describe('extrude generator', () => {
  it('extrudes a polygon profile into solid geometry', () => {
    const { geometry, errors } = evaluateGraph(
      profileToGen({ type: 'curve.polygon', values: { sides: 6, radius: 1 } }, { type: 'generator.extrude', values: { depth: 2 } }),
    );
    expect(errors).toHaveLength(0);
    expect(geometry!.metadata.triCount).toBeGreaterThan(0);
    const bb = geometry!.metadata.boundingBox!;
    expect(bb.max[2] - bb.min[2]).toBeCloseTo(2, 1); // depth along Z, centered
  });

  it('extrudes a star profile', () => {
    const { geometry } = evaluateGraph(
      profileToGen({ type: 'curve.star', values: { points: 5 } }, { type: 'generator.extrude', values: { depth: 1 } }),
    );
    expect(geometry!.metadata.triCount).toBeGreaterThan(0);
  });
});

describe('lathe generator', () => {
  it('revolves a polygon profile into solid geometry', () => {
    const { geometry, errors } = evaluateGraph(
      profileToGen({ type: 'curve.polygon', values: { sides: 8, radius: 1 } }, { type: 'generator.lathe', values: { segments: 24 } }),
    );
    expect(errors).toHaveLength(0);
    expect(geometry!.metadata.triCount).toBeGreaterThan(0);
  });
});

describe('shape socket typing', () => {
  it('rejects connecting a shape output to a geometry input', () => {
    const g = profileToGen({ type: 'curve.polygon' }, { type: 'generator.extrude' });
    const r = validateConnection(g, {
      source: 'p',
      sourceSocket: 'shape',
      target: 'out',
      targetSocket: 'geometry',
    });
    expect(r.ok).toBe(false);
  });
});
