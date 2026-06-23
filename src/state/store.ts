import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createEmptyGraph, GRAPH_VERSION } from '@/graph/types';
import type { Edge, Graph, GraphNode } from '@/graph/types';
import { requireNodeDef } from '@/nodes/registry';
import { validateConnection } from '@/graph/validate';

const HISTORY_LIMIT = 100;

interface AppState {
  graph: Graph;
  selectedNodeId: string | null;
  notice: { kind: 'error' | 'info'; message: string } | null;

  // history
  past: Graph[];
  future: Graph[];
  /** Coalescing key for rapid value edits (e.g. slider drags). */
  lastEditKey: string | null;

  addNode: (type: string, position: { x: number; y: number }) => string;
  removeNode: (id: string) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  setNodeValue: (id: string, socketId: string, value: number | boolean | string | number[]) => void;
  addEdge: (edge: Omit<Edge, 'id'>) => void;
  removeEdge: (id: string) => void;
  setOutputNode: (id: string | null) => void;
  select: (id: string | null) => void;
  loadGraph: (graph: Graph) => void;
  undo: () => void;
  redo: () => void;
  setNotice: (notice: AppState['notice']) => void;
}

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${idCounter++}`;

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
  immer((set) => {
    /** Snapshot current graph onto the undo stack before a mutation. */
    function pushHistory(s: AppState, coalesceKey: string | null = null): void {
      if (coalesceKey && coalesceKey === s.lastEditKey) {
        s.lastEditKey = coalesceKey;
        return; // coalesce consecutive edits of the same field into one undo step
      }
      s.past.push(structuredClone(s.graph));
      if (s.past.length > HISTORY_LIMIT) s.past.shift();
      s.future = [];
      s.lastEditKey = coalesceKey;
    }

    return {
      graph: createEmptyGraph(),
      selectedNodeId: null,
      notice: null,
      past: [],
      future: [],
      lastEditKey: null,

      addNode: (type, position) => {
        const node = makeNode(type, position);
        set((s) => {
          pushHistory(s);
          s.graph.nodes.push(node);
          if (type === 'output.mesh' && !s.graph.outputNodeId) {
            s.graph.outputNodeId = node.id;
          }
        });
        return node.id;
      },

      removeNode: (id) =>
        set((s) => {
          pushHistory(s);
          s.graph.nodes = s.graph.nodes.filter((n) => n.id !== id);
          s.graph.edges = s.graph.edges.filter((e) => e.source !== id && e.target !== id);
          if (s.graph.outputNodeId === id) s.graph.outputNodeId = null;
          if (s.selectedNodeId === id) s.selectedNodeId = null;
        }),

      moveNode: (id, position) =>
        set((s) => {
          pushHistory(s, `move:${id}`);
          const node = s.graph.nodes.find((n) => n.id === id);
          if (node) node.position = position;
        }),

      setNodeValue: (id, socketId, value) =>
        set((s) => {
          pushHistory(s, `value:${id}:${socketId}`);
          const node = s.graph.nodes.find((n) => n.id === id);
          if (node) node.values[socketId] = value as never;
        }),

      addEdge: (edge) =>
        set((s) => {
          const result = validateConnection(s.graph, edge);
          if (!result.ok) {
            s.notice = { kind: 'error', message: result.reason };
            return;
          }
          pushHistory(s);
          // Enforce single connection per target socket.
          s.graph.edges = s.graph.edges.filter(
            (e) => !(e.target === edge.target && e.targetSocket === edge.targetSocket),
          );
          s.graph.edges.push({ ...edge, id: nextId('edge') });
          s.notice = null;
        }),

      removeEdge: (id) =>
        set((s) => {
          pushHistory(s);
          s.graph.edges = s.graph.edges.filter((e) => e.id !== id);
        }),

      setOutputNode: (id) =>
        set((s) => {
          pushHistory(s);
          s.graph.outputNodeId = id;
        }),

      select: (id) =>
        set((s) => {
          s.selectedNodeId = id;
        }),

      loadGraph: (graph) =>
        set((s) => {
          pushHistory(s);
          s.graph = { ...graph, version: GRAPH_VERSION };
          s.selectedNodeId = null;
          s.lastEditKey = null;
        }),

      undo: () =>
        set((s) => {
          const prev = s.past.pop();
          if (!prev) return;
          s.future.push(structuredClone(s.graph));
          s.graph = prev;
          s.selectedNodeId = null;
          s.lastEditKey = null;
        }),

      redo: () =>
        set((s) => {
          const next = s.future.pop();
          if (!next) return;
          s.past.push(structuredClone(s.graph));
          s.graph = next;
          s.selectedNodeId = null;
          s.lastEditKey = null;
        }),

      setNotice: (notice) =>
        set((s) => {
          s.notice = notice;
        }),
    };
  }),
);
