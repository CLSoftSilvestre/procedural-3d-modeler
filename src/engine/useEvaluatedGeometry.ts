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
 * When `playing`, an animation loop advances a time clock and re-evaluates each frame
 * (preview quality) so Time-driven graphs animate. Paused, it does the normal
 * preview-then-full pass at the current time.
 *
 * The EvalService (and its worker) is created in an effect and torn down on unmount, so
 * it survives React StrictMode's mount→unmount→remount cycle (worker recreated, not left
 * terminated).
 */
export function useEvaluatedGeometry(graph: Graph, seed = 1, playing = false): EvalState {
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
  const timeRef = useRef(0);

  const apply = (result: EvalResult) => {
    setState((prev) =>
      // On error, keep the last good geometry so the viewport never blanks out;
      // otherwise adopt the new result (including a legitimate empty graph).
      result.errors.length > 0
        ? { geometry: prev.geometry, material: prev.material, errors: result.errors, evaluating: false }
        : { geometry: result.geometry, material: result.material, errors: [], evaluating: false },
    );
  };

  useEffect(() => {
    if (!service) return;

    if (playing) {
      // Animate: advance the clock and re-evaluate each frame at preview quality.
      let raf = 0;
      const startMs = performance.now() - timeRef.current * 1000; // resume from current time
      const tick = () => {
        timeRef.current = (performance.now() - startMs) / 1000;
        service.request(graph, seed, 'preview', timeRef.current, apply);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    // Paused: preview while editing rapidly, then a trailing full-quality pass.
    const now = Date.now();
    const rapid = now - lastChangeRef.current < 180;
    lastChangeRef.current = now;

    setState((s) => ({ ...s, evaluating: true }));
    service.request(graph, seed, rapid ? 'preview' : 'full', timeRef.current, apply);

    clearTimeout(fullTimerRef.current);
    if (rapid) {
      fullTimerRef.current = setTimeout(
        () => service.request(graph, seed, 'full', timeRef.current, apply),
        220,
      );
    }
    return () => clearTimeout(fullTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, graph, seed, playing]);

  return state;
}
