'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/**
 * GET a resource and keep it fresh. `path === null` skips the request (e.g. waiting for a selection).
 * State is only set from promise callbacks, never synchronously inside the effect.
 */
export function useResource<T>(path: string | null, opts: { refreshMs?: number } = {}) {
  const [state, setState] = useState<{ path: string; data: T } | null>(null);
  const [error, setError] = useState<{ path: string; error: unknown } | null>(null);
  const [tick, setTick] = useState(0);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    inFlight.current?.abort();
    inFlight.current = ctrl;
    api<T>(path, { signal: ctrl.signal }).then(
      (data) => {
        if (ctrl.signal.aborted) return;
        setState({ path, data });
        setError(null);
      },
      (e: unknown) => {
        if (!ctrl.signal.aborted) setError({ path, error: e });
      },
    );
    return () => ctrl.abort();
  }, [path, tick]);

  useEffect(() => {
    if (!path || !opts.refreshMs) return;
    const id = setInterval(() => setTick((t) => t + 1), opts.refreshMs);
    return () => clearInterval(id);
  }, [path, opts.refreshMs]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const current = state && state.path === path ? state.data : null;
  return {
    data: current,
    /** Data from a previous path while the new one loads (avoids flashing empty tables). */
    stale: state?.data ?? null,
    loading: Boolean(path) && !current && !(error && error.path === path),
    error: error && error.path === path ? error.error : null,
    reload,
    setData: (updater: (d: T) => T) => setState((s) => (s && s.path === path ? { path: s.path, data: updater(s.data) } : s)),
  };
}
