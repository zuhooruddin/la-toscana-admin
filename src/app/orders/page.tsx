'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Button, Card, Empty, PageHeader, Pagination, Spinner, Tabs } from '@/components/ui/kit';
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
import type { AdminOrder } from '@/lib/types';
import { useResource } from '@/lib/use-resource';

const COLUMNS: { status: string; title: string }[] = [
  { status: 'confirmed', title: 'Nuevos' },
  { status: 'preparing', title: 'En preparación' },
  { status: 'ready', title: 'Listos' },
  { status: 'out_for_delivery', title: 'En reparto' },
];

function Board() {
  const router = useRouter();
  const { can } = useAuth();
  const { branchParam, byId, branches } = useBranches();
  const { unseen, markSeen } = useRealtime();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  const r = useResource<{ items: AdminOrder[] }>(`/api/v1/admin/orders${qs({ active: 'true', branchId: branchParam, pageSize: 100 })}`, { refreshMs: 30_000 });
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
  const orders = (r.data ?? r.stale)?.items ?? [];
  // Oldest first inside each column: what came in first is cooked first.
  const sorted = [...orders].sort(
    (a, b) => new Date(a.fulfilment.scheduledFor ?? a.createdAt).getTime() - new Date(b.fulfilment.scheduledFor ?? b.createdAt).getTime(),
  );
  return (
    <div className="board">
      {COLUMNS.map((c) => {
        const list = sorted.filter((o) => o.status === c.status);
        return (
          <section key={c.status} className="board-col" aria-labelledby={`col-${c.status}`}>
            <header className="board-col-head">
              <span id={`col-${c.status}`}>{c.title}</span>
              <Badge tone={STATUS_TONE[c.status]}>{list.length}</Badge>
            </header>
            <div className="board-col-body">
              {list.length === 0 ? (
                <p className="muted small" style={{ padding: 8 }}>
                  Sin pedidos
                </p>
              ) : null}
              {list.map((o) => {
                const next = nextStatuses(o.status, o.fulfilment.type);
                return (
                  <article key={o.id} className="ticket" data-new={unseen.includes(o.id)} onClick={() => router.push(`/orders/${o.id}`)}>
                    <div className="ticket-head">
                      <strong>{o.number}</strong>
                      <span className="muted small">{o.fulfilment.scheduledFor ? `⏰ ${formatTime(o.fulfilment.scheduledFor)}` : minutesAgo(o.createdAt)}</span>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <Badge tone={o.fulfilment.type === 'delivery' ? 'violet' : 'blue'}>{o.fulfilment.type === 'delivery' ? 'Reparto' : 'Recogida'}</Badge>
                      <Badge tone={o.payment.status === 'paid' ? 'green' : 'grey'}>
                        {o.payment.method === 'cash' ? 'Efectivo' : 'Tarjeta'} · {PAYMENT_LABEL[o.payment.status] ?? o.payment.status}
                      </Badge>
                      {branches.length > 1 ? <span className="muted small">{byId(o.branchId)?.name.replace('La Toscana ', '')}</span> : null}
                    </div>
                    <div className="ticket-lines">
                      {o.lines.slice(0, 4).map((l, i) => (
                        <span key={i}>
                          {l.quantity}× {l.name}
                          {l.options.length ? ` (${l.options.map((x) => x.choiceName).join(', ')})` : ''}
                        </span>
                      ))}
                      {o.lines.length > 4 ? <span>+{o.lines.length - 4} más…</span> : null}
                    </div>
                    {o.notes ? (
                      <p className="small" style={{ color: 'var(--amber)' }}>
                        📝 {o.notes}
                      </p>
                    ) : null}
                    <div className="row-between">
                      <strong className="mono">{formatEur(o.totals.totalCents)}</strong>
                      {can('orders:update') && next[0] ? (
                        <Button
                          size="sm"
                          variant="primary"
                          loading={busy === o.id}
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
  );
}

function History() {
  const { branchParam, byId } = useBranches();
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
        <select className="input" aria-label="Estado" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
          <option value="">Todos los estados</option>
          {['confirmed', 'preparing', 'ready', 'out_for_delivery', 'picked_up', 'delivered', 'cancelled', 'refunded', 'pending_payment'].map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="row small">
          Desde <input className="input" type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} />
        </label>
        <label className="row small">
          Hasta <input className="input" type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} />
        </label>
      </div>
      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty icon="orders" title="No hay pedidos con estos filtros" />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Restaurante</th>
                  <th>Tipo</th>
                  <th>Pago</th>
                  <th>Estado</th>
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
                    <td>{o.fulfilment.type === 'delivery' ? 'Reparto' : 'Recogida'}</td>
                    <td>
                      {o.payment.method === 'cash' ? 'Efectivo' : 'Tarjeta'}
                      {o.payment.simulated ? (
                        <>
                          {' '}
                          <Badge tone="amber">Simulado</Badge>
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
  const [tab, setTab] = useState<'board' | 'history'>('board');
  return (
    <>
      <PageHeader title="Pedidos" subtitle="Los pedidos nuevos llegan en directo desde la web y la app." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'board', label: 'Cocina (en curso)' },
          { value: 'history', label: 'Historial' },
        ]}
      />
      {tab === 'board' ? <Board /> : <History />}
    </>
  );
}
