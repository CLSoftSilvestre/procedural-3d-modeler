import { NodeResizer, type NodeProps } from '@xyflow/react';
import { useStore, NOTE_COLORS } from '@/state/store';

/**
 * A canvas note / frame: a resizable, colored box with an editable label, used to annotate
 * or group nodes. Purely decorative (not part of the evaluated graph). Drag by its title bar
 * so the body can sit behind nodes without hijacking their interactions.
 */
export function NoteNode({ id, data, selected }: NodeProps) {
  const updateNote = useStore((s) => s.updateNote);
  const removeNote = useStore((s) => s.removeNote);
  const { text, color } = data as { text: string; color: string };

  const cycleColor = () => {
    const i = NOTE_COLORS.indexOf(color);
    updateNote(id, { color: NOTE_COLORS[(i + 1) % NOTE_COLORS.length]! });
  };

  return (
    <div className="note" style={{ ['--note' as string]: color }}>
      <NodeResizer color={color} isVisible={selected} minWidth={150} minHeight={90} />
      <div className="note__bar">
        <input
          className="note__title nodrag nopan"
          value={text}
          placeholder="Note / frame…"
          onChange={(e) => updateNote(id, { text: e.target.value })}
        />
        <button className="note__btn nodrag" title="Change color" onClick={cycleColor}>
          <span className="note__swatch" style={{ background: color }} />
        </button>
        <button
          className="note__btn note__btn--del nodrag"
          title="Delete note"
          onClick={() => removeNote(id)}
        >
          ×
        </button>
      </div>
    </div>
  );
}
