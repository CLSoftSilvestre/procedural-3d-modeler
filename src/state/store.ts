import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createEmptyGraph, GRAPH_VERSION } from '@/graph/types';
import type { Edge, Graph, GraphNode } from '@/graph/types';
import { requireNodeDef } from '@/nodes/registry';

interface AppState {
  graph: Graph;
  selectedNodeId: string | null;

  addNode: (type: string, position: { x: number; y: number }) => string;
  removeNode: (id: string) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  setNodeValue: (id: string, socketId: string, value: number | boolean | string | number[]) => void;
  addEdge: (edge: Omit<Edge, 'id'>) => void;
  removeEdge: (id: string) => void;
  setOutputNode: (id: string | null) => void;
  select: (id: string | null) => void;
  loadGraph: (graph: Graph) => void;
}

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${idCounter++}`;

/** Build a node with default literal values from its definition's input sockets. */
function makeNode(type: string, position: { x: number; y: number }): GraphNode {
  const def = requireNodeDef(type);
  const values: GraphNode['values'] = {};
  for (const socket of def.inputs) {
    if (socket.type !== 'geometry' && socket.default !== undefined) {
      values[socket.id] = socket.default;
    }
  }
  return { id: nextId('node'), type, position, values, title: def.label };
}

export const useStore = create<AppState>()(
  immer((set) => ({
    graph: createEmptyGraph(),
    selectedNodeId: null,

    addNode: (type, position) => {
      const node = makeNode(type, position);
      set((s) => {
        s.graph.nodes.push(node);
        if (type === 'output.mesh' && !s.graph.outputNodeId) {
          s.graph.outputNodeId = node.id;
        }
      });
      return node.id;
    },

    removeNode: (id) =>
      set((s) => {
        s.graph.nodes = s.graph.nodes.filter((n) => n.id !== id);
        s.graph.edges = s.graph.edges.filter((e) => e.source !== id && e.target !== id);
        if (s.graph.outputNodeId === id) s.graph.outputNodeId = null;
        if (s.selectedNodeId === id) s.selectedNodeId = null;
      }),

    moveNode: (id, position) =>
      set((s) => {
        const node = s.graph.nodes.find((n) => n.id === id);
        if (node) node.position = position;
      }),

    setNodeValue: (id, socketId, value) =>
      set((s) => {
        const node = s.graph.nodes.find((n) => n.id === id);
        if (node) node.values[socketId] = value as never;
      }),

    addEdge: (edge) =>
      set((s) => {
        // Enforce single connection per target socket.
        s.graph.edges = s.graph.edges.filter(
          (e) => !(e.target === edge.target && e.targetSocket === edge.targetSocket),
        );
        s.graph.edges.push({ ...edge, id: nextId('edge') });
      }),

    removeEdge: (id) =>
      set((s) => {
        s.graph.edges = s.graph.edges.filter((e) => e.id !== id);
      }),

    setOutputNode: (id) =>
      set((s) => {
        s.graph.outputNodeId = id;
      }),

    select: (id) =>
      set((s) => {
        s.selectedNodeId = id;
      }),

    loadGraph: (graph) =>
      set((s) => {
        s.graph = { ...graph, version: GRAPH_VERSION };
        s.selectedNodeId = null;
      }),
  })),
);
