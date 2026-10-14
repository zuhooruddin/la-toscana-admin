'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { orderingBadge, PauseControl } from '@/components/BranchStatus';
import { Icon } from '@/components/ui/Icon';
import { Alert, Badge, Card, Empty, Spinner, Stat } from '@/components/ui/kit';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { errorText, formatEur, formatTime, STATUS_LABEL, STATUS_TONE, todayLocal } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import type { AdminOrder, AnalyticsSummary } from '@/lib/types';
import { useResource } from '@/lib/use-resource';
import { useLang, useT } from '@/lib/i18n';
import './dashboard.css';

function BranchMetrics({ branchId }: { branchId: string }) {
  const t = useT();
  const r = useResource<AnalyticsSummary>(`/api/v1/admin/analytics/summary${qs({ branchId })}`, { refreshMs: 60_000 });
  return (
    <div className="branch-metrics" title={r.error ? errorText(r.error) : undefined}>
      <div>
        <strong>{r.data?.orders ?? '—'}</strong>
        <small>{t('Pedidos', 'Orders')}</small>
      </div>
      <div>
        <strong>{r.data ? formatEur(r.data.netCents) : '—'}</strong>
        <small>{t('Ventas', 'Sales')}</small>
      </div>
    </div>
  );
}

function SalesChart({ branchId, allowed, revision }: { branchId?: string; allowed: boolean; revision: string }) {
  const t = useT();
  const { lang } = useLang();
  const [days, setDays] = useState(7);
  const [result, setResult] = useState<{ key: string; items: { day: string; summary: AnalyticsSummary }[]; error?: unknown } | null>(null);
  const key = `${branchId ?? 'all'}:${days}:${todayLocal()}:${revision}`;
  useEffect(() => {
    if (!allowed) return;
    const ctrl = new AbortController();
    const dates = Array.from({ length: days }, (_, index) => todayLocal(index - days + 1));
    Promise.all(
      dates.map(async (day) => ({
        day,
        summary: await api<AnalyticsSummary>(`/api/v1/admin/analytics/summary${qs({ branchId, from: day, to: day })}`, { signal: ctrl.signal }),
      })),
    ).then(
      (items) => {
        if (!ctrl.signal.aborted) setResult({ key, items });
      },
      (error: unknown) => {
        if (!ctrl.signal.aborted) setResult({ key, items: [], error });
      },
    );
    return () => ctrl.abort();
  }, [branchId, days, key, allowed]);
  const items = result?.key === key ? result.items : [];
  const maxSales = Math.max(100, ...items.map((i) => i.summary.netCents));
  const maxOrders = Math.max(1, ...items.map((i) => i.summary.orders));
  return (
    <Card
      title={
        <>
          <span>{t('Resumen de ventas', 'Sales overview')}</span>
          <small className="card-subtitle">{t('Ventas y pedidos a lo largo del tiempo', 'Total sales and orders over time')}</small>
        </>
      }
      actions={
        allowed ? (
          <select
            className="input chart-range"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label={t('Periodo de ventas', 'Sales period')}
          >
            <option value={7}>{t('Últimos 7 días', 'Last 7 days')}</option>
            <option value={14}>{t('Últimos 14 días', 'Last 14 days')}</option>
          </select>
        ) : undefined
      }
      className="sales-card"
    >
      {!allowed ? (
        <Empty icon="shield" title={t('Informes disponibles para responsables', 'Reports available to managers')} />
      ) : result?.key === key && result.error ? (
        <Alert tone="danger">{errorText(result.error)}</Alert>
      ) : !items.length ? (
        <Spinner />
      ) : (
        <>
          <div className="sales-legend">
            <span>
              <i />
              {t('Ventas (€)', 'Sales (€)')}
            </span>
            <span>
              <i />
              {t('Pedidos (escala derecha)', 'Orders (right scale)')}
            </span>
          </div>
          <div className="sales-plot">
            <div className="sales-axis">
              {[1, 0.75, 0.5, 0.25, 0].map((n) => (
                <span key={n}>{formatEur(Math.round(maxSales * n))}</span>
              ))}
            </div>
            <div className="sales-bars">
              {items.map(({ day, summary }) => (
                <div className="sales-day" key={day} title={`${day}: ${formatEur(summary.netCents)}, ${summary.orders} ${t('pedidos', 'orders')}`}>
                  <div className="bar-pair">
                    <span style={{ height: `${(Math.max(0, summary.netCents) / maxSales) * 100}%` }} />
                    <span style={{ height: `${(summary.orders / maxOrders) * 100}%` }} />
                  </div>
                  <small>
                    {new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', { month: 'short', day: 'numeric', timeZone: 'Europe/Madrid' }).format(
                      new Date(`${day}T12:00:00Z`),
                    )}
                  </small>
                </div>
              ))}
            </div>
            <div className="sales-axis right-axis">
              {[1, 0.75, 0.5, 0.25, 0].map((n) => (
                <span key={n}>{Math.round(maxOrders * n)}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function Distribution({ title, entries, total }: { title: string; entries: { label: string; count: number; color: string }[]; total: number }) {
  const t = useT();
  const sum = entries.reduce((n, e) => n + e.count, 0);
  let position = 0;
  const stops = entries.map((e) => {
    const start = position;
    position += sum ? (e.count / sum) * 100 : 0;
    return `${e.color} ${start}% ${position}%`;
  });
  return (
    <Card title={title} className="distribution-card">
      <div className="distribution-body">
        <div
          className="donut"
          role="img"
          aria-label={entries.map((e) => `${e.label}: ${e.count}`).join(', ')}
          style={{ background: sum ? `conic-gradient(${stops.join(',')})` : 'var(--border)' }}
        >
          <div>
            <strong>{total}</strong>
            <small>{t('Pedidos', 'Orders')}</small>
          </div>
        </div>
        <div className="chart-key">
          {entries.map((e) => (
            <div key={e.label}>
              <i style={{ background: e.color }} />
              <span>{e.label}</span>
              <strong>{e.count}</strong>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const t = useT();
  const { lang } = useLang();
  const { me, can } = useAuth();
  const { branches, branchParam, byId, reload: reloadBranches, loading: branchesLoading } = useBranches();
  const summary = useResource<AnalyticsSummary>(`/api/v1/admin/analytics/summary${qs({ branchId: branchParam })}`, { refreshMs: 60_000 });
  const previous = useResource<AnalyticsSummary>(
    can('analytics:read') ? `/api/v1/admin/analytics/summary${qs({ branchId: branchParam, from: todayLocal(-1), to: todayLocal(-1) })}` : null,
  );
  const active = useResource<{ items: AdminOrder[]; total: number }>(
    can('orders:read') ? `/api/v1/admin/orders${qs({ active: 'true', branchId: branchParam, pageSize: 50 })}` : null,
    { refreshMs: 60_000 },
  );
  const recent = useResource<{ items: AdminOrder[] }>(can('orders:read') ? `/api/v1/admin/orders${qs({ branchId: branchParam, pageSize: 5 })}` : null, {
    refreshMs: 60_000,
  });
  const customers = useResource<{ total: number }>(can('customers:read') ? '/api/v1/admin/customers?limit=1' : null, { refreshMs: 60_000 });
  useRealtimeEvent(
    (e) => e.startsWith('order.'),
    () => {
      active.reload();
      recent.reload();
      summary.reload();
    },
  );
  useRealtimeEvent((e) => e === 'branch.ordering_changed', reloadBranches);
  const s = summary.data;
  const visibleBranches = branchParam ? branches.filter((b) => b.id === branchParam) : branches;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/Madrid' }).format(new Date()));
  const greeting = hour < 14 ? t('Buenos días', 'Good morning') : hour < 21 ? t('Buenas tardes', 'Good afternoon') : t('Buenas noches', 'Good evening');
  const comparison = (value?: number, old?: number) =>
    value === undefined || old === undefined || !old ? undefined : (
      <>
        <span className={`change ${value < old ? 'change-down' : ''}`}>
          {value >= old ? '↑ +' : '↓ '}
          {Math.round(((value - old) / old) * 100)}%
        </span>
        <span className="comparison-label">{t('vs. ayer', 'vs yesterday')}</span>
      </>
    );
  const counts = s?.byStatus ?? {};
  const delivery = s ? Math.round(s.orders * s.deliveryShare) : 0;
  const viewAll = (href: string) => (
    <Link className="btn btn-secondary btn-sm dashboard-view" href={href}>
      {t('Ver todo', 'View all')}
    </Link>
  );
  return (
    <div className="dashboard">
      <header className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">{t('Panel', 'Dashboard')}</p>
          <h1>
            {greeting}
            {me?.name ? `, ${me.name.split(' ')[0]}` : ''} <span aria-hidden="true">👋</span>
          </h1>
          <p className="muted">{t('Esto es lo que sucede hoy en tus restaurantes.', "Here's what's happening at your restaurants today.")}</p>
        </div>
        <div className="dashboard-date">
          <Icon name="calendar" size={20} />
          <div>
            <strong>{t('Hoy', 'Today')}</strong>
            <small>
              {new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'Europe/Madrid',
              }).format(new Date())}
            </small>
          </div>
        </div>
      </header>
      {summary.error ? <Alert tone="danger">{errorText(summary.error)}</Alert> : null}
      <div className="grid-4 dashboard-stats">
        <Stat icon="bag" tone="red" label={t('Pedidos hoy', 'Orders today')} value={s?.orders ?? '—'} hint={comparison(s?.orders, previous.data?.orders)} />
        <Stat
          icon="euro"
          tone="green"
          label={t('Ventas hoy (IVA incl.)', 'Sales today (VAT incl.)')}
          value={s ? formatEur(s.netCents) : '—'}
          hint={comparison(s?.netCents, previous.data?.netCents)}
        />
        <Stat
          icon="tag"
          tone="amber"
          label={t('Ticket medio', 'Average ticket')}
          value={s ? formatEur(s.averageTicketCents) : '—'}
          hint={comparison(s?.averageTicketCents, previous.data?.averageTicketCents)}
        />
        <Stat
          icon="clock"
          tone="blue"
          label={t('Pedidos en curso', 'Active orders')}
          value={active.data ? active.data.total : '—'}
          hint={active.error ? errorText(active.error) : t('En preparación y reparto', 'In progress')}
        />
      </div>
      {s && s.simulatedCents > 0 ? (
        <Alert tone="warning">
          {formatEur(s.simulatedCents)}{' '}
          {t('son pagos simulados (modo de pruebas). No es dinero real.', 'are simulated payments (test mode). This is not real money.')}
        </Alert>
      ) : null}
      <div className="dashboard-panels">
        <SalesChart branchId={branchParam} allowed={can('analytics:read')} revision={`${s?.orders ?? ''}:${s?.netCents ?? ''}`} />
        <Card title={t('Restaurantes', 'Restaurants')} actions={can('branch:read') ? viewAll('/restaurants') : undefined} className="restaurants-card">
          {branchesLoading ? (
            <Spinner />
          ) : visibleBranches.length ? (
            visibleBranches.map((b) => (
              <div className="restaurant-row" key={b.id}>
                <span className="restaurant-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {b.imageUrl ? <img src={b.imageUrl} alt="" /> : <Icon name="store" size={26} />}
                </span>
                <div className="restaurant-name">
                  {can('branch:read') ? <Link href={`/restaurants/${b.id}`}>{b.name}</Link> : <strong>{b.name}</strong>}
                  <div>{orderingBadge(b)}</div>
                </div>
                <BranchMetrics branchId={b.id} />
                <PauseControl branch={b} onChanged={reloadBranches} />
              </div>
            ))
          ) : (
            <Empty icon="store" title={t('Sin restaurantes', 'No restaurants')} />
          )}
        </Card>
        <Card
          title={
            <>
              <span>{t('Pedidos recientes', 'Recent orders')}</span>
              <small className="card-subtitle">{t('Últimos pedidos de tus restaurantes', 'Latest orders across your restaurants')}</small>
            </>
          }
          actions={
            can('orders:read') ? (
              <Link href="/orders" className="btn btn-secondary btn-sm">
                {t('Ver todos los pedidos', 'View all orders')}
              </Link>
            ) : undefined
          }
          className="recent-card"
          padded={false}
        >
          {recent.error ? (
            <Alert tone="danger">{errorText(recent.error)}</Alert>
          ) : recent.loading ? (
            <Spinner />
          ) : !can('orders:read') ? (
            <Empty icon="shield" title={t('Sin acceso a pedidos', 'Order access unavailable')} />
          ) : !recent.data?.items.length ? (
            <Empty icon="orders" title={t('Todavía no hay pedidos', 'No orders yet')} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {[
                      '#',
                      t('Cliente', 'Customer'),
                      t('Restaurante', 'Restaurant'),
                      t('Tipo', 'Type'),
                      t('Total', 'Total'),
                      t('Estado', 'Status'),
                      t('Hora', 'Time'),
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.data.items.slice(0, 5).map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/orders/${o.id}`}>
                          <strong>{o.number}</strong>
                        </Link>
                      </td>
                      <td>
                        <span className="customer-cell">
                          <Icon name="user" size={14} />
                          {o.customer?.name ?? '—'}
                        </span>
                      </td>
                      <td>{byId(o.branchId)?.name ?? o.branchName ?? '—'}</td>
                      <td>
                        <Badge tone={o.fulfilment.type === 'delivery' ? 'red' : 'blue'}>
                          {o.fulfilment.type === 'delivery' ? t('Reparto', 'Delivery') : t('Recogida', 'Pickup')}
                        </Badge>
                      </td>
                      <td className="mono">{formatEur(o.totals.totalCents)}</td>
                      <td>
                        <Badge tone={STATUS_TONE[o.status]} dot>
                          {STATUS_LABEL[o.status]}
                        </Badge>
                      </td>
                      <td>{formatTime(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card
          title={t('Productos más vendidos hoy', 'Top selling products today')}
          actions={can('analytics:read') ? viewAll('/reports') : undefined}
          className="products-card"
        >
          {!s ? (
            summary.error ? (
              <p className="muted">{t('Datos no disponibles', 'Data unavailable')}</p>
            ) : (
              <Spinner />
            )
          ) : !s.topItems.length ? (
            <Empty icon="menu" title={t('Todavía no hay ventas hoy', 'No sales yet today')} />
          ) : (
            <div className="product-list">
              {s.topItems.slice(0, 5).map((item, index) => (
                <div className="product-row" key={item.name}>
                  <span className="product-rank">{index + 1}</span>
                  <span className="product-icon">
                    <Icon name="menu" size={24} />
                  </span>
                  <div className="product-detail">
                    <div>
                      <strong>{item.name}</strong>
                      <span>{formatEur(item.revenueCents)}</span>
                    </div>
                    <div className="bar">
                      <span style={{ width: `${(item.quantity / Math.max(1, s.topItems[0].quantity)) * 100}%` }} />
                    </div>
                    <small className="muted">
                      {item.quantity} {t('vendidos', 'sold')}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      {s ? (
        <div className="dashboard-bottom">
          <Distribution
            title={t('Estado de pedidos', 'Order status')}
            total={Object.values(counts).reduce((a, b) => a + b, 0)}
            entries={[
              { label: t('Preparando', 'Preparing'), count: (counts.preparing ?? 0) + (counts.ready ?? 0), color: '#ff2635' },
              { label: t('Confirmado', 'Confirmed'), count: counts.confirmed ?? 0, color: '#ff9800' },
              { label: t('En camino', 'On the way'), count: counts.out_for_delivery ?? 0, color: '#4696ff' },
              { label: t('Completado', 'Completed'), count: (counts.delivered ?? 0) + (counts.picked_up ?? 0), color: '#30bf55' },
              { label: t('Cancelado / reembolsado', 'Cancelled / refunded'), count: (counts.cancelled ?? 0) + (counts.refunded ?? 0), color: '#969ba5' },
            ]}
          />
          <Distribution
            title={t('Tipo de pedido', 'Order type')}
            total={s.orders}
            entries={[
              { label: t('Reparto', 'Delivery'), count: delivery, color: '#ff2635' },
              { label: t('Recogida', 'Pickup'), count: s.orders - delivery, color: '#4696ff' },
            ]}
          />
          {can('customers:read') ? (
            <Stat
              icon="users"
              tone="blue"
              label={t('Clientes', 'Customers')}
              value={customers.data?.total ?? '—'}
              hint={customers.error ? errorText(customers.error) : t('Cuentas registradas', 'Registered accounts')}
            />
          ) : null}
          <Stat
            icon="store"
            tone="green"
            label={t('Restaurantes activos', 'Accepting orders')}
            value={
              visibleBranches.filter(
                (b) => b.ordering.enabled && (!b.ordering.paused || (b.ordering.pausedUntil && new Date(b.ordering.pausedUntil) <= new Date())),
              ).length
            }
            hint={t('Disponibles para nuevos pedidos', 'Ready for new orders')}
          />
        </div>
      ) : null}
    </div>
  );
}
