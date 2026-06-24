import { createPortal } from 'react-dom';
import type { NodeDef } from '@/nodes/NodeDef';
import { isObjectType } from '@/graph/types';
import { categoryColor } from './categoryColors';
import { NodeThumbnail } from './NodeThumbnail';

/**
 * Rich hover card for a palette node: a visual thumbnail plus its key properties and
 * connections. Rendered in a portal so it floats above the (scroll-clipped) palette.
 */
export function NodeTooltip({ def, anchor }: { def: NodeDef; anchor: DOMRect }) {
  const accent = categoryColor(def.category);

  const params = def.inputs.filter((s) => !isObjectType(s.type) && !s.group);
  const connections = def.inputs.filter((s) => isObjectType(s.type));
  const hasTransform = def.inputs.some((s) => s.group === 'Transform');

  // Position to the right of the item, clamped into the viewport vertically.
  const width = 250;
  const margin = 10;
  const left = Math.min(anchor.right + 8, window.innerWidth - width - margin);
  const top = Math.max(margin, Math.min(anchor.top, window.innerHeight - 220 - margin));

  return createPortal(
    <div className="nodetip" style={{ left, top, width, ['--cat' as string]: accent }}>
      <div className="nodetip__art">
        <NodeThumbnail type={def.type} category={def.category} accent={accent} />
      </div>
      <div className="nodetip__head">
        <span className="nodetip__title">{def.label}</span>
        <span className="nodetip__cat" style={{ background: accent }}>
          {def.category}
        </span>
      </div>
      {def.description && <p className="nodetip__desc">{def.description}</p>}
      {connections.length > 0 && (
        <div className="nodetip__section">
          <span className="nodetip__lbl">Inputs</span>
          <div className="nodetip__chips">
            {connections.map((s) => (
              <span className="nodetip__chip nodetip__chip--in" key={s.id}>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}
      {params.length > 0 && (
        <div className="nodetip__section">
          <span className="nodetip__lbl">Properties</span>
          <div className="nodetip__chips">
            {params.slice(0, 6).map((s) => (
              <span className="nodetip__chip" key={s.id}>
                {s.label}
              </span>
            ))}
            {params.length > 6 && <span className="nodetip__chip">+{params.length - 6}</span>}
          </div>
        </div>
      )}
      {hasTransform && (
        <div className="nodetip__transform">⤢ Built-in transform · position · rotation · scale</div>
      )}
    </div>,
    document.body,
  );
}
