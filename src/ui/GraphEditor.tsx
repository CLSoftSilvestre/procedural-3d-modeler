import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Connection,
  type Edge as RFEdge,
  type Node as RFNode,
  type NodeProps,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '@/state/store';
import { requireNodeDef } from '@/nodes/registry';

/** Generic node renderer driven by the node definition's sockets. */
function GraphNodeView({ id, data }: NodeProps) {
  const def = requireNodeDef(data.type as string);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const selected = selectedNodeId === id;

  return (
    <div className={`graph-node${selected ? ' selected' : ''}`}>
      <div className="graph-node__title">{def.label}</div>
      <div className="graph-node__body">
        {def.inputs.map((s, i) => (
          <div className="graph-node__row" key={s.id}>
            {s.type === 'geometry' && (
              <Handle
                type="target"
                position={Position.Left}
                id={s.id}
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
              style={{ top: 34 + (def.inputs.length + i) * 20 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GraphEditor() {
  const graph = useStore((s) => s.graph);
  const moveNode = useStore((s) => s.moveNode);
  const addEdge = useStore((s) => s.addEdge);
  const removeNode = useStore((s) => s.removeNode);
  const removeEdge = useStore((s) => s.removeEdge);
  const select = useStore((s) => s.select);

  const nodeTypes = useMemo(() => ({ proc: GraphNodeView }), []);

  const rfNodes: RFNode[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: 'proc',
        position: n.position,
        data: { type: n.type },
      })),
    [graph.nodes],
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

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onConnect={onConnect}
      onEdgesDelete={(edges) => edges.forEach((e) => removeEdge(e.id))}
      onPaneClick={() => select(null)}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#2a2a30" gap={16} />
      <Controls />
    </ReactFlow>
  );
}
