'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { AdminBranch } from './types';
import { useResource } from './use-resource';

const KEY = 'lt_admin_branch';
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? 'all';
  } catch {
    return 'all';
  }
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

interface BranchValue {
  branches: AdminBranch[];
  loading: boolean;
  /** 'all' or a branch id */
  selected: string;
  select: (id: string) => void;
  /** Branch ids the current selection covers. */
  scopeIds: string[];
  /** For API calls: undefined means "all my branches". */
  branchParam: string | undefined;
  reload: () => void;
  byId: (id: string | null | undefined) => AdminBranch | undefined;
}

const BranchContext = createContext<BranchValue | null>(null);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { data, loading, reload } = useResource<{ items: AdminBranch[] }>('/api/v1/admin/branches');
  const stored = useSyncExternalStore(subscribe, read, () => 'all');
  const branches = useMemo(() => data?.items ?? [], [data]);
  const selected = stored !== 'all' && branches.some((b) => b.id === stored) ? stored : branches.length === 1 ? branches[0]!.id : 'all';

  const select = useCallback((id: string) => {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* storage blocked: selection lasts for this page */
    }
    listeners.forEach((l) => l());
  }, []);

  const value = useMemo<BranchValue>(
    () => ({
      branches,
      loading,
      selected,
      select,
      scopeIds: selected === 'all' ? branches.map((b) => b.id) : [selected],
      branchParam: selected === 'all' ? undefined : selected,
      reload,
      byId: (id) => branches.find((b) => b.id === id),
    }),
    [branches, loading, selected, select, reload],
  );
  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranches(): BranchValue {
  const v = useContext(BranchContext);
  if (!v) throw new Error('useBranches outside BranchProvider');
  return v;
}
