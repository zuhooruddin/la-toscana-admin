'use client';

import { useState } from 'react';
import { Alert, Card, Empty, PageHeader, Spinner, Stat } from '@/components/ui/kit';
import { qs } from '@/lib/api';
import { useBranches } from '@/lib/branch';
import { errorText, formatEur, STATUS_LABEL, todayLocal } from '@/lib/format';
import type { AnalyticsSummary } from '@/lib/types';
import { useResource } from '@/lib/use-resource';
import { useT } from '@/lib/i18n';

const RANGES: { label: [string, string]; from: number }[] = [
  { label: ['Hoy', 'Today'], from: 0 },
  { label: ['7 días', '7 days'], from: -6 },
  { label: ['30 días', '30 days'], from: -29 },
];

export default function ReportsPage() {
  const t = useT();
  const { branchParam } = useBranches();
  const [from, setFrom] = useState(todayLocal(-6));
  const [to, setTo] = useState(todayLocal());
  const r = useResource<AnalyticsSummary>(`/api/v1/admin/analytics/summary${qs({ branchId: branchParam, from, to })}`);
  const s = r.data;
  const csv = () => {
    if (!s) return;
    const rows = [[t('Producto', 'Product'), t('Unidades', 'Units'), t('Ventas (EUR)', 'Sales (EUR)')], ...s.topItems.map((i) => [i.name, String(i.quantity), (i.revenueCents / 100).toFixed(2)])];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `la-toscana-${t('ventas', 'sales')}-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <PageHeader title={t('Informes', 'Reports')} subtitle={t('Ventas reales a partir de los pedidos (IVA incluido). Hora de España.', 'Actual sales from orders (VAT included). Spain time.')} />
      <div className="filters">
        {RANGES.map((x) => (
          <button
            key={x.label[0]}
            type="button"
            className={`btn btn-sm ${from === todayLocal(x.from) && to === todayLocal() ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => (setFrom(todayLocal(x.from)), setTo(todayLocal()))}
          >
            {t(...x.label)}
          </button>
        ))}
        <label className="row small">
          {t('Desde', 'From')} <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="row small">
          {t('Hasta', 'To')} <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={csv} disabled={!s?.topItems.length}>
          {t('Exportar CSV', 'Export CSV')}
        </button>
      </div>
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      {!s ? (
        <Spinner />
      ) : (
        <div className="stack">
          <div className="grid-4">
            <Stat icon="orders" tone="blue" label={t('Pedidos', 'Orders')} value={s.orders} />
            <Stat
              icon="euro"
              tone="green"
              label={t('Ventas netas', 'Net sales')}
              value={formatEur(s.netCents)}
              hint={t(`Bruto ${formatEur(s.grossCents)} · reembolsado ${formatEur(s.refundedCents)}`, `Gross ${formatEur(s.grossCents)} · refunded ${formatEur(s.refundedCents)}`)}
            />
            <Stat icon="tag" tone="amber" label={t('Ticket medio', 'Average ticket')} value={formatEur(s.averageTicketCents)} />
            <Stat icon="truck" tone="red" label={t('Pedidos a domicilio', 'Delivery orders')} value={`${Math.round(s.deliveryShare * 100)} %`} />
          </div>
          {s.simulatedCents ? <Alert tone="warning">{formatEur(s.simulatedCents)} {t('corresponden a pagos con tarjeta simulados (modo de pruebas).', 'are simulated card payments (test mode).')}</Alert> : null}
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <Card title={t('Productos más vendidos', 'Top products')} padded={false}>
              {s.topItems.length === 0 ? (
                <Empty icon="menu" title={t('Sin ventas en este periodo', 'No sales in this period')} />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('Producto', 'Product')}</th>
                        <th className="num">{t('Unidades', 'Units')}</th>
                        <th className="num">{t('Ventas', 'Sales')}</th>
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
              <Card title={t('Por método de pago', 'By payment method')}>
                {s.byPayment.length === 0 ? (
                  <p className="muted">{t('Sin datos.', 'No data.')}</p>
                ) : (
                  <dl className="kv">
                    {s.byPayment.map((p) => (
                      <div key={p.method} style={{ display: 'contents' }}>
                        <dt>{p.method === 'cash' ? t('Efectivo', 'Cash') : t('Tarjeta', 'Card')}</dt>
                        <dd className="mono">
                          {p.count} · {formatEur(p.cents)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </Card>
              <Card title={t('Por estado', 'By status')}>
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
