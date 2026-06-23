import type { GeometryData } from '@/geometry/GeometryData';

/**
 * Graph IR — pure, serializable description of the model.
 * The evaluation engine and code generator are both pure functions of (Graph, params).
 * See ARCHITECTURE.md §3.
 */

/** Value types that can travel along sockets and be stored as node inputs. */
export type SocketType = 'geometry' | 'number' | 'vector3' | 'boolean' | 'string' | 'color';

export type SocketValue =
  | GeometryData
  | number
  | [number, number, number]
  | boolean
  | string;

export interface SocketSpec {
  id: string;
  label: string;
  type: SocketType;
  /** Default literal value when no edge is connected (not used for geometry inputs). */
  default?: Exclude<SocketValue, GeometryData>;
  /** UI hints for the inspector control. */
  control?: {
    kind: 'slider' | 'number' | 'vector' | 'checkbox' | 'text' | 'color' | 'select';
    min?: number;
    max?: number;
    step?: number;
    options?: { label: string; value: string }[];
  };
}

export interface GraphNode {
  id: string;
  type: string; // NodeDef.type, e.g. "primitive.box"
  position: { x: number; y: number };
  /** Literal input values keyed by socket id (overridden by connected edges). */
  values: Record<string, Exclude<SocketValue, GeometryData>>;
  title?: string;
}

export interface Edge {
  id: string;
  source: string; // node id
  sourceSocket: string;
  target: string; // node id
  targetSocket: string;
}

export interface ExposedParam {
  id: string;
  name: string; // identifier used in generated code, e.g. "radius"
  label: string;
  type: SocketType;
  default: Exclude<SocketValue, GeometryData>;
  min?: number;
  max?: number;
  step?: number;
  /** Binding: which node socket this param drives. */
  nodeId: string;
  socketId: string;
}

export interface Graph {
  version: string;
  nodes: GraphNode[];
  edges: Edge[];
  params: ExposedParam[];
  outputNodeId: string | null;
}

export const GRAPH_VERSION = '0.1.0';

export function createEmptyGraph(): Graph {
  return {
    version: GRAPH_VERSION,
    nodes: [],
    edges: [],
    params: [],
    outputNodeId: null,
  };
}
