import { useEffect, useState } from 'react';

export interface LayoutState {
  leftW: number;
  rightW: number;
  graphH: number;
  leftOpen: boolean;
  rightOpen: boolean;
}

const KEY = 'p3m.ui.v1';
const DEFAULTS: LayoutState = { leftW: 190, rightW: 290, graphH: 340, leftOpen: true, rightOpen: true };

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function load(): LayoutState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LayoutState>) };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

/** Layout sizes/visibility for the resizable, collapsible panels — persisted locally. */
export function useLayout() {
  const [layout, setLayout] = useState<LayoutState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(layout));
    } catch {
      /* ignore */
    }
  }, [layout]);

  const update = (patch: Partial<LayoutState>) => setLayout((l) => ({ ...l, ...patch }));
  return { layout, update };
}
