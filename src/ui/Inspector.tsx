import { useStore } from '@/state/store';
import { requireNodeDef } from '@/nodes/registry';
import { isObjectType, type ExposedParam, type LiteralValue, type SocketSpec } from '@/graph/types';
import { ValueControl } from './ValueControl';
import { MaterialPresetPicker } from './MaterialPresetPicker';
import { Icon } from './Icon';

/** Synthesize an inspector control from an exposed parameter's metadata. */
function controlForParam(p: ExposedParam): SocketSpec['control'] {
  switch (p.type) {
    case 'number':
      return p.min !== undefined && p.max !== undefined
        ? { kind: 'slider', min: p.min, max: p.max, step: p.step }
        : { kind: 'number', step: p.step };
    case 'boolean':
      return { kind: 'checkbox' };
    case 'color':
      return { kind: 'color' };
    case 'vector3':
      return { kind: 'vector' };
    default:
      return { kind: 'text' };
  }
}

export function Inspector() {
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const node = useStore((s) => s.graph.nodes.find((n) => n.id === s.selectedNodeId));
  const def = node ? requireNodeDef(node.type) : null;
  const removeNode = useStore((s) => s.removeNode);
  const duplicateNode = useStore((s) => s.duplicateNode);

  if (!node || !selectedNodeId || !def) {
    return <div className="panel__empty">Select a node to edit its properties.</div>;
  }

  // Scalar inputs get inline controls; object inputs (geometry/material/shape) are edge-only.
  const editable = def.inputs.filter((s) => !isObjectType(s.type));
  const ungrouped = editable.filter((s) => !s.group);
  const groups = new Map<string, SocketSpec[]>();
  for (const s of editable) {
    if (!s.group) continue;
    const list = groups.get(s.group) ?? [];
    list.push(s);
    groups.set(s.group, list);
  }

  return (
    <div className="inspector">
      <div className="inspector__header">
        <h3 className="inspector__title">{def.label}</h3>
        <div className="inspector__headbtns">
          <button
            className="iconbtn"
            title="Duplicate node (Ctrl/Cmd+D)"
            onClick={() => duplicateNode(selectedNodeId)}
          >
            <Icon name="duplicate" />
          </button>
          <button
            className="iconbtn iconbtn--danger"
            title="Delete node (or select it and press Delete/Backspace)"
            onClick={() => removeNode(selectedNodeId)}
          >
            <Icon name="delete" />
          </button>
        </div>
      </div>
      {def.description && <p className="inspector__desc">{def.description}</p>}
      {node.component && (
        <div className="inspector__component">
          <div className="inspector__compsrc">
            <Icon name="folder" size={12} /> {node.component.name}
          </div>
          {node.component.params.length === 0 ? (
            <div className="panel__empty">This model has no exposed parameters.</div>
          ) : (
            <>
              <div className="inspector__seclabel">Parameters</div>
              {node.component.params.map((p) => (
                <ComponentParamField key={p.id} nodeId={selectedNodeId} param={p} />
              ))}
            </>
          )}
        </div>
      )}
      {node.type === 'material.standard' && <MaterialPresetPicker nodeId={selectedNodeId} />}
      {editable.length === 0 && <div className="panel__empty">No editable properties.</div>}
      {ungrouped.map((socket) => (
        <InspectorField key={socket.id} nodeId={selectedNodeId} socket={socket} />
      ))}
      {[...groups.entries()].map(([name, sockets]) => (
        <details className="inspector__group" key={name}>
          <summary className="inspector__group-head">
            <Icon name="chevron-right" size={12} />
            {name}
          </summary>
          <div className="inspector__group-body">
            {sockets.map((socket) => (
              <InspectorField key={socket.id} nodeId={selectedNodeId} socket={socket} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function InspectorField({ nodeId, socket }: { nodeId: string; socket: SocketSpec }) {
  const value = useStore((s) => s.graph.nodes.find((n) => n.id === nodeId)?.values[socket.id]);
  const param = useStore((s) =>
    s.graph.params.find((p) => p.nodeId === nodeId && p.socketId === socket.id),
  );
  const connected = useStore((s) =>
    s.graph.edges.some((e) => e.target === nodeId && e.targetSocket === socket.id),
  );
  const setNodeValue = useStore((s) => s.setNodeValue);
  const exposeSocket = useStore((s) => s.exposeSocket);
  const unexposeParam = useStore((s) => s.unexposeParam);

  return (
    <div className="inspector__field">
      <div className="inspector__labelrow">
        <span className="inspector__label">{socket.label}</span>
        {!connected && (
          <button
            className={`inspector__expose${param ? ' is-exposed' : ''}`}
            title={param ? `Exposed as param "${param.name}" — click to remove` : 'Expose as parameter'}
            onClick={() => (param ? unexposeParam(param.id) : exposeSocket(nodeId, socket.id))}
          >
            <Icon name={param ? 'circle-filled' : 'circle'} size={11} />
            {param ? 'param' : 'expose'}
          </button>
        )}
      </div>
      {connected ? (
        <div className="inspector__exposed">← driven by a connected node</div>
      ) : param ? (
        <div className="inspector__exposed">→ controlled by param “{param.name}”</div>
      ) : (
        <ValueControl
          control={socket.control}
          value={value}
          onChange={(v: LiteralValue) => setNodeValue(nodeId, socket.id, v as never)}
        />
      )}
    </div>
  );
}

/** A per-instance control for one of a component's exposed parameters. */
function ComponentParamField({ nodeId, param }: { nodeId: string; param: ExposedParam }) {
  const value = useStore((s) => s.graph.nodes.find((n) => n.id === nodeId)?.values[param.name]);
  const setNodeValue = useStore((s) => s.setNodeValue);
  return (
    <div className="inspector__field">
      <span className="inspector__label">{param.label}</span>
      <ValueControl
        control={controlForParam(param)}
        value={value ?? param.default}
        onChange={(v: LiteralValue) => setNodeValue(nodeId, param.name, v as never)}
      />
    </div>
  );
}
