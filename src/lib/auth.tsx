'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, SESSION_EXPIRED_EVENT, setCsrfToken } from './api';
import { tr } from './i18n';
import type { Me, Role } from './types';

type Status = 'loading' | 'anonymous' | 'ready';





interface AuthValue {
  status: Status;
  me: Me | null;
  permissions: string[];
  can: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  reload: () => Promise<void>;
}

const STAFF_ROLES: Role[] = ['owner', 'manager', 'staff'];
const fetchMe = () => api<{ user: Me; permissions: string[] }>('/api/v1/auth/me').catch(() => null);
const AuthContext = createContext<AuthValue | null>(null);

/** Session for the dashboard. Only owner/manager/staff accounts may use it; drivers use the driver app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const apply = useCallback((r: { user: Me; permissions: string[] } | null) => {
    if (!r || !STAFF_ROLES.includes(r.user.role)) {
      setMe(null);
      setPermissions([]);
      setStatus('anonymous');
      return;
    }
    setMe(r.user);
    setPermissions(r.permissions ?? []);
    setStatus('ready');
  }, []);
  const reload = useCallback(() => fetchMe().then(apply), [apply]);

  useEffect(() => {
    // Initial session check; state is only set from the promise callback.
    fetchMe().then(apply);
    const expired = () => {
      setMe(null);
      setStatus('anonymous');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }, [apply]);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api<{ user: Me; csrfToken?: string }>('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password, client: 'web' },
      });
      setCsrfToken(r.csrfToken);
      if (!STAFF_ROLES.includes(r.user.role)) {
        await api('/api/v1/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
        throw new ApiError(403, 'NOT_STAFF', tr('Esta cuenta no tiene acceso al panel de gestión.', 'This account does not have access to the admin panel.'));
      }
      await reload();
      return r.user;
    },
    [reload],
  );

  const logout = useCallback(async () => {
    await api('/api/v1/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
    setMe(null);
    setPermissions([]);
    setStatus('anonymous');
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const r = await api<{ csrfToken?: string }>('/api/v1/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword, client: 'web' },
      });
      setCsrfToken(r.csrfToken);
      await reload();
    },
    [reload],
  );

  const value = useMemo<AuthValue>(
    () => ({ status, me, permissions, can: (p) => permissions.includes(p), login, logout, changePassword, reload }),
    [status, me, permissions, login, logout, changePassword, reload],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
