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
    id: 'pulsing-asteroid',
    name: 'Pulsing Asteroid (animated)',
    description: 'A noise-displaced sphere whose displacement pulses over time. Press Play.',
    graph: build(
      [
        { id: 's', type: 'primitive.sphere', values: { radius: 1, widthSegments: 48, heightSegments: 32 }, pos: [40, 40] },
        { id: 't', type: 'value.time', values: { speed: 1.5 }, pos: [40, 240] },
        { id: 'x', type: 'value.expression', values: { formula: '0.22 + 0.16 * Math.sin(a)' }, pos: [240, 240] },
        { id: 'd', type: 'deformer.displace', values: { frequency: 1.6, seed: 7 }, pos: [440, 40] },
        { id: 'mat', type: 'material.standard', values: { color: '#8a7f73', roughness: 0.95, metalness: 0 }, pos: [440, 300] },
        { id: 'out', type: 'output.mesh', pos: [660, 40] },
      ],
      [
        ['t', 'value', 'x', 'a'],
        ['s', 'geometry', 'd', 'geometry'],
        ['x', 'value', 'd', 'strength'],
        ['d', 'geometry', 'out', 'geometry'],
        ['mat', 'material', 'out', 'material'],
      ],
    ),
  },
  {
    id: 'faceted-gem',
    name: 'Faceted Gem',
    description: 'Two 8-sided cones joined base-to-base (crown + pavilion) into a cut gemstone.',
    graph: build(
      [
        { id: 'crown', type: 'primitive.cone', values: { radius: 1, height: 0.5, radialSegments: 16, heightSegments: 2, ty: 0.25 }, pos: [40, 40] },
        { id: 'pav', type: 'primitive.cone', values: { radius: 1, height: 1.1, radialSegments: 16, heightSegments: 3, rx: 180, ty: -0.55 }, pos: [40, 240] },
        { id: 'op', type: 'boolean.op', values: { operation: 'union' }, pos: [260, 120] },
        { id: 'mat', type: 'material.standard', values: { type: 'physical', color: '#7ec8ff', roughness: 0.08, metalness: 0.2 }, pos: [260, 320] },
        { id: 'out', type: 'output.mesh', pos: [480, 120] },
      ],
      [
        ['crown', 'geometry', 'op', 'a'],
        ['pav', 'geometry', 'op', 'b'],
        ['op', 'geometry', 'out', 'geometry'],
        ['mat', 'material', 'out', 'material'],
      ],
    ),
  },
  {
    id: 'hollow-pipe',
    name: 'Hollow Pipe',
    description: 'A thinner cylinder subtracted from a wider one (CSG) to hollow out a tube.',
    graph: build(
      [
        { id: 'outer', type: 'primitive.cylinder', values: { radiusTop: 1, radiusBottom: 1, height: 3, radialSegments: 48 }, pos: [40, 40] },
        { id: 'inner', type: 'primitive.cylinder', values: { radiusTop: 0.78, radiusBottom: 0.78, height: 3.2, radialSegments: 48 }, pos: [40, 240] },
        { id: 'op', type: 'boolean.op', values: { operation: 'subtract' }, pos: [260, 120] },
        { id: 'mat', type: 'material.standard', values: { type: 'physical', color: '#b8c0cc', roughness: 0.3, metalness: 0.95 }, pos: [260, 320] },
        { id: 'out', type: 'output.mesh', pos: [480, 120] },
      ],
      [
        ['outer', 'geometry', 'op', 'a'],
        ['inner', 'geometry', 'op', 'b'],
        ['op', 'geometry', 'out', 'geometry'],
        ['mat', 'material', 'out', 'material'],
      ],
    ),
  },
  {
    id: 'capsule',
    name: 'Capsule',
    description: 'A cylinder capped by two spheres positioned via each primitive’s own transform.',
    graph: build(
      [
        { id: 'body', type: 'primitive.cylinder', values: { radiusTop: 0.5, radiusBottom: 0.5, height: 1.4, radialSegments: 32 }, pos: [40, 40] },
        { id: 'top', type: 'primitive.sphere', values: { radius: 0.5, widthSegments: 32, heightSegments: 16, ty: 0.7 }, pos: [40, 220] },
        { id: 'bot', type: 'primitive.sphere', values: { radius: 0.5, widthSegments: 32, heightSegments: 16, ty: -0.7 }, pos: [40, 400] },
        { id: 'u1', type: 'boolean.op', values: { operation: 'union' }, pos: [260, 120] },
        { id: 'u2', type: 'boolean.op', values: { operation: 'union' }, pos: [460, 200] },
        { id: 'mat', type: 'material.standard', values: { color: '#7ddc8a', roughness: 0.35, metalness: 0.1 }, pos: [260, 360] },
        { id: 'out', type: 'output.mesh', pos: [660, 200] },
      ],
      [
        ['body', 'geometry', 'u1', 'a'],
        ['top', 'geometry', 'u1', 'b'],
        ['u1', 'geometry', 'u2', 'a'],
        ['bot', 'geometry', 'u2', 'b'],
        ['u2', 'geometry', 'out', 'geometry'],
        ['mat', 'material', 'out', 'material'],
      ],
    ),
  },
  {
    id: 'twisted-column',
    name: 'Twisted Column',
    description: 'A tall segmented box run through the Twist deformer — a spiraling pillar.',
    graph: build(
      [
        { id: 'box', type: 'primitive.box', values: { width: 0.7, height: 3, depth: 0.7, widthSegments: 4, heightSegments: 48, depthSegments: 4 }, pos: [40, 40] },
        { id: 'tw', type: 'deformer.twist', values: { axis: 'y', angle: 120 }, pos: [260, 40] },
        { id: 'mat', type: 'material.standard', values: { color: '#c792ea', roughness: 0.5, metalness: 0.2 }, pos: [260, 240] },
        { id: 'out', type: 'output.mesh', pos: [480, 40] },
      ],
      [
        ['box', 'geometry', 'tw', 'geometry'],
        ['tw', 'geometry', 'out', 'geometry'],
        ['mat', 'material', 'out', 'material'],
      ],
    ),
  },
  {
    id: 'propeller',
    name: 'Spinning Propeller (animated)',
    description: 'A tapered blade radial-arrayed around a hub, spun over time. Press Play.',
    graph: build(
      [
        { id: 'blade', type: 'primitive.box', values: { width: 1.6, height: 0.07, depth: 0.36, tx: 1 }, pos: [40, 40] },
        { id: 'tp', type: 'deformer.taper', values: { axis: 'x', endScale: 0.4 }, pos: [240, 40] },
        { id: 'arr', type: 'modifier.array', values: { mode: 'radial', count: 3, axis: 'y', radius: 0 }, pos: [440, 40] },
        { id: 'hub', type: 'primitive.cylinder', values: { radiusTop: 0.28, radiusBottom: 0.28, height: 0.4, radialSegments: 20 }, pos: [440, 240] },
        { id: 'uni', type: 'boolean.op', values: { operation: 'union' }, pos: [640, 120] },
        { id: 't', type: 'value.time', values: { speed: 1 }, pos: [40, 320] },
        { id: 'x', type: 'value.expression', values: { formula: 'a * 80' }, pos: [240, 320] },
        { id: 'spin', type: 'modifier.transform', pos: [840, 120] },
        { id: 'mat', type: 'material.standard', values: { type: 'physical', color: '#9aa7b4', roughness: 0.35, metalness: 0.9 }, pos: [640, 360] },
        { id: 'out', type: 'output.mesh', pos: [1040, 120] },
      ],
      [
        ['blade', 'geometry', 'tp', 'geometry'],
        ['tp', 'geometry', 'arr', 'geometry'],
        ['arr', 'geometry', 'uni', 'a'],
        ['hub', 'geometry', 'uni', 'b'],
        ['uni', 'geometry', 'spin', 'geometry'],
        ['t', 'value', 'x', 'a'],
        ['x', 'value', 'spin', 'ry'],
        ['spin', 'geometry', 'out', 'geometry'],
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
