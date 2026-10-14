'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Alert, Badge, Button, Card, Empty, PageHeader, Spinner, Stat } from '@/components/ui/kit';
import { qs } from '@/lib/api';
import { useBranches } from '@/lib/branch';
import { errorText, formatEur, STATUS_LABEL, todayLocal } from '@/lib/format';
import type { AnalyticsSummary } from '@/lib/types';
import { useResource } from '@/lib/use-resource';
import { useLang, useT } from '@/lib/i18n';
import './reports.css';

type Report = AnalyticsSummary & {
  byDay?: { date: string; orders: number; netCents: number }[];
  byHour?: { hour: number; orders: number; netCents: number }[];
  previous?: { orders: number; netCents: number; averageTicketCents: number };
};
const shift = (date: string, days: number) => new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
const COLORS = ['#1bbc72', '#328eff', '#ffa429', '#9e52ff'];

function Trend({ current, previous }: { current: number; previous?: number }) {
  if (!previous) return null;
  const percent = Math.round(((current - previous) / previous) * 100);
  return (
    <span className={`report-trend ${percent < 0 ? 'down' : ''}`}>
      {percent < 0 ? '↓' : '↑'} {percent > 0 ? '+' : ''}
      {percent}%
    </span>
  );
}

function SalesChart({ data }: { data: NonNullable<Report['byDay']> }) {
  const t = useT();
  const { lang } = useLang();
  const [group, setGroup] = useState('daily');
  const buckets =
    group === 'daily'
      ? data
      : Array.from({ length: Math.ceil(data.length / 7) }, (_, index) => {
          const slice = data.slice(index * 7, index * 7 + 7);
          return { date: slice[0].date, orders: slice.reduce((n, d) => n + d.orders, 0), netCents: slice.reduce((n, d) => n + d.netCents, 0) };
        });
  const maxSales = Math.max(100, ...buckets.map((d) => d.netCents));
  const maxOrders = Math.max(1, ...buckets.map((d) => d.orders));
  const points = (field: 'netCents' | 'orders', max: number) =>
    buckets.map((d, i) => `${40 + (i / Math.max(1, buckets.length - 1)) * 650},${160 - (Math.max(0, d[field]) / max) * 140}`).join(' ');
  return (
    <Card
      title={t('Resumen de ventas', 'Sales overview')}
      actions={
        <select className="input report-select" value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t('Agrupar ventas', 'Group sales')}>
          <option value="daily">{t('Diario', 'Daily')}</option>
          <option value="weekly">{t('Semanal', 'Weekly')}</option>
        </select>
      }
    >
      {!data.length ? (
        <Empty icon="euro" title={t('Sin datos diarios para este periodo', 'No daily data for this period')} />
      ) : (
        <>
          <div className="report-legend">
            <span>
              <i style={{ background: COLORS[0] }} />
              {t('Ventas netas (€)', 'Net sales (€)')}
            </span>
            <span>
              <i style={{ background: '#ff2534' }} />
              {t('Pedidos (escala derecha)', 'Orders (right scale)')}
            </span>
          </div>
          <svg
            className="report-chart"
            viewBox="0 0 730 205"
            role="img"
            aria-label={t('Ventas y pedidos del periodo seleccionado', 'Sales and orders for the selected period')}
          >
            <defs>
              <linearGradient id="report-sales-fill" x1="0" x2="0" y1="0" y2="1">
                <stop stopColor="#1bbc72" stopOpacity=".25" />
                <stop offset="1" stopColor="#1bbc72" stopOpacity=".03" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((n) => (
              <g key={n}>
                <line x1="40" x2="690" y1={160 - n * 140} y2={160 - n * 140} stroke="#eee" />
                <text x="3" y={164 - n * 140}>
                  {formatEur(Math.round(maxSales * n))}
                </text>
                <text x="700" y={164 - n * 140}>
                  {Math.round(maxOrders * n)}
                </text>
              </g>
            ))}
            <polygon points={`40,160 ${points('netCents', maxSales)} 690,160`} fill="url(#report-sales-fill)" />
            <polyline points={points('netCents', maxSales)} fill="none" stroke="#1bbc72" strokeWidth="2" />
            <polyline points={points('orders', maxOrders)} fill="none" stroke="#ff2534" strokeWidth="2" />
            {buckets.map((d, i) => (
              <g key={d.date}>
                <circle cx={40 + (i / Math.max(1, buckets.length - 1)) * 650} cy={160 - (Math.max(0, d.netCents) / maxSales) * 140} r="3" fill="#1bbc72">
                  <title>
                    {d.date}: {formatEur(d.netCents)}, {d.orders} {t('pedidos', 'orders')}
                  </title>
                </circle>
                {i === 0 || i === buckets.length - 1 || i % Math.max(1, Math.ceil(buckets.length / 7)) === 0 ? (
                  <text x={40 + (i / Math.max(1, buckets.length - 1)) * 650} y="187" textAnchor="middle">
                    {new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' }).format(
                      new Date(`${d.date}T12:00:00Z`),
                    )}
                  </text>
                ) : null}
              </g>
            ))}
          </svg>
        </>
      )}
    </Card>
  );
}

