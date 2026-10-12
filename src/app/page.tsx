'use client';

import Link from 'next/link';
import { orderingBadge, PauseControl } from '@/components/BranchStatus';
import { Icon } from '@/components/ui/Icon';
import { Alert, Badge, Card, Empty, PageHeader, Spinner, Stat } from '@/components/ui/kit';
import { qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { errorText, formatEur, formatTime, minutesAgo, STATUS_LABEL, STATUS_TONE } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import type { AdminOrder, AnalyticsSummary } from '@/lib/types';
import { useResource } from '@/lib/use-resource';

export default function Dashboard() {
  const { me, can } = useAuth();
  const { branches, branchParam, byId, reload: reloadBranches, loading: branchesLoading } = useBranches();
  const summary = useResource<AnalyticsSummary>(`/api/v1/admin/analytics/summary${qs({ branchId: branchParam })}`, { refreshMs: 60_000 });
  const active = useResource<{ items: AdminOrder[] }>(
    can('orders:read') ? `/api/v1/admin/orders${qs({ active: 'true', branchId: branchParam, pageSize: 50 })}` : null,
    {
      refreshMs: 60_000,
    },
  );
  useRealtimeEvent(
    (e) => e.startsWith('order.'),
    () => {
      active.reload();
      summary.reload();
    },
  );
  useRealtimeEvent((e) => e === 'branch.ordering_changed', reloadBranches);

  const s = summary.data;
  const orders = active.data?.items ?? [];
  const visibleBranches = branchParam ? branches.filter((b) => b.id === branchParam) : branches;
  const hour = Number(new Intl.DateTimeFormat('es-ES', { hour: 'numeric', hour12: false, timeZone: 'Europe/Madrid' }).format(new Date()));
  const greeting = hour < 14 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <>
      <PageHeader title={`${greeting}${me?.name ? `, ${me.name.split(' ')[0]}` : ''}`} subtitle="Resumen de hoy en tus restaurantes" />
      {summary.error ? <Alert tone="danger">{errorText(summary.error)}</Alert> : null}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Stat icon="orders" tone="blue" label="Pedidos hoy" value={s ? s.orders : '—'} hint={s ? `${s.byStatus.cancelled ?? 0} cancelados` : undefined} />
        <Stat
          icon="euro"
          tone="green"
          label="Ventas hoy (IVA incl.)"
          value={s ? formatEur(s.netCents) : '—'}
          hint={s?.refundedCents ? `${formatEur(s.refundedCents)} reembolsado` : undefined}
        />
        <Stat icon="tag" tone="amber" label="Ticket medio" value={s ? formatEur(s.averageTicketCents) : '—'} />
        <Stat
          icon="clock"
          tone="red"
          label="Pedidos en curso"
          value={active.data ? orders.length : '—'}
          hint={orders.filter((o) => o.status === 'confirmed').length ? `${orders.filter((o) => o.status === 'confirmed').length} por aceptar` : undefined}
        />
      </div>
      {s && s.simulatedCents > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warning">
            {formatEur(s.simulatedCents)} de las ventas de hoy son pagos con tarjeta <strong>simulados</strong> (modo de pruebas). No es dinero real.
          </Alert>
        </div>
      ) : null}

      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', alignItems: 'start' }}>
        <Card
          title="Pedidos en curso"
          padded={false}
          actions={
            can('orders:read') ? (
              <Link href="/orders" className="btn btn-secondary btn-sm">
                Ver tablero
                <Icon name="right" size={15} />
              </Link>
            ) : null
          }
        >
          {active.loading ? (
            <Spinner />
          ) : orders.length === 0 ? (
            <Empty icon="orders" title="No hay pedidos en curso">
              Los pedidos nuevos aparecerán aquí al instante.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 10).map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/orders/${o.id}`}>
                          <strong>{o.number}</strong>
                        </Link>
                        <div className="muted small">
                          {byId(o.branchId)?.name ?? o.branchName} ·{' '}
                          {o.fulfilment.scheduledFor ? `Programado ${formatTime(o.fulfilment.scheduledFor)}` : minutesAgo(o.createdAt)}
                        </div>
                      </td>
                      <td>{o.customer?.name ?? '—'}</td>
                      <td>{o.fulfilment.type === 'delivery' ? 'Reparto' : 'Recogida'}</td>
                      <td>
                        <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                      </td>
                      <td className="num">{formatEur(o.totals.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="stack">
          <Card title="Restaurantes">
            {branchesLoading ? (
              <Spinner />
            ) : (
              <div className="stack">
                {visibleBranches.map((b) => (
                  <div key={b.id} className="row-between">
                    <div>
                      <strong>{b.name}</strong>
                      <div style={{ marginTop: 4 }}>{orderingBadge(b)}</div>
                    </div>
                    <PauseControl branch={b} onChanged={reloadBranches} />
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Lo más vendido hoy">
            {!s ? (
              <Spinner />
            ) : s.topItems.length === 0 ? (
              <p className="muted">Todavía no hay ventas hoy.</p>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {s.topItems.slice(0, 6).map((i) => (
                  <div key={i.name}>
                    <div className="row-between small">
                      <span>
                        <strong>{i.quantity}×</strong> {i.name}
                      </span>
                      <span className="muted mono">{formatEur(i.revenueCents)}</span>
                    </div>
                    <div className="bar" aria-hidden="true">
                      <span style={{ width: `${Math.round((i.quantity / s.topItems[0]!.quantity) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          {s && s.byPayment.length ? (
            <Card title="Cobros de hoy">
              <dl className="kv">
                {s.byPayment.map((p) => (
                  <div key={p.method} style={{ display: 'contents' }}>
                    <dt>{p.method === 'cash' ? 'Efectivo' : 'Tarjeta'}</dt>
                    <dd className="mono">
                      {p.count} pedidos · {formatEur(p.cents)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
