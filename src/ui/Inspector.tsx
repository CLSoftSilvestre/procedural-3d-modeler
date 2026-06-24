import { useStore } from '@/state/store';
import { requireNodeDef } from '@/nodes/registry';
import { isConnectableType, type LiteralValue } from '@/graph/types';
import { ValueControl } from './ValueControl';

export function Inspector() {
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const node = useStore((s) => s.graph.nodes.find((n) => n.id === s.selectedNodeId));
  const params = useStore((s) => s.graph.params);
  const setNodeValue = useStore((s) => s.setNodeValue);
  const removeNode = useStore((s) => s.removeNode);
  const exposeSocket = useStore((s) => s.exposeSocket);
  const unexposeParam = useStore((s) => s.unexposeParam);

  if (!node || !selectedNodeId) {
    return <div className="panel__empty">Select a node to edit its properties.</div>;
  }

  const def = requireNodeDef(node.type);
  const editable = def.inputs.filter((s) => !isConnectableType(s.type));

  return (
    <div className="inspector">
      <div className="inspector__header">
        <h3 className="inspector__title">{def.label}</h3>
        <button
          className="inspector__delete"
          title="Delete node (or select it and press Delete/Backspace)"
          onClick={() => removeNode(selectedNodeId)}
        >
          Delete
        </button>
      </div>
      {editable.length === 0 && <div className="panel__empty">No editable properties.</div>}
      {editable.map((socket) => {
        const value = node.values[socket.id];
        const param = params.find((p) => p.nodeId === selectedNodeId && p.socketId === socket.id);
        return (
          <div className="inspector__field" key={socket.id}>
            <div className="inspector__labelrow">
              <span className="inspector__label">{socket.label}</span>
              <button
                className={`inspector__expose${param ? ' is-exposed' : ''}`}
                title={param ? `Exposed as param "${param.name}" — click to remove` : 'Expose as parameter'}
                onClick={() => (param ? unexposeParam(param.id) : exposeSocket(selectedNodeId, socket.id))}
              >
                {param ? '◉ param' : '○ expose'}
              </button>
            </div>
            {param ? (
              <div className="inspector__exposed">→ controlled by param “{param.name}”</div>
            ) : (
              <ValueControl
                control={socket.control}
                value={value}
                onChange={(v: LiteralValue) => setNodeValue(selectedNodeId, socket.id, v as never)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
