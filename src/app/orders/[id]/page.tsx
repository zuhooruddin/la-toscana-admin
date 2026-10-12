'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFeedback } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/Icon';
import { Alert, Badge, Button, Card, Modal, PageHeader, SelectField, Spinner, TextArea, TextField } from '@/components/ui/kit';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { config } from '@/lib/config';
import {
  ACTION_LABEL,
  centsToInput,
  errorText,
  formatDateTime,
  formatEur,
  IF_SOLD_OUT_LABEL,
  nextStatuses,
  parseEur,
  PAYMENT_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from '@/lib/format';
import { useRealtime, useRealtimeEvent } from '@/lib/realtime';
import type { AdminOrder } from '@/lib/types';
import { useResource } from '@/lib/use-resource';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { byId } = useBranches();
  const { markSeen } = useRealtime();
  const { toast } = useFeedback();
  const r = useResource<{ order: AdminOrder }>(`/api/v1/admin/orders/${id}`);
  useRealtimeEvent(
    (e) => e.startsWith('order.'),
    (_e, p) => (p as { id?: string })?.id === id && r.reload(),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);

  useEffect(() => {
    markSeen(id);
  }, [id, markSeen]);

  if (r.error) return <Alert tone="danger">{errorText(r.error)}</Alert>;
  const o = r.data?.order;
  if (!o) return <Spinner />;
  const next = nextStatuses(o.status, o.fulfilment.type);
  const canCancel = ['confirmed', 'preparing', 'ready'].includes(o.status);
  const refundable = o.totals.totalCents - (o.payment.refundedCents ?? 0);
  const canRefund =
    can('orders:refund') &&
    refundable > 0 &&
    (o.payment.method === 'cash'
      ? ['picked_up', 'delivered', 'cancelled'].includes(o.status) || o.payment.status === 'paid'
      : ['paid', 'partially_refunded'].includes(o.payment.status));

  async function setStatus(to: string, note?: string) {
    setBusy(to);
    try {
      await api(`/api/v1/admin/orders/${id}/status`, { method: 'POST', body: { status: to, note } });
      toast(`Pedido ${o!.number}: ${STATUS_LABEL[to]}`);
      setCancelOpen(false);
      r.reload();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        back={
          <Link href="/orders" className="back-link">
            <Icon name="left" size={15} /> Pedidos
          </Link>
        }
        title={`Pedido ${o.number}`}
        subtitle={
          <>
            {byId(o.branchId)?.name ?? o.branchName} · {formatDateTime(o.createdAt)}
          </>
        }
        actions={
          <>
            <a className="btn btn-secondary btn-md" href={`${config.apiUrl}/api/v1/admin/orders/${o.id}/ticket`} target="_blank" rel="noopener noreferrer">
              <Icon name="print" /> Ticket de cocina
            </a>
            {can('orders:update') && canCancel ? (
              <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                Cancelar pedido
              </Button>
            ) : null}
            {canRefund ? (
              <Button onClick={() => setRefundOpen(true)} icon="euro">
                Reembolsar
              </Button>
            ) : null}
            {can('orders:update')
              ? next.map((s) => (
                  <Button key={s} variant="primary" loading={busy === s} onClick={() => void setStatus(s)}>
                    {ACTION_LABEL[s]}
                  </Button>
                ))
              : null}
          </>
        }
      />
      {o.payment.simulated ? (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warning">Pago con tarjeta simulado (modo de pruebas): no se ha cobrado dinero real.</Alert>
        </div>
      ) : null}
      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="stack">
          <Card title="Productos">
            <ul className="line-list">
              {o.lines.map((l, i) => (
                <li key={i}>
                  <div>
                    <strong>
                      {l.quantity}× {l.name}
                    </strong>
                    {l.options.length ? (
                      <div className="muted small">
                        {l.options.map((x) => `${x.choiceName}${x.priceDeltaCents ? ` (+${formatEur(x.priceDeltaCents)})` : ''}`).join(' · ')}
                      </div>
                    ) : null}
                    {l.notes ? (
                      <div className="small" style={{ color: 'var(--amber)' }}>
                        Nota: {l.notes}
                      </div>
                    ) : null}
                    {l.warnings?.map((w) => (
                      <div key={w} className="small" style={{ color: 'var(--red)' }}>
                        ⚠ {w}
                      </div>
                    ))}
                  </div>
                  <span className="mono">{formatEur(l.lineTotalCents)}</span>
                </li>
              ))}
            </ul>
            <hr className="sep" />
            <dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
              <dt>Subtotal</dt>
              <dd className="mono">{formatEur(o.totals.subtotalCents)}</dd>
              {o.totals.discountCents ? (
                <>
                  <dt>Descuento{o.coupon?.code ? ` (${o.coupon.code})` : ''}</dt>
                  <dd className="mono">−{formatEur(o.totals.discountCents)}</dd>
                </>
              ) : null}
              {o.totals.deliveryFeeCents ? (
                <>
                  <dt>Envío</dt>
                  <dd className="mono">{formatEur(o.totals.deliveryFeeCents)}</dd>
                </>
              ) : null}
              <dt>
                <strong>Total (IVA incl.)</strong>
              </dt>
              <dd className="mono">
                <strong>{formatEur(o.totals.totalCents)}</strong>
              </dd>
              <dt>de los cuales IVA</dt>
              <dd className="mono">{formatEur(o.totals.taxCents)}</dd>
            </dl>
          </Card>
          {o.notes ? (
            <Card title="Comentarios del cliente">
              <p>{o.notes}</p>
            </Card>
          ) : null}
          <Card title="Historial">
            <ol className="timeline">
              {o.history.map((h, i) => (
                <li key={i}>
                  <div>
                    <strong>{STATUS_LABEL[h.status] ?? h.status}</strong> · <span className="muted">{formatDateTime(h.at)}</span>
                    {h.byRole ? <span className="muted"> · {h.byRole}</span> : null}
                    {h.note ? <div className="small">{h.note}</div> : null}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="stack">
          <Card title="Estado">
            <div className="row">
              <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
              <Badge tone={o.fulfilment.type === 'delivery' ? 'violet' : 'blue'}>
                {o.fulfilment.type === 'delivery' ? 'Reparto a domicilio' : 'Recogida en el local'}
              </Badge>
            </div>
            <dl className="kv" style={{ marginTop: 12 }}>
              {o.fulfilment.scheduledFor ? (
                <>
                  <dt>Programado para</dt>
                  <dd>
                    <strong>{formatDateTime(o.fulfilment.scheduledFor)}</strong>
                  </dd>
                </>
              ) : (
                <>
                  <dt>Hora estimada</dt>
                  <dd>{formatDateTime(o.fulfilment.estimatedReadyAt)}</dd>
                </>
              )}
              <dt>Si se agota</dt>
              <dd>{IF_SOLD_OUT_LABEL[o.ifSoldOut ?? 'contact']}</dd>
              {o.cancelReason ? (
                <>
                  <dt>Motivo cancelación</dt>
                  <dd>{o.cancelReason}</dd>
                </>
              ) : null}
            </dl>
          </Card>
          <Card title="Cliente">
            {o.customer?.anonymised ? (
              <p className="muted">Datos eliminados a petición del cliente.</p>
            ) : (
              <dl className="kv">
                <dt>Nombre</dt>
                <dd>{o.customer?.name ?? '—'}</dd>
                <dt>Teléfono</dt>
                <dd>{o.customer?.phone ? <a href={`tel:${o.customer.phone.replace(/\s/g, '')}`}>{o.customer.phone}</a> : '—'}</dd>
                <dt>Correo</dt>
                <dd>{o.customer?.email ?? '—'}</dd>
                {o.customer?.userId && can('customers:read') ? (
                  <>
                    <dt>Cuenta</dt>
                    <dd>
                      <Link href={`/customers/${o.customer.userId}`}>Ver ficha del cliente</Link>
                    </dd>
                  </>
                ) : null}
                {o.fulfilment.type === 'delivery' && o.fulfilment.address ? (
                  <>
                    <dt>Dirección</dt>
                    <dd>
                      {o.fulfilment.address.line1}
                      {o.fulfilment.address.line2 ? `, ${o.fulfilment.address.line2}` : ''}, {o.fulfilment.address.postcode} {o.fulfilment.address.city}
                      {o.fulfilment.address.notes ? <div className="muted small">{o.fulfilment.address.notes}</div> : null}
                    </dd>
                  </>
                ) : null}
              </dl>
            )}
          </Card>
          <Card title="Pago">
            <dl className="kv">
              <dt>Método</dt>
              <dd>{o.payment.method === 'cash' ? 'Efectivo (al recoger/entregar)' : 'Tarjeta'}</dd>
              <dt>Estado</dt>
              <dd>{PAYMENT_LABEL[o.payment.status] ?? o.payment.status}</dd>
              {o.payment.refundedCents ? (
                <>
                  <dt>Reembolsado</dt>
                  <dd className="mono">{formatEur(o.payment.refundedCents)}</dd>
                </>
              ) : null}
            </dl>
            {o.payment.refunds?.length ? (
              <ul className="line-list small" style={{ marginTop: 8 }}>
                {o.payment.refunds.map((x, i) => (
                  <li key={i}>
                    <span>
                      {formatDateTime(x.at)} · {x.reason} <span className="muted">({x.status === 'manual' ? 'manual' : x.status})</span>
                    </span>
                    <span className="mono">{formatEur(x.amountCents)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
          {o.fulfilment.type === 'delivery' ? (
            <Card
              title="Repartidor"
              actions={
                can('orders:assign_driver') && ['confirmed', 'preparing', 'ready'].includes(o.status) ? (
                  <Button size="sm" onClick={() => setDriverOpen(true)}>
                    {o.driver?.userId ? 'Cambiar' : 'Asignar'}
                  </Button>
                ) : null
              }
            >
              {o.driver?.userId ? (
                <dl className="kv">
                  <dt>Nombre</dt>
                  <dd>{o.driver.name ?? '—'}</dd>
                  <dt>Estado</dt>
                  <dd>
                    {{
                      assigned: 'Asignado (pendiente de aceptar)',
                      accepted: 'Aceptado',
                      declined: 'Rechazado',
                      picked_up: 'Recogido',
                      delivered: 'Entregado',
                    }[o.driver.state ?? ''] ?? o.driver.state}
                  </dd>
                  {o.driver.lastLocation ? (
                    <>
                      <dt>Última posición</dt>
                      <dd>
                        <a
                          href={`https://www.google.com/maps?q=${o.driver.lastLocation.lat},${o.driver.lastLocation.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ver en el mapa
                        </a>{' '}
                        <span className="muted small">({formatDateTime(o.driver.lastLocation.at)})</span>
                      </dd>
                    </>
                  ) : null}
                </dl>
              ) : (
                <p className="muted">Sin repartidor asignado.</p>
              )}
            </Card>
          ) : null}
        </div>
      </div>
      <CancelModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        busy={busy === 'cancelled'}
        onConfirm={(reason) => void setStatus('cancelled', reason)}
      />
      <RefundModal open={refundOpen} onClose={() => setRefundOpen(false)} order={o} max={refundable} onDone={r.reload} />
      {o.fulfilment.type === 'delivery' ? <DriverModal open={driverOpen} onClose={() => setDriverOpen(false)} order={o} onDone={r.reload} /> : null}
    </>
  );
}

function CancelModal({ open, onClose, onConfirm, busy }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void; busy: boolean }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancelar pedido"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Volver
          </Button>
          <Button variant="danger" disabled={reason.trim().length < 3} loading={busy} onClick={() => onConfirm(reason.trim())}>
            Cancelar pedido
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">El cliente verá el pedido como cancelado. Si pagó con tarjeta, haz después el reembolso.</p>
        <TextArea
          label="Motivo (obligatorio)"
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Producto agotado, cliente lo pidió por teléfono…"
        />
      </div>
    </Modal>
  );
}

function RefundModal({ open, onClose, order, max, onDone }: { open: boolean; onClose: () => void; order: AdminOrder; max: number; onDone: () => void }) {
  const { toast } = useFeedback();
  const [amount, setAmount] = useState(centsToInput(max));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const cents = parseEur(amount);
  const invalid = cents === null || cents <= 0 || cents > max;
  async function submit() {
    if (invalid || reason.trim().length < 3) return;
    setBusy(true);
    try {
      await api(`/api/v1/admin/orders/${order.id}/refund`, { method: 'POST', body: { amountCents: cents, reason: reason.trim() } });
      toast(`Reembolso de ${formatEur(cents)} registrado`);
      onClose();
      onDone();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reembolsar ${order.number}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" loading={busy} disabled={invalid || reason.trim().length < 3} onClick={() => void submit()}>
            Reembolsar
          </Button>
        </>
      }
    >
      <div className="stack">
        <Alert tone="info">
          {order.payment.method === 'card'
            ? 'Se devolverá a la tarjeta del cliente a través de la pasarela de pago.'
            : 'Pago en efectivo: se registra el reembolso manual. Devuelve el dinero en el local.'}
        </Alert>
        <TextField
          label={`Importe (máx. ${formatEur(max)})`}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={amount && invalid ? 'Importe no válido' : null}
        />
        <TextArea label="Motivo" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}

function DriverModal({ open, onClose, order, onDone }: { open: boolean; onClose: () => void; order: AdminOrder; onDone: () => void }) {
  const { toast } = useFeedback();
  const drivers = useResource<{ items: { id: string; name: string | null; phone: string | null }[] }>(
    open ? `/api/v1/admin/staff/drivers${qs({ branchId: order.branchId })}` : null,
  );
  const [driverId, setDriverId] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!driverId) return;
    setBusy(true);
    try {
      await api(`/api/v1/admin/orders/${order.id}/assign-driver`, { method: 'POST', body: { driverId } });
      toast('Repartidor asignado: le llega el aviso en su app');
      onClose();
      onDone();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  const list = drivers.data?.items ?? [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Asignar repartidor"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} disabled={!driverId} onClick={() => void submit()}>
            Asignar
          </Button>
        </>
      }
    >
      {drivers.loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Alert tone="warning">No hay repartidores activos en este restaurante. Créalos en «Equipo y permisos».</Alert>
      ) : (
        <SelectField label="Repartidor" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
          <option value="">Elige…</option>
          {list.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name ?? d.id}
              {d.phone ? ` · ${d.phone}` : ''}
            </option>
          ))}
        </SelectField>
      )}
    </Modal>
  );
}
