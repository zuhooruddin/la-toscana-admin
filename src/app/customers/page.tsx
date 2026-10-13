'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Badge, Card, Empty, PageHeader, Pagination, SearchInput, Spinner } from '@/components/ui/kit';
import { qs } from '@/lib/api';
import { errorText, formatDate, formatEur } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { useT } from '@/lib/i18n';

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
  const tt = useT();
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
      <PageHeader
        title={tt('Clientes', 'Customers')}
        subtitle={tt(
          'Cuentas registradas en la web y la app. Los pedidos como invitado no crean cuenta.',
          'Accounts registered on the website and app. Guest orders do not create an account.',
        )}
      />
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      <Card padded={false}>
        <div className="filters" style={{ padding: '14px 14px 0' }}>
          <SearchInput value={q} onChange={setQ} placeholder={tt('Nombre, correo o teléfono…', 'Name, email or phone…')} />
          <select className="input" aria-label={tt('Estado', 'Status')} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
            <option value="">{tt('Todos', 'All')}</option>
            <option value="active">{tt('Activos', 'Active')}</option>
            <option value="disabled">{tt('Bloqueados', 'Blocked')}</option>
          </select>
        </div>
        {!data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <Empty icon="users" title={tt('No hay clientes con estos filtros', 'No customers match these filters')} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{tt('Cliente', 'Customer')}</th>
                    <th>{tt('Teléfono', 'Phone')}</th>
                    <th className="num">{tt('Pedidos', 'Orders')}</th>
                    <th className="num">{tt('Gastado', 'Spent')}</th>
                    <th>{tt('Último pedido', 'Last order')}</th>
                    <th>{tt('Alta', 'Joined')}</th>
                    <th>{tt('Estado', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/customers/${c.id}`}>
                          <strong>{c.name ?? tt('Sin nombre', 'No name')}</strong>
                        </Link>
                        <div className="muted small">{c.email}</div>
                      </td>
                      <td>{c.phone ?? '—'}</td>
                      <td className="num">{c.orders.count}</td>
                      <td className="num">{formatEur(c.orders.totalCents)}</td>
                      <td>{formatDate(c.orders.lastAt)}</td>
                      <td>{formatDate(c.createdAt)}</td>
                      <td>
                        {c.status === 'active' ? <Badge tone="green">{tt('Activo', 'Active')}</Badge> : <Badge tone="red">{tt('Bloqueado', 'Blocked')}</Badge>}
                        {c.marketingConsent ? (
                          <>
                            {' '}
                            <Badge tone="blue">{tt('Acepta promociones', 'Accepts promotions')}</Badge>
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
