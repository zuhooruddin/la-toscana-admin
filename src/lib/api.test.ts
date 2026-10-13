import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, qs } from './api';
import { errorText, nextStatuses, parseEur } from './format';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Fake API: protected paths answer 401 until a refresh has happened. */
function fakeApi(refreshStatus = 200) {
  const calls: string[] = [];
  let sessionFresh = false;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    calls.push(path);
    if (path === '/api/v1/auth/csrf') return json(200, { csrfToken: 'csrf-1' });
    if (path === '/api/v1/auth/refresh') {
      if (refreshStatus !== 200) return json(refreshStatus, { error: { code: 'SESSION_REUSED', message: 'revoked' } });
      sessionFresh = true;
      return json(200, { csrfToken: 'csrf-2' });
    }
    return sessionFresh ? json(200, { path }) : json(401, { error: { code: 'UNAUTHENTICATED', message: 'expired' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('api client session refresh', () => {
  it('QA BUG-008: parallel 401s share ONE refresh (a second refresh would revoke the whole session)', async () => {
    const calls = fakeApi();
    const results = await Promise.all([
      api<{ path: string }>('/api/v1/admin/orders'),
      api<{ path: string }>('/api/v1/admin/branches'),
      api<{ path: string }>('/api/v1/auth/me'),
    ]);
    expect(results.map((r) => r.path)).toEqual(['/api/v1/admin/orders', '/api/v1/admin/branches', '/api/v1/auth/me']);
    expect(calls.filter((p) => p === '/api/v1/auth/refresh')).toHaveLength(1);
  });

  it('surfaces the 401 when the refresh is rejected', async () => {
    const calls = fakeApi(401);
    await expect(api('/api/v1/admin/orders')).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(calls.filter((p) => p === '/api/v1/auth/refresh')).toHaveLength(1);
  });

  it('turns a network failure into a NETWORK ApiError and a non-JSON body into an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(api('/api/v1/admin/orders')).rejects.toMatchObject({ code: 'NETWORK' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })));
    const e = await api('/api/v1/admin/orders').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 502, code: 'HTTP_ERROR' });
  });

  it('builds query strings without empty values', () => {
    expect(qs({ branchId: 'b1', status: '', page: 2, active: null })).toBe('?branchId=b1&page=2');
    expect(qs({})).toBe('');
  });
});

describe('dashboard formatting and rules', () => {
  it('parses euro amounts typed by staff', () => {
    expect(parseEur('12,50')).toBe(1250);
    expect(parseEur(' 3.5 €')).toBe(350);
    expect(parseEur('0')).toBe(0);
    for (const bad of ['', '-1', '1,234', 'abc', '12,5,0']) expect(parseEur(bad)).toBeNull();
  });

  it('offers only the transitions the API accepts', () => {
    expect(nextStatuses('confirmed', 'pickup')).toEqual(['preparing']);
    expect(nextStatuses('ready', 'pickup')).toEqual(['picked_up']);
    expect(nextStatuses('ready', 'delivery')).toEqual(['out_for_delivery']);
    expect(nextStatuses('out_for_delivery', 'delivery')).toEqual(['delivered']);
    for (const s of ['pending_payment', 'picked_up', 'delivered', 'cancelled', 'refunded']) expect(nextStatuses(s, 'delivery')).toEqual([]);
  });

  it('explains API errors in Spanish, including readiness gaps and field errors', () => {
    expect(errorText({ code: 'BRANCH_FORBIDDEN' })).toBe('No tienes acceso a este restaurante.');
    expect(errorText({ code: 'ORDERING_NOT_READY', details: { missing: ['OPENING_HOURS', 'DELIVERY_ZONES'] } })).toBe(
      'Faltan datos para activar los pedidos online. (horario de apertura, zonas de reparto)',
    );
    expect(errorText({ code: 'X', details: [{ path: 'body.name', message: 'Required' }] })).toBe('Revisa: name Required');
    expect(errorText({ code: 'UNKNOWN', message: 'Algo' })).toBe('Algo');
  });
});
