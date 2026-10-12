'use client';

import { useState } from 'react';
import { Alert, Card, Empty, PageHeader, Spinner, Stat } from '@/components/ui/kit';
import { qs } from '@/lib/api';
import { useBranches } from '@/lib/branch';
import { errorText, formatEur, STATUS_LABEL, todayLocal } from '@/lib/format';
import type { AnalyticsSummary } from '@/lib/types';
import { useResource } from '@/lib/use-resource';

const RANGES = [
  { label: 'Hoy', from: 0 },
  { label: '7 días', from: -6 },
  { label: '30 días', from: -29 },
];

export default function ReportsPage() {
  const { branchParam } = useBranches();
  const [from, setFrom] = useState(todayLocal(-6));
  const [to, setTo] = useState(todayLocal());
  const r = useResource<AnalyticsSummary>(`/api/v1/admin/analytics/summary${qs({ branchId: branchParam, from, to })}`);
  const s = r.data;
  const csv = () => {
    if (!s) return;
    const rows = [['Producto', 'Unidades', 'Ventas (EUR)'], ...s.topItems.map((i) => [i.name, String(i.quantity), (i.revenueCents / 100).toFixed(2)])];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `la-toscana-ventas-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <PageHeader title="Informes" subtitle="Ventas reales a partir de los pedidos (IVA incluido). Hora de España." />
      <div className="filters">
        {RANGES.map((x) => (
          <button
            key={x.label}
            type="button"
            className={`btn btn-sm ${from === todayLocal(x.from) && to === todayLocal() ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => (setFrom(todayLocal(x.from)), setTo(todayLocal()))}
          >
            {x.label}
          </button>
        ))}
        <label className="row small">
          Desde <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="row small">
          Hasta <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={csv} disabled={!s?.topItems.length}>
          Exportar CSV
        </button>
      </div>
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      {!s ? (
        <Spinner />
      ) : (
        <div className="stack">
          <div className="grid-4">
            <Stat icon="orders" tone="blue" label="Pedidos" value={s.orders} />
            <Stat
              icon="euro"
              tone="green"
              label="Ventas netas"
              value={formatEur(s.netCents)}
              hint={`Bruto ${formatEur(s.grossCents)} · reembolsado ${formatEur(s.refundedCents)}`}
            />
            <Stat icon="tag" tone="amber" label="Ticket medio" value={formatEur(s.averageTicketCents)} />
            <Stat icon="truck" tone="red" label="Pedidos a domicilio" value={`${Math.round(s.deliveryShare * 100)} %`} />
          </div>
          {s.simulatedCents ? <Alert tone="warning">{formatEur(s.simulatedCents)} corresponden a pagos con tarjeta simulados (modo de pruebas).</Alert> : null}
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <Card title="Productos más vendidos" padded={false}>
              {s.topItems.length === 0 ? (
                <Empty icon="menu" title="Sin ventas en este periodo" />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th className="num">Unidades</th>
                        <th className="num">Ventas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.topItems.map((i) => (
                        <tr key={i.name}>
                          <td>{i.name}</td>
                          <td className="num">{i.quantity}</td>
                          <td className="num">{formatEur(i.revenueCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <div className="stack">
              <Card title="Por método de pago">
                {s.byPayment.length === 0 ? (
                  <p className="muted">Sin datos.</p>
                ) : (
                  <dl className="kv">
                    {s.byPayment.map((p) => (
                      <div key={p.method} style={{ display: 'contents' }}>
                        <dt>{p.method === 'cash' ? 'Efectivo' : 'Tarjeta'}</dt>
                        <dd className="mono">
                          {p.count} · {formatEur(p.cents)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </Card>
              <Card title="Por estado">
                <dl className="kv">
                  {Object.entries(s.byStatus).map(([k, v]) => (
                    <div key={k} style={{ display: 'contents' }}>
                      <dt>{STATUS_LABEL[k] ?? k}</dt>
                      <dd className="mono">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
