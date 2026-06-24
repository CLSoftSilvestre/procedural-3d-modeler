import type { GeometryData } from '@/geometry/GeometryData';
import type { ShapeData } from '@/geometry/ShapeData';
import type { MaterialSpec } from '@/material/MaterialData';

/**
 * Graph IR — pure, serializable description of the model.
 * The evaluation engine and code generator are both pure functions of (Graph, params).
 * See ARCHITECTURE.md §3.
 */

/** Value types that can travel along sockets and be stored as node inputs. */
export type SocketType =
  | 'geometry'
  | 'material'
  | 'shape'
  | 'number'
  | 'vector3'
  | 'boolean'
  | 'string'
  | 'color';

export type SocketValue =
  | GeometryData
  | MaterialSpec
  | ShapeData
  | number
  | [number, number, number]
  | boolean
  | string;

/** Object-valued socket types (no inline literal control — only set via an edge). */
export function isObjectType(type: SocketType): boolean {
  return type === 'geometry' || type === 'material' || type === 'shape';
}

/** Socket types that can be wired with edges (rendered with a connection handle).
 *  `number` is included so value nodes (Random, Expression) can drive scalar inputs;
 *  it still has an inline control in the inspector when not connected. */
export function isConnectableType(type: SocketType): boolean {
  return isObjectType(type) || type === 'number';
}

/** Plain literal values that can be stored on a node and edited in the inspector. */
export type LiteralValue = Exclude<SocketValue, GeometryData | MaterialSpec | ShapeData>;

export interface SocketSpec {
  id: string;
  label: string;
  type: SocketType;
  /** Default literal value when no edge is connected (not used for geometry inputs). */
  default?: LiteralValue;
  /** Optional inspector section this input belongs to (e.g. "Transform"). Inputs sharing
   *  a group are rendered together in a collapsible section; ungrouped inputs come first. */
  group?: string;
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
  values: Record<string, LiteralValue>;
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
  default: LiteralValue;
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

export const GRAPH_VERSION = '0.2.0';

export function createEmptyGraph(): Graph {
  return {
    version: GRAPH_VERSION,
    nodes: [],
    edges: [],
    params: [],
    outputNodeId: null,
  };
}
