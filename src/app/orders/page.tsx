'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert, Badge, Button, Card, Empty, PageHeader, Pagination, Spinner, Tabs } from '@/components/ui/kit';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useFeedback } from '@/components/ui/feedback';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import {
  ACTION_LABEL,
  errorText,
  formatDateTime,
  formatEur,
  formatTime,
  minutesAgo,
  nextStatuses,
  PAYMENT_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  todayLocal,
} from '@/lib/format';
import { useRealtime, useRealtimeEvent } from '@/lib/realtime';
import type { AdminOrder, AnalyticsSummary } from '@/lib/types';
import { useResource } from '@/lib/use-resource';
import { useT } from '@/lib/i18n';
import './orders.css';

const COLUMNS: { status: string; title: [string, string] }[] = [
  { status: 'confirmed', title: ['Nuevos', 'New'] },
  { status: 'preparing', title: ['En preparación', 'Preparing'] },
  { status: 'ready', title: ['Listos', 'Ready'] },
  { status: 'out_for_delivery', title: ['En reparto', 'Out for delivery'] },
];

function Board({ search, sort, type, payment }: { search: string; sort: string; type: string; payment: string }) {
  const t = useT();
  const { can } = useAuth();
  const { branchParam, byId, branches } = useBranches();
  const { unseen, markSeen } = useRealtime();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  const r = useResource<{ items: AdminOrder[]; total: number }>(`/api/v1/admin/orders${qs({ active: 'true', branchId: branchParam, pageSize: 100 })}`, {
    refreshMs: 30_000,
  });
  useRealtimeEvent((e) => e.startsWith('order.'), r.reload);

  async function advance(o: AdminOrder, to: string) {
    setBusy(o.id);
    try {
      await api(`/api/v1/admin/orders/${o.id}/status`, { method: 'POST', body: { status: to } });
      markSeen(o.id);
      toast(`${o.number}: ${STATUS_LABEL[to]}`);
      r.reload();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  if (r.loading) return <Spinner />;
  if (r.error) return <Alert tone="danger">{errorText(r.error)}</Alert>;
  const orders = (r.data ?? r.stale)?.items ?? [];
  // Oldest first inside each column: what came in first is cooked first.
  const query = search.trim().toLocaleLowerCase();
  const sorted = orders
    .filter(
      (o) =>
        (!type || o.fulfilment.type === type) &&
        (!payment || o.payment.method === payment) &&
        (!query || [o.number, o.customer?.name, ...o.lines.map((line) => line.name)].some((value) => value?.toLocaleLowerCase().includes(query))),
    )
    .sort((a, b) => (sort === 'newest' ? -1 : 1) * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  return (
    <>
      {r.data && r.data.total > orders.length ? (
        <Alert tone="warning">
          {t(
            'Se muestran los 100 pedidos más recientes. Consulta el historial para ver todos.',
            'Showing the latest 100 active orders. Use History to see all orders.',
          )}
        </Alert>
      ) : null}
      <div className="board">
        {COLUMNS.map((c) => {
          const list = sorted.filter((o) => o.status === c.status);
          return (
            <section key={c.status} className={`board-col column-${c.status}`} aria-labelledby={`col-${c.status}`}>
              <header className="board-col-head">
                <span id={`col-${c.status}`} className="column-title">
                  <Icon name={c.status === 'confirmed' ? 'clock' : c.status === 'preparing' ? 'menu' : c.status === 'ready' ? 'bag' : 'truck'} size={22} />
                  {t(...c.title)}
                </span>
                <Badge tone={STATUS_TONE[c.status]}>{list.length}</Badge>
              </header>
              <div className="board-col-body">
                {list.length === 0 ? (
                  <p className="muted small" style={{ padding: 8 }}>
                    {t('Sin pedidos', 'No orders')}
                  </p>
                ) : null}
                {list.map((o) => {
                  const next = nextStatuses(o.status, o.fulfilment.type);
                  return (
                    <article key={o.id} className="ticket" data-new={unseen.includes(o.id)}>
                      <div className="ticket-head">
                        <Link href={`/orders/${o.id}`} className="ticket-number">
                          <strong>{o.number}</strong>
                        </Link>
                        <span className="muted small">
                          {o.fulfilment.scheduledFor ? `⏰ ${formatTime(o.fulfilment.scheduledFor)}` : minutesAgo(o.createdAt)}
                        </span>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <Badge tone={o.fulfilment.type === 'delivery' ? 'violet' : 'blue'}>
                          {o.fulfilment.type === 'delivery' ? t('Reparto', 'Delivery') : t('Recogida', 'Pickup')}
                        </Badge>
                        <Badge tone={o.payment.status === 'paid' ? 'green' : 'amber'}>
                          {o.payment.method === 'cash' ? t('Efectivo', 'Cash') : t('Tarjeta', 'Card')} · {PAYMENT_LABEL[o.payment.status] ?? o.payment.status}
                        </Badge>
                        {branches.length > 1 ? (
                          <Badge tone="grey">
                            <Icon name="pin" size={12} />
                            {byId(o.branchId)?.name.replace('La Toscana ', '') ?? o.branchName}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="ticket-dishes">
                        <Link href={`/orders/${o.id}`} className="dish-photo" aria-label={t(`Ver pedido ${o.number}`, `View order ${o.number}`)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {o.lines.find((line) => line.imageUrl)?.imageUrl ? (
                            <img src={o.lines.find((line) => line.imageUrl)!.imageUrl!} alt={o.lines.find((line) => line.imageUrl)!.name} />
                          ) : (
                            <Icon name="menu" size={28} />
                          )}
                        </Link>
                        <div className="ticket-lines">
                          {o.lines.slice(0, 4).map((l, i) => (
                            <span key={i}>
                              {l.quantity}× {l.name}
                              {l.options.length ? ` (${l.options.map((x) => x.choiceName).join(', ')})` : ''}
                            </span>
                          ))}
                          {o.lines.length > 4 ? (
                            <span>
                              +{o.lines.length - 4} {t('más…', 'more…')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {o.notes ? (
                        <p className="small" style={{ color: 'var(--amber)' }}>
                          📝 {o.notes}
                        </p>
                      ) : null}
                      <div className="row-between">
                        <div>
                          <strong className="mono ticket-total">{formatEur(o.totals.totalCents)}</strong>
                          {o.payment.simulated ? (
                            <small className="simulated-order">
                              <Icon name="info" size={12} />
                              {t('Pago simulado', 'Simulated payment')}
                            </small>
                          ) : null}
                        </div>
                        {can('orders:update') && next[0] ? (
                          <Button
                            size="sm"
                            variant="primary"
                            loading={busy === o.id}
                            disabled={busy !== null}
                            icon={c.status === 'confirmed' ? 'menu' : c.status === 'preparing' ? 'check' : c.status === 'ready' ? 'truck' : 'check'}
                            onClick={(e) => {
                              e.stopPropagation();
                              void advance(o, next[0]!);
                            }}
                          >
                            {ACTION_LABEL[next[0]!]}
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function History() {
  const { branchParam, byId } = useBranches();
  const t = useT();
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(todayLocal(-6));
  const [to, setTo] = useState(todayLocal());
  const [page, setPage] = useState(1);
  const toIso = (d: string, end = false) => (d ? new Date(`${d}T${end ? '23:59:59' : '00:00:00'}`).toISOString() : undefined);
  const r = useResource<{ items: AdminOrder[]; total: number; page: number; pageSize: number }>(
    `/api/v1/admin/orders${qs({ branchId: branchParam, status: status || undefined, from: toIso(from), to: toIso(to, true), page, pageSize: 25 })}`,
  );
  useRealtimeEvent((e) => e.startsWith('order.'), r.reload);
  const data = r.data ?? r.stale;
  return (
    <Card padded={false}>
      <div className="filters" style={{ padding: '14px 14px 0' }}>
        <select className="input" aria-label={t('Estado', 'Status')} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
          <option value="">{t('Todos los estados', 'All statuses')}</option>
          {['confirmed', 'preparing', 'ready', 'out_for_delivery', 'picked_up', 'delivered', 'cancelled', 'refunded', 'pending_payment'].map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="row small">
          {t('Desde', 'From')} <input className="input" type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} />
        </label>
        <label className="row small">
          {t('Hasta', 'To')} <input className="input" type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} />
        </label>
      </div>
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      {!data && r.error ? (
        <Empty icon="alert" title={t('No se pueden cargar los pedidos', 'Unable to load orders')} />
      ) : !data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty icon="orders" title={t('No hay pedidos con estos filtros', 'No orders match these filters')} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Pedido', 'Order')}</th>
                  <th>{t('Fecha', 'Date')}</th>
                  <th>{t('Cliente', 'Customer')}</th>
                  <th>{t('Restaurante', 'Restaurant')}</th>
                  <th>{t('Tipo', 'Type')}</th>
                  <th>{t('Pago', 'Payment')}</th>
                  <th>{t('Estado', 'Status')}</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/orders/${o.id}`}>
                        <strong>{o.number}</strong>
                      </Link>
                    </td>
                    <td className="mono">{formatDateTime(o.createdAt)}</td>
                    <td>{o.customer?.name ?? '—'}</td>
                    <td>{byId(o.branchId)?.name ?? o.branchName}</td>
                    <td>{o.fulfilment.type === 'delivery' ? t('Reparto', 'Delivery') : t('Recogida', 'Pickup')}</td>
                    <td>
                      {o.payment.method === 'cash' ? t('Efectivo', 'Cash') : t('Tarjeta', 'Card')}
                      {o.payment.simulated ? (
                        <>
                          {' '}
                          <Badge tone="amber">{t('Simulado', 'Simulated')}</Badge>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    </td>
                    <td className="num">{formatEur(o.totals.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </Card>
  );
}

export default function OrdersPage() {
  const t = useT();
  const { can } = useAuth();
  const { branchParam } = useBranches();
  const [tab, setTab] = useState<'board' | 'history'>('board');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [type, setType] = useState('');
  const [payment, setPayment] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const summary = useResource<AnalyticsSummary>(`/api/v1/admin/analytics/summary${qs({ branchId: branchParam })}`, { refreshMs: 30_000 });
  const yesterday = useResource<AnalyticsSummary>(
    can('analytics:read') ? `/api/v1/admin/analytics/summary${qs({ branchId: branchParam, from: todayLocal(-1), to: todayLocal(-1) })}` : null,
  );
  useRealtimeEvent((event) => event.startsWith('order.'), summary.reload);
  const s = summary.data;
  const stats: { label: string; icon: IconName; color: string; count?: number }[] = [
    {
      label: t('Total de pedidos', 'Total orders'),
      icon: 'orders',
      color: 'red',
      count: s ? Object.values(s.byStatus).reduce((total, count) => total + count, 0) : undefined,
    },
    { label: t('Nuevos', 'New'), icon: 'orders', color: 'red', count: s?.byStatus.confirmed ?? (s ? 0 : undefined) },
    { label: t('Preparando', 'Preparing'), icon: 'menu', color: 'amber', count: s?.byStatus.preparing ?? (s ? 0 : undefined) },
    { label: t('Listos', 'Ready'), icon: 'bag', color: 'green', count: s?.byStatus.ready ?? (s ? 0 : undefined) },
    { label: t('En reparto', 'Out for delivery'), icon: 'truck', color: 'blue', count: s?.byStatus.out_for_delivery ?? (s ? 0 : undefined) },
    { label: t('Entregados', 'Delivered'), icon: 'check', color: 'violet', count: s ? (s.byStatus.delivered ?? 0) + (s.byStatus.picked_up ?? 0) : undefined },
  ];
  const previousTotal = yesterday.data ? Object.values(yesterday.data.byStatus).reduce((total, count) => total + count, 0) : 0;
  return (
    <div className="orders-page">
      <PageHeader
        title={t('Pedidos', 'Orders')}
        subtitle={t('Los pedidos nuevos llegan en directo desde la web y la app.', 'New orders arrive live from the website and app.')}
        actions={
          <>
            <div className="orders-today">
              <Icon name="calendar" size={20} />
              <div>
                <strong>{t('Hoy', 'Today')}</strong>
                <small>{todayLocal()}</small>
              </div>
            </div>
            <Button icon="toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
              {t('Filtros', 'Filters')}
              {type || payment ? ' •' : ''}
            </Button>
          </>
        }
      />
      {summary.error ? <Alert tone="danger">{errorText(summary.error)}</Alert> : null}
      <div className="order-stats">
        {stats.map((stat, index) => (
          <section key={stat.label} className={`order-stat order-stat-${stat.color}`}>
            <span className="order-stat-icon">
              <Icon name={stat.icon} size={25} />
            </span>
            <div>
              <p>{stat.label}</p>
              <strong>{stat.count ?? '—'}</strong>
              {index === 0 ? (
                <small>
                  {previousTotal && stat.count !== undefined
                    ? `${stat.count >= previousTotal ? '↑ +' : '↓ '}${Math.round(((stat.count - previousTotal) / previousTotal) * 100)}% ${t('vs. ayer', 'vs yesterday')}`
                    : t('Pedidos de hoy', 'Orders today')}
                </small>
              ) : (
                <div className="order-stat-bar">
                  <span style={{ width: `${stat.count && stats[0].count ? Math.min(100, (stat.count / stats[0].count) * 100) : 0}%` }} />
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
      {filtersOpen ? (
        <div className="filters order-filters">
          <label>
            {t('Tipo', 'Type')}
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{t('Todos', 'All')}</option>
              <option value="pickup">{t('Recogida', 'Pickup')}</option>
              <option value="delivery">{t('Reparto', 'Delivery')}</option>
            </select>
          </label>
          <label>
            {t('Pago', 'Payment')}
            <select className="input" value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="">{t('Todos', 'All')}</option>
              <option value="cash">{t('Efectivo', 'Cash')}</option>
              <option value="card">{t('Tarjeta', 'Card')}</option>
            </select>
          </label>
          <Button
            onClick={() => {
              setType('');
              setPayment('');
              setSearch('');
            }}
          >
            {t('Restablecer', 'Reset')}
          </Button>
          <small className="muted">{t('Filtros para cocina. El historial tiene sus propios filtros.', 'Kitchen filters. History has its own filters.')}</small>
        </div>
      ) : null}
      <div className="orders-toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'board', label: t('Cocina (en curso)', 'Kitchen (active)') },
            { value: 'history', label: t('Historial', 'History') },
          ]}
        />
        {tab === 'board' ? (
          <div className="orders-search-sort">
            <label className="orders-search">
              <Icon name="search" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Buscar número de pedido, cliente, producto…', 'Search order number, customer, item…')}
                aria-label={t('Buscar pedidos activos', 'Search active orders')}
              />
            </label>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('Ordenar pedidos', 'Sort orders')}>
              <option value="newest">{t('Más recientes primero', 'Newest first')}</option>
              <option value="oldest">{t('Más antiguos primero', 'Oldest first')}</option>
            </select>
          </div>
        ) : null}
      </div>
      {tab === 'board' ? <Board search={search} sort={sort} type={type} payment={payment} /> : <History />}
    </div>
  );
}
