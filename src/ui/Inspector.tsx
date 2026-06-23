import { useStore } from '@/state/store';
import { requireNodeDef } from '@/nodes/registry';

export function Inspector() {
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const node = useStore((s) => s.graph.nodes.find((n) => n.id === s.selectedNodeId));
  const setNodeValue = useStore((s) => s.setNodeValue);
  const removeNode = useStore((s) => s.removeNode);

  if (!node || !selectedNodeId) {
    return <div className="panel__empty">Select a node to edit its properties.</div>;
  }

  const def = requireNodeDef(node.type);
  const editable = def.inputs.filter((s) => s.type !== 'geometry');

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
        const ctrl = socket.control;
        return (
          <label className="inspector__field" key={socket.id}>
            <span className="inspector__label">{socket.label}</span>
            {ctrl?.kind === 'slider' || ctrl?.kind === 'number' ? (
              <div className="inspector__row">
                {ctrl.kind === 'slider' && (
                  <input
                    type="range"
                    min={ctrl.min}
                    max={ctrl.max}
                    step={ctrl.step}
                    value={Number(value ?? 0)}
                    onChange={(e) =>
                      setNodeValue(selectedNodeId, socket.id, Number(e.target.value))
                    }
                  />
                )}
                <input
                  type="number"
                  min={ctrl.min}
                  max={ctrl.max}
                  step={ctrl.step}
                  value={Number(value ?? 0)}
                  onChange={(e) => setNodeValue(selectedNodeId, socket.id, Number(e.target.value))}
                />
              </div>
            ) : ctrl?.kind === 'checkbox' ? (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => setNodeValue(selectedNodeId, socket.id, e.target.checked)}
              />
            ) : ctrl?.kind === 'color' ? (
              <input
                type="color"
                value={String(value ?? '#ffffff')}
                onChange={(e) => setNodeValue(selectedNodeId, socket.id, e.target.value)}
              />
            ) : ctrl?.kind === 'select' ? (
              <select
                value={String(value ?? ctrl.options?.[0]?.value ?? '')}
                onChange={(e) => setNodeValue(selectedNodeId, socket.id, e.target.value)}
              >
                {ctrl.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={String(value ?? '')}
                onChange={(e) => setNodeValue(selectedNodeId, socket.id, e.target.value)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
