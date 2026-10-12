'use client';

import { config } from './config';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.split('=')[1] ?? '') : null;
}

async function ensureCsrf(): Promise<string> {
  const fromCookie = readCookie('lt_csrf');
  if (fromCookie) return (csrfToken = fromCookie);
  if (csrfToken) return csrfToken;
  const r = await fetch(`${config.apiUrl}/api/v1/auth/csrf`, { credentials: 'include' });
  const j = (await r.json()) as { csrfToken: string };
  csrfToken = j.csrfToken;
  return csrfToken;
}

export const setCsrfToken = (t: string | undefined) => {
  if (t) csrfToken = t;
};

/** Fired when the session is gone (refresh failed) so the shell can send the user to the login page. */
export const SESSION_EXPIRED_EVENT = 'lt-admin:session-expired';

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** multipart upload; mutually exclusive with body */
  form?: FormData;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/**
 * Dashboard API call. The session lives in httpOnly cookies on the API host; unsafe methods carry the CSRF header.
 * A 401 triggers one silent refresh, then a retry; if that fails the shell is told the session expired.
 */
export async function api<T>(path: string, opts: ApiOptions = {}, retried = false): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET') headers['x-csrf-token'] = await ensureCsrf();
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;

  let r: Response;
  try {
    r = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: opts.form ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', 'No se ha podido conectar con el servidor. Comprueba tu conexión.');
  }

  if (r.status === 401 && !retried && !path.startsWith('/api/v1/auth/login')) {
    const refreshed = await fetch(`${config.apiUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': await ensureCsrf() },
      body: JSON.stringify({ client: 'web' }),
    }).catch(() => null);
    if (refreshed?.ok) {
      setCsrfToken(((await refreshed.json()) as { csrfToken?: string }).csrfToken);
      return api<T>(path, opts, true);
    }
    if (typeof window !== 'undefined' && !path.startsWith('/api/v1/auth/me')) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  const text = await r.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!r.ok) {
    const e = (json as { error?: { code: string; message: string; details?: unknown } } | null)?.error;
    throw new ApiError(r.status, e?.code ?? 'HTTP_ERROR', e?.message ?? `HTTP ${r.status}`, e?.details);
  }
  return json as T;
}

/** Query-string builder that drops empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : '';
}

export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
