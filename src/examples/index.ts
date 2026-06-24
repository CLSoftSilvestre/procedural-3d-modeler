import { GRAPH_VERSION, type Edge, type Graph, type GraphNode } from '@/graph/types';

/**
 * Built-in example graphs — the starter library. Each is a complete, valid graph that
 * exercises a slice of the toolkit and exports to clean three.js code. Loadable from the
 * toolbar's Examples menu and verified end-to-end in `examples.test.ts`.
 */

interface NodeSpec {
  id: string;
  type: string;
  values?: Record<string, unknown>;
  pos?: [number, number];
}

/** Edge tuple: [sourceId, sourceSocket, targetId, targetSocket]. */
type EdgeSpec = [string, string, string, string];

function build(nodes: NodeSpec[], edges: EdgeSpec[]): Graph {
  const graphNodes: GraphNode[] = nodes.map((n, i) => ({
    id: n.id,
    type: n.type,
    position: { x: n.pos ? n.pos[0] : i * 180, y: n.pos ? n.pos[1] : 40 },
    values: (n.values ?? {}) as GraphNode['values'],
  }));
  const graphEdges: Edge[] = edges.map(([s, ss, t, ts], i) => ({
    id: `e${i}`,
    source: s,
    sourceSocket: ss,
    target: t,
    targetSocket: ts,
  }));
  return { version: GRAPH_VERSION, nodes: graphNodes, edges: graphEdges, params: [], outputNodeId: 'out' };
}

export interface Example {
  id: string;
  name: string;
  description: string;
  graph: Graph;
}

export const EXAMPLES: Example[] = [
  {
    id: 'asteroid',
    name: 'Asteroid',
    description: 'Sphere displaced by seeded noise with a rough rocky material.',
    graph: build(
      [
        { id: 's', type: 'primitive.sphere', values: { radius: 1, widthSegments: 48, heightSegments: 32 }, pos: [40, 40] },
        { id: 'd', type: 'deformer.displace', values: { strength: 0.35, frequency: 1.6, seed: 7 }, pos: [240, 40] },
        { id: 'mat', type: 'material.standard', values: { color: '#8a7f73', roughness: 0.95, metalness: 0 }, pos: [240, 240] },
        { id: 'out', type: 'output.mesh', pos: [460, 40] },
      ],
      [
        ['s', 'geometry', 'd', 'geometry'],
        ['d', 'geometry', 'out', 'geometry'],
        ['mat', 'material', 'out', 'material'],
      ],
    ),
  },
  {
    id: 'gear',
    name: 'Beveled Gear',
    description: 'A 12-point star profile extruded with a bevel, laid flat, brass material.',
    graph: build(
      [
        { id: 'star', type: 'curve.star', values: { points: 12, innerRadius: 0.72, outerRadius: 1 }, pos: [40, 40] },
        { id: 'ex', type: 'generator.extrude', values: { depth: 0.4, bevel: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, steps: 1 }, pos: [240, 40] },
        { id: 't', type: 'modifier.transform', values: { rx: 90 }, pos: [440, 40] },
        { id: 'mat', type: 'material.standard', values: { type: 'physical', color: '#b08d57', roughness: 0.35, metalness: 0.9 }, pos: [440, 240] },
        { id: 'out', type: 'output.mesh', pos: [640, 40] },
      ],
      [
        ['star', 'shape', 'ex', 'shape'],
        ['ex', 'geometry', 't', 'geometry'],
        ['t', 'geometry', 'out', 'geometry'],
        ['mat', 'material', 'out', 'material'],
      ],
    ),
  },
  {
    id: 'cored-cube',
    name: 'Cored Cube',
    description: 'A cube with a sphere subtracted (CSG boolean), blue material.',
    graph: build(
      [
        { id: 'a', type: 'primitive.box', values: { width: 1.6, height: 1.6, depth: 1.6 }, pos: [40, 40] },
        { id: 'b', type: 'primitive.sphere', values: { radius: 1.05, widthSegments: 32, heightSegments: 24 }, pos: [40, 240] },
        { id: 'op', type: 'boolean.op', values: { operation: 'subtract' }, pos: [260, 120] },
        { id: 'mat', type: 'material.standard', values: { color: '#5b8bd0', roughness: 0.4, metalness: 0.1 }, pos: [260, 320] },
        { id: 'out', type: 'output.mesh', pos: [480, 120] },
      ],
      [
        ['a', 'geometry', 'op', 'a'],
        ['b', 'geometry', 'op', 'b'],
        ['op', 'geometry', 'out', 'geometry'],
        ['mat', 'material', 'out', 'material'],
      ],
    ),
  },
];

export function getExample(id: string): Example | undefined {
  return EXAMPLES.find((e) => e.id === id);
}
