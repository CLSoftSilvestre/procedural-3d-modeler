import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nodeDefsByCategory } from '@/nodes/registry';
import { categoryColor } from './categoryColors';

/**
 * Right-click "add node" menu, opened at the cursor on the graph pane. A faster path than
 * the palette for adding a node exactly where you want it. Filterable; closes on pick,
 * Escape, or an outside click.
 */
export function GraphContextMenu({
  x,
  y,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  onPick: (type: string) => void;
  onClose: () => void;
}) {
  const byCategory = useMemo(() => nodeDefsByCategory(), []);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      [...byCategory.entries()]
        .map(([category, defs]) => {
          const matches = defs.filter(
            (d) => !q || d.label.toLowerCase().includes(q) || category.toLowerCase().includes(q),
          );
          return [category, matches] as const;
        })
        .filter(([, defs]) => defs.length > 0),
    [byCategory, q],
  );

  const W = 230;
  const left = Math.min(x, window.innerWidth - W - 8);
  const top = Math.min(y, window.innerHeight - 380);

  return createPortal(
    <div className="ctxmenu" style={{ left, top, width: W }} ref={rootRef}>
      <input
        ref={inputRef}
        className="ctxmenu__search"
        type="search"
        placeholder="Add node…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // Enter adds the first match.
          if (e.key === 'Enter') {
            const first = filtered[0]?.[1][0];
            if (first) onPick(first.type);
          }
        }}
      />
      <div className="ctxmenu__list">
        {filtered.map(([category, defs]) => (
          <div className="ctxmenu__group" key={category}>
            <span className="ctxmenu__cat">
              <span className="ctxmenu__dot" style={{ background: categoryColor(category) }} />
              {category}
            </span>
            {defs.map((def) => (
              <button key={def.type} className="ctxmenu__item" onClick={() => onPick(def.type)}>
                {def.label}
              </button>
            ))}
          </div>
        ))}
        {filtered.length === 0 && <div className="ctxmenu__empty">No nodes match.</div>}
      </div>
    </div>,
    document.body,
  );
}
