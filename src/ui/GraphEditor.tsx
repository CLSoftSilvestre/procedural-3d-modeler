import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type Connection,
  type Edge as RFEdge,
  type EdgeProps,
  type EdgeChange,
  type Node as RFNode,
  type NodeProps,
  type NodeChange,
} from '@xyflow/react';
import { DND_NODE_MIME } from './dnd';
import '@xyflow/react/dist/style.css';
import { useStore } from '@/state/store';
import { getNodeDef, requireNodeDef } from '@/nodes/registry';
import { isConnectableType } from '@/graph/types';
import { categoryColor } from './categoryColors';
import { GraphContextMenu } from './GraphContextMenu';
import { NoteNode } from './NoteNode';
import { Icon } from './Icon';

const MINIMAP_KEY = 'p3m.minimap.v1';

/** Generic node renderer driven by the node definition's sockets. */
function GraphNodeView({ id, data }: NodeProps) {
  const def = requireNodeDef(data.type as string);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const selected = selectedNodeId === id;
  const hasError = Boolean(data.error);

  const accent = categoryColor(def.category);
  return (
    <div
      className={`graph-node${selected ? ' selected' : ''}${hasError ? ' has-error' : ''}`}
      style={{ ['--cat' as string]: accent }}
    >
      <div className="graph-node__title">
        <span className="graph-node__dot" />
        {def.label}
      </div>
      <div className="graph-node__body">
        {def.inputs.map((s, i) => (
          <div className="graph-node__row" key={s.id}>
            {isConnectableType(s.type) && (
              <Handle
                type="target"
                position={Position.Left}
                id={s.id}
                className={`handle handle--${s.type}`}
                style={{ top: 34 + i * 20 }}
              />
            )}
            <span className="graph-node__label">{s.label}</span>
          </div>
        ))}
        {def.outputs.map((s, i) => (
          <div className="graph-node__row graph-node__row--out" key={s.id}>
            <span className="graph-node__label">{s.label}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={s.id}
              className={`handle handle--${s.type}`}
              style={{ top: 34 + (def.inputs.length + i) * 20 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Edge with a hover/select-revealed “×” button to remove the connection. */
function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
}: EdgeProps) {
  const removeEdge = useStore((s) => s.removeEdge);
  const [hover, setHover] = useState(false);
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const active = hover || selected;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ ...style, stroke: active ? 'var(--accent)' : undefined, strokeWidth: active ? 2.5 : 1.5 }}
      />
      {/* Wide invisible hit area so the edge is easy to hover. */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
      <EdgeLabelRenderer>
        <button
          className={`edge-delete${active ? ' is-on' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={(e) => {
            e.stopPropagation();
            removeEdge(id);
          }}
          title="Remove connection"
        >
          ×
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

export function GraphEditor({ errorNodeIds }: { errorNodeIds?: Set<string> }) {
  const graph = useStore((s) => s.graph);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const moveNode = useStore((s) => s.moveNode);
  const addEdge = useStore((s) => s.addEdge);
  const removeNode = useStore((s) => s.removeNode);
  const removeEdge = useStore((s) => s.removeEdge);
  const select = useStore((s) => s.select);
  const addNode = useStore((s) => s.addNode);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const removeNote = useStore((s) => s.removeNote);
  const { screenToFlowPosition } = useReactFlow();
  const [menu, setMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(
    null,
  );
  const [showMinimap, setShowMinimap] = useState(() => {
    try {
      return localStorage.getItem(MINIMAP_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const toggleMinimap = useCallback(() => {
    setShowMinimap((v) => {
      const next = !v;
      try {
        localStorage.setItem(MINIMAP_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const nodeTypes = useMemo(() => ({ proc: GraphNodeView, note: NoteNode }), []);
  const edgeTypes = useMemo(() => ({ deletable: DeletableEdge }), []);
  const noteIds = useMemo(() => new Set((graph.notes ?? []).map((n) => n.id)), [graph.notes]);

  const rfNodes: RFNode[] = useMemo(() => {
    // Notes first so they render behind the real nodes (acting as frames).
    const noteNodes: RFNode[] = (graph.notes ?? []).map((n) => ({
      id: n.id,
      type: 'note',
      position: n.position,
      width: n.width,
      height: n.height,
      style: { width: n.width, height: n.height },
      selected: n.id === selectedNodeId,
      dragHandle: '.note__bar',
      zIndex: 0,
      data: { text: n.text, color: n.color },
    }));
    const procNodes: RFNode[] = graph.nodes.map((n) => ({
      id: n.id,
      type: 'proc',
      position: n.position,
      // Reflect selection so React Flow knows what to delete on Backspace/Delete.
      selected: n.id === selectedNodeId,
      zIndex: 1,
      data: { type: n.type, error: errorNodeIds?.has(n.id) ?? false },
    }));
    return [...noteNodes, ...procNodes];
  }, [graph.nodes, graph.notes, selectedNodeId, errorNodeIds]);

  const rfEdges: RFEdge[] = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        type: 'deletable',
        source: e.source,
        sourceHandle: e.sourceSocket,
        target: e.target,
        targetHandle: e.targetSocket,
      })),
    [graph.edges],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position) {
          if (noteIds.has(c.id)) updateNote(c.id, { position: c.position });
          else moveNode(c.id, c.position);
        } else if (c.type === 'dimensions' && noteIds.has(c.id) && c.dimensions) {
          updateNote(c.id, { width: c.dimensions.width, height: c.dimensions.height });
        } else if (c.type === 'remove') {
          if (noteIds.has(c.id)) removeNote(c.id);
          else removeNode(c.id);
        } else if (c.type === 'select' && c.selected) {
          select(c.id);
        }
      }
    },
    [moveNode, removeNode, select, noteIds, updateNote, removeNote],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Remove selected edges deleted via Backspace/Delete (selection is RF-internal).
      for (const c of changes) if (c.type === 'remove') removeEdge(c.id);
    },
    [removeEdge],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || !c.sourceHandle || !c.targetHandle) return;
      addEdge({
        source: c.source,
        sourceSocket: c.sourceHandle,
        target: c.target,
        targetSocket: c.targetHandle,
      });
    },
    [addEdge],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DND_NODE_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const type = e.dataTransfer.getData(DND_NODE_MIME);
      if (!type) return;
      e.preventDefault();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = addNode(type, position);
      select(id);
    },
    [addNode, screenToFlowPosition, select],
  );

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setMenu({ x: e.clientX, y: e.clientY, flowX: flow.x, flowY: flow.y });
    },
    [screenToFlowPosition],
  );

  return (
    <>
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodesDelete={(nodes) => nodes.forEach((n) => removeNode(n.id))}
      onPaneClick={() => select(null)}
      onPaneContextMenu={onPaneContextMenu}
      onDragOver={onDragOver}
      onDrop={onDrop}
      deleteKeyCode={['Backspace', 'Delete']}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#2a2a30" gap={16} />
      <Controls>
        <ControlButton
          onClick={toggleMinimap}
          title={showMinimap ? 'Hide minimap' : 'Show minimap'}
          className={`minimap-toggle${showMinimap ? ' is-active' : ''}`}
        >
          <Icon name="map" size={14} />
        </ControlButton>
      </Controls>
      {showMinimap && (
        <MiniMap
          pannable
          zoomable
          className="graph-minimap"
          nodeColor={(n) => categoryColor(getNodeDef((n.data as { type: string }).type)?.category ?? '')}
          maskColor="rgba(0,0,0,0.5)"
        />
      )}
    </ReactFlow>
    {menu && (
      <GraphContextMenu
        x={menu.x}
        y={menu.y}
        onClose={() => setMenu(null)}
        onPick={(type) => {
          const id = addNode(type, { x: menu.flowX, y: menu.flowY });
          select(id);
          setMenu(null);
        }}
        onAddNote={() => {
          const id = addNote({ x: menu.flowX, y: menu.flowY });
          select(id);
          setMenu(null);
        }}
      />
    )}
    </>
  );
}
