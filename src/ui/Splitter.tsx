import { useRef, type PointerEvent } from 'react';

interface SplitterProps {
  /** 'x' = vertical bar resizing width; 'y' = horizontal bar resizing height. */
  axis: 'x' | 'y';
  /** Called with the pixel delta since the last move event while dragging. */
  onDrag: (delta: number) => void;
}

/** A thin draggable divider. Uses pointer capture so dragging is robust off-element. */
export function Splitter({ axis, onDrag }: SplitterProps) {
  const last = useRef(0);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = axis === 'x' ? e.clientX : e.clientY;
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
    const cur = axis === 'x' ? e.clientX : e.clientY;
    const delta = cur - last.current;
    if (delta !== 0) {
      last.current = cur;
      onDrag(delta);
    }
  }

  return (
    <div
      className={`splitter splitter--${axis}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
    />
  );
}
