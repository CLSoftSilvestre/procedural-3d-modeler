import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { current } from 'immer';
import { createEmptyGraph, GRAPH_VERSION } from '@/graph/types';
import type { Edge, ExposedParam, Graph, GraphNode, LiteralValue } from '@/graph/types';
import { requireNodeDef } from '@/nodes/registry';
import { validateConnection } from '@/graph/validate';

const HISTORY_LIMIT = 100;

interface AppState {
  graph: Graph;
  selectedNodeId: string | null;
  notice: { kind: 'error' | 'info'; message: string } | null;
  /** In-app clipboard for copy/paste of a node (values only, no edges). */
  clipboard: GraphNode | null;

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
  duplicateNode: (id: string) => string | null;
  copyNode: (id: string) => void;
  pasteNode: () => string | null;
  exposeSocket: (nodeId: string, socketId: string) => void;
  unexposeParam: (paramId: string) => void;
  setParamValue: (paramId: string, value: LiteralValue) => void;
  renameParam: (paramId: string, name: string) => void;
  loadGraph: (graph: Graph) => void;
  newGraph: () => void;
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

/** Derive a unique, valid JS identifier for a new param from a label. */
function uniqueParamName(label: string, existing: ExposedParam[]): string {
  const base =
    label
      .replace(/[^a-zA-Z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))
      .replace(/^[^a-zA-Z_]+/, '') || 'param';
  const lower = base.charAt(0).toLowerCase() + base.slice(1);
  const taken = new Set(existing.map((p) => p.name));
  if (!taken.has(lower)) return lower;
  let i = 2;
  while (taken.has(`${lower}${i}`)) i++;
  return `${lower}${i}`;
}

/** Sanitize a user-entered param name to a valid identifier. */
function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '').replace(/^[^a-zA-Z_]+/, '') || 'param';
}

export const useStore = create<AppState>()(
  immer((set) => {
    /**
     * Detach a plain, structurally-cloned copy of the graph from the Immer draft.
     * `s.graph` inside a producer is an Immer draft (a Proxy) which cannot be
     * structuredClone'd directly — `current()` converts it to plain data first.
     */
    function snapshot(s: AppState): Graph {
      return structuredClone(current(s.graph));
    }

    /** Snapshot current graph onto the undo stack before a mutation. */
    function pushHistory(s: AppState, coalesceKey: string | null = null): void {
      if (coalesceKey && coalesceKey === s.lastEditKey) {
        s.lastEditKey = coalesceKey;
        return; // coalesce consecutive edits of the same field into one undo step
      }
      s.past.push(snapshot(s));
      if (s.past.length > HISTORY_LIMIT) s.past.shift();
      s.future = [];
      s.lastEditKey = coalesceKey;
    }

    return {
      graph: createEmptyGraph(),
      selectedNodeId: null,
      notice: null,
      clipboard: null,
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
          s.graph.params = s.graph.params.filter((p) => p.nodeId !== id);
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

      duplicateNode: (id) => {
        const src = useStore.getState().graph.nodes.find((n) => n.id === id);
        if (!src) return null;
        const copy: GraphNode = {
          ...structuredClone(src),
          id: nextId('node'),
          position: { x: src.position.x + 30, y: src.position.y + 30 },
        };
        set((s) => {
          pushHistory(s);
          s.graph.nodes.push(copy);
          s.selectedNodeId = copy.id;
        });
        return copy.id;
      },

      copyNode: (id) =>
        set((s) => {
          const node = s.graph.nodes.find((n) => n.id === id);
          s.clipboard = node ? structuredClone(current(node)) : s.clipboard;
        }),

      pasteNode: () => {
        const clip = useStore.getState().clipboard;
        if (!clip) return null;
        const copy: GraphNode = {
          ...structuredClone(clip),
          id: nextId('node'),
          position: { x: clip.position.x + 40, y: clip.position.y + 40 },
        };
        set((s) => {
          pushHistory(s);
          s.graph.nodes.push(copy);
          s.selectedNodeId = copy.id;
        });
        return copy.id;
      },

      exposeSocket: (nodeId, socketId) =>
        set((s) => {
          const node = s.graph.nodes.find((n) => n.id === nodeId);
          if (!node) return;
          if (s.graph.params.some((p) => p.nodeId === nodeId && p.socketId === socketId)) return;
          const def = requireNodeDef(node.type);
          const socket = def.inputs.find((i) => i.id === socketId);
          if (!socket || socket.type === 'geometry' || socket.type === 'material' || socket.type === 'shape') {
            return;
          }
          const value = (node.values[socketId] ?? socket.default) as LiteralValue;
          pushHistory(s);
          s.graph.params.push({
            id: nextId('param'),
            name: uniqueParamName(socket.label, s.graph.params),
            label: socket.label,
            type: socket.type,
            default: value,
            min: socket.control?.min,
            max: socket.control?.max,
            step: socket.control?.step,
            nodeId,
            socketId,
          });
        }),

      unexposeParam: (paramId) =>
        set((s) => {
          pushHistory(s);
          s.graph.params = s.graph.params.filter((p) => p.id !== paramId);
        }),

      setParamValue: (paramId, value) =>
        set((s) => {
          pushHistory(s, `param:${paramId}`);
          const param = s.graph.params.find((p) => p.id === paramId);
          if (!param) return;
          param.default = value;
          // Keep the bound node's literal in sync so the value is consistent if unexposed.
          const node = s.graph.nodes.find((n) => n.id === param.nodeId);
          if (node) node.values[param.socketId] = value as never;
        }),

      renameParam: (paramId, name) =>
        set((s) => {
          const param = s.graph.params.find((p) => p.id === paramId);
          if (!param) return;
          const desired = sanitizeIdentifier(name);
          if (s.graph.params.some((p) => p.id !== paramId && p.name === desired)) {
            s.notice = { kind: 'error', message: `Parameter "${desired}" already exists` };
            return;
          }
          pushHistory(s);
          param.name = desired;
        }),

      loadGraph: (graph) =>
        set((s) => {
          pushHistory(s);
          s.graph = { ...graph, version: GRAPH_VERSION };
          s.selectedNodeId = null;
          s.lastEditKey = null;
        }),

      newGraph: () =>
        set((s) => {
          pushHistory(s);
          s.graph = createEmptyGraph();
          s.selectedNodeId = null;
          s.lastEditKey = null;
        }),

      undo: () =>
        set((s) => {
          const prev = s.past.pop();
          if (!prev) return;
          s.future.push(snapshot(s));
          s.graph = prev;
          s.selectedNodeId = null;
          s.lastEditKey = null;
        }),

      redo: () =>
        set((s) => {
          const next = s.future.pop();
          if (!next) return;
          s.past.push(snapshot(s));
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
