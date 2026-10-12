'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Badge, Card, Empty, PageHeader, Pagination, SearchInput, Spinner } from '@/components/ui/kit';
import { qs } from '@/lib/api';
import { errorText, formatDate, formatEur } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

export interface CustomerSummary {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  status: 'active' | 'disabled';
  createdAt: string | null;
  lastLoginAt: string | null;
  marketingConsent: boolean;
  orders: { count: number; totalCents: number; lastAt: string | null };
}

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => (setDebounced(q.trim()), setPage(1)), 300);
    return () => clearTimeout(t);
  }, [q]);
  const r = useResource<{ items: CustomerSummary[]; total: number; page: number; limit: number }>(
    `/api/v1/admin/customers${qs({ q: debounced, status, page, limit: 25 })}`,
  );
  const data = r.data ?? r.stale;
  return (
    <>
      <PageHeader title="Clientes" subtitle="Cuentas registradas en la web y la app. Los pedidos como invitado no crean cuenta." />
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      <Card padded={false}>
        <div className="filters" style={{ padding: '14px 14px 0' }}>
          <SearchInput value={q} onChange={setQ} placeholder="Nombre, correo o teléfono…" />
          <select className="input" aria-label="Estado" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="disabled">Bloqueados</option>
          </select>
        </div>
        {!data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <Empty icon="users" title="No hay clientes con estos filtros" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th className="num">Pedidos</th>
                    <th className="num">Gastado</th>
                    <th>Último pedido</th>
                    <th>Alta</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/customers/${c.id}`}>
                          <strong>{c.name ?? 'Sin nombre'}</strong>
                        </Link>
                        <div className="muted small">{c.email}</div>
                      </td>
                      <td>{c.phone ?? '—'}</td>
                      <td className="num">{c.orders.count}</td>
                      <td className="num">{formatEur(c.orders.totalCents)}</td>
                      <td>{formatDate(c.orders.lastAt)}</td>
                      <td>{formatDate(c.createdAt)}</td>
                      <td>
                        {c.status === 'active' ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Bloqueado</Badge>}
                        {c.marketingConsent ? (
                          <>
                            {' '}
                            <Badge tone="blue">Acepta promociones</Badge>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pageSize={data.limit} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
