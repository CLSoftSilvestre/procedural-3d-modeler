import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useReactFlow,
  type Connection,
  type Edge as RFEdge,
  type Node as RFNode,
  type NodeProps,
  type NodeChange,
} from '@xyflow/react';
import { DND_NODE_MIME } from './dnd';
import '@xyflow/react/dist/style.css';
import { useStore } from '@/state/store';
import { requireNodeDef } from '@/nodes/registry';
import { isConnectableType } from '@/graph/types';
import { categoryColor } from './categoryColors';

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

export function GraphEditor({ errorNodeIds }: { errorNodeIds?: Set<string> }) {
  const graph = useStore((s) => s.graph);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const moveNode = useStore((s) => s.moveNode);
  const addEdge = useStore((s) => s.addEdge);
  const removeNode = useStore((s) => s.removeNode);
  const removeEdge = useStore((s) => s.removeEdge);
  const select = useStore((s) => s.select);
  const addNode = useStore((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow();

  const nodeTypes = useMemo(() => ({ proc: GraphNodeView }), []);

  const rfNodes: RFNode[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: 'proc',
        position: n.position,
        // Reflect selection so React Flow knows what to delete on Backspace/Delete.
        selected: n.id === selectedNodeId,
        data: { type: n.type, error: errorNodeIds?.has(n.id) ?? false },
      })),
    [graph.nodes, selectedNodeId, errorNodeIds],
  );

  const rfEdges: RFEdge[] = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
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
        if (c.type === 'position' && c.position) moveNode(c.id, c.position);
        else if (c.type === 'remove') removeNode(c.id);
        else if (c.type === 'select' && c.selected) select(c.id);
      }
    },
    [moveNode, removeNode, select],
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

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onConnect={onConnect}
      onNodesDelete={(nodes) => nodes.forEach((n) => removeNode(n.id))}
      onEdgesDelete={(edges) => edges.forEach((e) => removeEdge(e.id))}
      onPaneClick={() => select(null)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      deleteKeyCode={['Backspace', 'Delete']}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#2a2a30" gap={16} />
      <Controls />
    </ReactFlow>
  );
}
