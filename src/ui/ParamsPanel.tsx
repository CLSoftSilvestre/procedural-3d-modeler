import { useStore } from '@/state/store';
import { getNodeDef } from '@/nodes/registry';
import type { LiteralValue } from '@/graph/types';
import { ValueControl } from './ValueControl';

/**
 * Params panel — lists exposed parameters and drives them live. Each param maps to a
 * field of the exported `createModel(params)` function; editing here updates the viewport
 * and the default baked into generated code.
 */
export function ParamsPanel() {
  const params = useStore((s) => s.graph.params);
  const nodes = useStore((s) => s.graph.nodes);
  const setParamValue = useStore((s) => s.setParamValue);
  const renameParam = useStore((s) => s.renameParam);
  const unexposeParam = useStore((s) => s.unexposeParam);
  const select = useStore((s) => s.select);

  return (
    <div className="params">
      <h3 className="params__title">Parameters</h3>
      {params.length === 0 && (
        <div className="panel__empty">
          No parameters. Click “○ expose” on a node input in the inspector to make it a
          runtime parameter.
        </div>
      )}
      {params.map((p) => {
        const boundNode = nodes.find((n) => n.id === p.nodeId);
        const def = boundNode ? getNodeDef(boundNode.type) : undefined;
        const socket = def?.inputs.find((i) => i.id === p.socketId);
        return (
          <div className="params__item" key={p.id}>
            <div className="params__row">
              <input
                className="params__name"
                value={p.name}
                title="Parameter name (used in generated code)"
                onChange={(e) => renameParam(p.id, e.target.value)}
              />
              <button
                className="params__locate"
                title="Select bound node"
                onClick={() => select(p.nodeId)}
              >
                ⌖
              </button>
              <button
                className="params__remove"
                title="Remove parameter"
                onClick={() => unexposeParam(p.id)}
              >
                ✕
              </button>
            </div>
            <ValueControl
              control={socket?.control}
              value={p.default}
              onChange={(v: LiteralValue) => setParamValue(p.id, v)}
            />
          </div>
        );
      })}
    </div>
  );
}
