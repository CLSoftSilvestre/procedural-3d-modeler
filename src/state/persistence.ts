import type { Graph } from '@/graph/types';
import { deserializeGraph, serializeGraph } from '@/graph/serialize';
import { useStore } from './store';

const KEY = 'p3m.autosave.v1';

/** Load the last autosaved graph from localStorage, or null if none/invalid. */
export function loadPersistedGraph(): Graph | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const result = deserializeGraph(raw);
    return result.ok ? result.graph : null;
  } catch {
    return null;
  }
}

export function clearPersistedGraph(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Persist the graph to localStorage on change (debounced). Returns an unsubscribe fn.
 * The graph is small (no geometry), so serializing it on edit is cheap.
 */
export function setupAutosave(debounceMs = 500): () => void {
  let prevGraph = useStore.getState().graph;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return useStore.subscribe((state) => {
    if (state.graph === prevGraph) return;
    prevGraph = state.graph;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, serializeGraph(prevGraph));
      } catch {
        /* quota / unavailable — ignore */
      }
    }, debounceMs);
  });
}
