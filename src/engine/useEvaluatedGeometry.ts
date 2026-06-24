import { useEffect, useRef, useState } from 'react';
import type { Graph } from '@/graph/types';
import type { GeometryData } from '@/geometry/GeometryData';
import type { MaterialSpec } from '@/material/MaterialData';
import { EvalService } from './EvalService';
import type { EvalError, EvalResult } from './evaluate';

interface EvalState {
  geometry: GeometryData | null;
  material: MaterialSpec | null;
  errors: EvalError[];
  evaluating: boolean;
}

/**
 * Evaluate `graph` off the main thread, returning the latest geometry/errors.
 *
 * The EvalService (and its worker) is created in an effect and torn down on unmount,
 * so it survives React StrictMode's mount→unmount→remount cycle correctly: the worker
 * is recreated on remount rather than being left terminated.
 */
export function useEvaluatedGeometry(graph: Graph, seed = 1): EvalState {
  const [service, setService] = useState<EvalService | null>(null);
  const [state, setState] = useState<EvalState>({
    geometry: null,
    material: null,
    errors: [],
    evaluating: false,
  });

  useEffect(() => {
    let svc: EvalService | null = null;
    try {
      svc = new EvalService();
      setService(svc);
    } catch (err) {
      setState((s) => ({
        ...s,
        errors: [{ nodeId: '', message: `Failed to start evaluation worker: ${String(err)}` }],
      }));
    }
    return () => {
      svc?.dispose();
      setService(null);
    };
  }, []);

  const lastChangeRef = useRef(0);
  const fullTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!service) return;

    const apply = (result: EvalResult) => {
      setState((prev) =>
        // On error, keep the last good geometry so the viewport never blanks out;
        // otherwise adopt the new result (including a legitimate empty graph).
        result.errors.length > 0
          ? { geometry: prev.geometry, material: prev.material, errors: result.errors, evaluating: false }
          : { geometry: result.geometry, material: result.material, errors: [], evaluating: false },
      );
    };

    // Rapid successive edits → preview quality for fast feedback; a trailing full-quality
    // pass runs once edits settle.
    const now = Date.now();
    const rapid = now - lastChangeRef.current < 180;
    lastChangeRef.current = now;

    setState((s) => ({ ...s, evaluating: true }));
    service.request(graph, seed, rapid ? 'preview' : 'full', apply);

    clearTimeout(fullTimerRef.current);
    if (rapid) {
      fullTimerRef.current = setTimeout(() => service.request(graph, seed, 'full', apply), 220);
    }

    return () => clearTimeout(fullTimerRef.current);
  }, [service, graph, seed]);

  return state;
}