export default function ReportsPage() {
  const t = useT();
  const { branchParam } = useBranches();
  const [from, setFrom] = useState(todayLocal(-6));
  const [to, setTo] = useState(todayLocal());
  const [showAll, setShowAll] = useState(false);
  const [hourMetric, setHourMetric] = useState('orders');
  const valid = Boolean(from && to && from <= to);
  const r = useResource<Report>(valid ? `/api/v1/admin/analytics/summary${qs({ branchId: branchParam, from, to })}` : null, { refreshMs: 60000 });
  const s = r.data;
  const ranges = [
    { label: t('Hoy', 'Today'), from: todayLocal(), to: todayLocal() },
    { label: t('7 días', '7 days'), from: todayLocal(-6), to: todayLocal() },
    { label: t('30 días', '30 days'), from: todayLocal(-29), to: todayLocal() },
    { label: t('90 días', '90 days'), from: todayLocal(-89), to: todayLocal() },
    { label: t('Este mes', 'This month'), from: monthStart(todayLocal()), to: todayLocal() },
    { label: t('Mes pasado', 'Last month'), from: monthStart(shift(monthStart(todayLocal()), -1)), to: shift(monthStart(todayLocal()), -1) },
  ];
  const csv = () => {
    if (!s) return;
    const rows = [
      [t('Métrica', 'Metric'), t('Valor', 'Value')],
      [t('Pedidos', 'Orders'), String(s.orders)],
      [t('Ventas netas EUR', 'Net sales EUR'), (s.netCents / 100).toFixed(2)],
      [t('Reembolsado EUR', 'Refunded EUR'), (s.refundedCents / 100).toFixed(2)],
      [],
      [t('Producto', 'Product'), t('Unidades', 'Units'), t('Ventas EUR', 'Sales EUR')],
      ...s.topItems.map((i) => [i.name, String(i.quantity), (i.revenueCents / 100).toFixed(2)]),
    ];
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `la-toscana-report-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const paymentTotal = s?.byPayment.reduce((sum, p) => sum + p.cents, 0) ?? 0;
  let angle = 0;
  const stops = s?.byPayment.map((p, i) => {
    const start = angle;
    angle += paymentTotal ? (p.cents / paymentTotal) * 100 : 0;
    return `${COLORS[i % COLORS.length]} ${start}% ${angle}%`;
  });
  const statusTotal = s ? Object.values(s.byStatus).reduce((sum, count) => sum + count, 0) : 0;
  const hourly = s?.byHour ?? [];
  const maxHour = Math.max(1, ...hourly.map((h) => (hourMetric === 'orders' ? h.orders : h.netCents)));
  const delivery = s ? Math.round(s.orders * s.deliveryShare) : 0;
  return (
    <div className="reports-page">
      <PageHeader
        title={t('Informes', 'Reports')}
        subtitle={t('Ventas reales a partir de pedidos (IVA incluido). Hora de España.', 'Actual sales from orders (VAT included). Spain time.')}
        actions={
          <Button icon="upload" onClick={csv} disabled={!s}>
            {t('Exportar CSV', 'Export CSV')}
          </Button>
        }
      />
      <div className="report-filters">
        <div className="report-ranges">
          {ranges.map((range) => (
            <button
              key={range.label}
              type="button"
              aria-pressed={from === range.from && to === range.to}
              onClick={() => {
                setFrom(range.from);
                setTo(range.to);
              }}
            >
              {range.label}
            </button>
          ))}
        </div>
        <label>
          <Icon name="calendar" />
          <span className="sr-only">{t('Desde', 'From')}</span>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <span className="muted">→</span>
        <label>
          <Icon name="calendar" />
          <span className="sr-only">{t('Hasta', 'To')}</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {!valid ? (
        <Alert tone="warning">{t('Selecciona un periodo válido.', 'Select a valid date range.')}</Alert>
      ) : r.error ? (
        <Alert tone="danger">{errorText(r.error)}</Alert>
      ) : !s ? (
        <Spinner />
      ) : (
        <>
          <div className="grid-4 report-stats">
            <Stat
              icon="bag"
              tone="red"
              label={t('Total de pedidos', 'Total orders')}
              value={
                <>
                  {s.orders}
                  <Trend current={s.orders} previous={s.previous?.orders} />
                </>
              }
              hint={t('vs. periodo anterior', 'vs previous period')}
            />
            <Stat
              icon="euro"
              tone="green"
              label={t('Ventas netas', 'Net sales')}
              value={
                <>
                  {formatEur(s.netCents)}
                  <Trend current={s.netCents} previous={s.previous?.netCents} />
                </>
              }
              hint={`${t('Bruto', 'Gross')} ${formatEur(s.grossCents)} · ${t('Reembolsado', 'Refunded')} ${formatEur(s.refundedCents)}`}
            />
            <Stat
              icon="tag"
              tone="amber"
              label={t('Ticket medio', 'Average ticket')}
              value={
                <>
                  {formatEur(s.averageTicketCents)}
                  <Trend current={s.averageTicketCents} previous={s.previous?.averageTicketCents} />
                </>
              }
              hint={t('vs. periodo anterior', 'vs previous period')}
            />
            <Stat
              icon="truck"
              tone="blue"
              label={t('Pedidos a domicilio', 'Delivery orders')}
              value={delivery}
              hint={`${Math.round(s.deliveryShare * 100)}% ${t('de los pedidos', 'of orders')}`}
            />
          </div>
          {s.simulatedCents > 0 ? (
            <Alert tone="warning">
              {formatEur(s.simulatedCents)} {t('son pagos simulados (modo de pruebas).', 'are simulated payments (test mode).')}
            </Alert>
          ) : null}
          <div className="report-panels">
            <SalesChart data={s.byDay ?? []} />
            <Card title={t('Por método de pago', 'By payment method')}>
              <div className="report-payment">
                <div
                  className="report-donut"
                  role="img"
                  aria-label={s.byPayment.map((p) => `${p.method}: ${formatEur(p.cents)}`).join(', ')}
                  style={{ background: paymentTotal ? `conic-gradient(${stops?.join(',')})` : '#eee' }}
                >
                  <div>
                    <strong>{formatEur(paymentTotal)}</strong>
                    <small>{t('Importe de pedidos', 'Order amounts')}</small>
                  </div>
                </div>
                <div className="report-payment-key">
                  {s.byPayment.map((p, i) => (
                    <div key={p.method}>
                      <i style={{ background: COLORS[i % COLORS.length] }} />
                      <span>{p.method === 'cash' ? t('Efectivo', 'Cash') : p.method === 'card' ? t('Tarjeta', 'Card') : p.method}</span>
                      <strong>{formatEur(p.cents)}</strong>
                      <small>{paymentTotal ? Math.round((p.cents / paymentTotal) * 100) : 0}%</small>
                    </div>
                  ))}
                </div>
              </div>
              <p className="report-note">
                {t(
                  'Importes brutos por método, antes de reembolsos; incluyen pedidos cancelados.',
                  'Gross amounts by method, before refunds; include cancelled orders.',
                )}
              </p>
            </Card>
            <Card
              title={t('Productos más vendidos', 'Top products')}
              padded={false}
              actions={
                <Button size="sm" onClick={() => setShowAll(!showAll)} aria-pressed={showAll}>
                  {showAll ? t('Ver menos', 'Show less') : t('Ver todos', 'View all')}
                </Button>
              }
            >
              {!s.topItems.length ? (
                <Empty icon="menu" title={t('Sin ventas en este periodo', 'No sales in this period')} />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t('Producto', 'Product')}</th>
                        <th>{t('Unidades', 'Units')}</th>
                        <th>{t('Ventas (IVA incl.)', 'Sales (VAT incl.)')}</th>
                        <th>{t('Cuota de productos', 'Product share')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.topItems.slice(0, showAll ? 10 : 5).map((item, index) => {
                        const total = s.topItems.reduce((n, i) => n + i.revenueCents, 0);
                        const share = total ? (item.revenueCents / total) * 100 : 0;
                        return (
                          <tr key={item.name}>
                            <td>{index + 1}</td>
                            <td>{item.name}</td>
                            <td>{item.quantity}</td>
                            <td>{formatEur(item.revenueCents)}</td>
                            <td>
                              <div className="report-share">
                                <div className="bar">
                                  <span style={{ width: `${share}%` }} />
                                </div>
                                <small>{Math.round(share)}%</small>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card title={t('Por estado de pedido', 'By order status')}>
              <div className="report-status-list">
                {Object.entries(s.byStatus).map(([status, count], index) => (
                  <div key={status}>
                    <span>{STATUS_LABEL[status] ?? status}</span>
                    <strong>{count}</strong>
                    <div className="bar">
                      <span style={{ width: `${statusTotal ? (count / statusTotal) * 100 : 0}%`, background: COLORS[index % COLORS.length] }} />
                    </div>
                    <small>{statusTotal ? Math.round((count / statusTotal) * 100) : 0}%</small>
                  </div>
                ))}
              </div>
            </Card>
            <Card
              title={t('Pedidos por hora', 'Orders by hour')}
              actions={
                <select
                  className="input report-select"
                  value={hourMetric}
                  onChange={(e) => setHourMetric(e.target.value)}
                  aria-label={t('Métrica horaria', 'Hourly metric')}
                >
                  <option value="orders">{t('Pedidos', 'Orders')}</option>
                  <option value="sales">{t('Ventas (€)', 'Sales (€)')}</option>
                </select>
              }
            >
              {!hourly.length ? (
                <Empty icon="clock" title={t('Sin datos horarios', 'No hourly data')} />
              ) : (
                <div className="hour-chart">
                  {hourly.map((h) => (
                    <div key={h.hour} title={`${h.hour}:00: ${h.orders} ${t('pedidos', 'orders')}, ${formatEur(h.netCents)}`}>
                      <div className="hour-bar">
                        <span style={{ height: `${(Math.max(0, hourMetric === 'orders' ? h.orders : h.netCents) / maxHour) * 100}%` }} />
                      </div>
                      <small>{String(h.hour).padStart(2, '0')}</small>
                    </div>
                  ))}
                </div>
              )}
              <p className="report-note">
                {t('Todas las horas del periodo, sumadas en hora de España.', 'All hours across the period, summed in Spain time.')}
              </p>
            </Card>
            <Card title={t('Resumen', 'Summary')}>
              <dl className="report-summary">
                {[
                  [t('Pedidos', 'Orders'), s.orders],
                  [t('Ventas netas (IVA incl.)', 'Net sales (VAT incl.)'), formatEur(s.netCents)],
                  [t('Ticket medio', 'Average ticket'), formatEur(s.averageTicketCents)],
                  [t('Pedidos a domicilio', 'Delivery orders'), delivery],
                  [t('Reembolsado', 'Refunded'), formatEur(s.refundedCents)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <Badge tone="grey">
                {from} → {to}
              </Badge>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
