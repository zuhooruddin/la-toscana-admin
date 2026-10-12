'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFeedback } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/Icon';
import { Alert, Badge, Button, Card, Empty, PageHeader, Spinner, TextField } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { errorText, formatDate, formatDateTime, formatEur, STATUS_LABEL, STATUS_TONE } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import type { CustomerSummary } from '../page';

interface Detail {
  customer: CustomerSummary & { lang: string; addresses: { label: string | null; line1: string; line2: string | null; postcode: string; city: string }[] };
  orders: { id: string; number: string; status: string; branchId: string; type: string; totalCents: number; paymentMethod: string; createdAt: string }[];
  reservations: { id: string; branchId: string; date: string; time: string; partySize: number; status: string }[];
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const { byId } = useBranches();
  const { toast, confirm } = useFeedback();
  const r = useResource<Detail>(`/api/v1/admin/customers/${id}`);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState('');

  if (r.error) return <Alert tone="danger">{errorText(r.error)}</Alert>;
  if (!r.data) return <Spinner />;
  const { customer: c, orders, reservations } = r.data;

  async function toggleBlock() {
    const block = c.status === 'active';
    if (
      !(await confirm({
        title: block ? 'Bloquear cliente' : 'Desbloquear cliente',
        message: block ? 'No podrá iniciar sesión ni pedir con su cuenta. Se cerrarán sus sesiones abiertas.' : 'Podrá volver a usar su cuenta.',
        danger: block,
        confirmLabel: block ? 'Bloquear' : 'Desbloquear',
      }))
    )
      return;
    setBusy(true);
    try {
      await api(`/api/v1/admin/customers/${id}`, { method: 'PATCH', body: { status: block ? 'disabled' : 'active' } });
      toast(block ? 'Cliente bloqueado' : 'Cliente desbloqueado');
      r.reload();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function erase() {
    if (
      !(await confirm({
        title: 'Eliminar datos del cliente (RGPD)',
        message: 'Se borran nombre, correo, teléfono y direcciones. Los pedidos se conservan anonimizados por obligación contable. No se puede deshacer.',
        danger: true,
        confirmLabel: 'Eliminar datos',
        typeToConfirm: 'ELIMINAR',
      }))
    )
      return;
    setBusy(true);
    try {
      await api(`/api/v1/admin/customers/${id}/erase`, { method: 'POST', body: { confirm: 'ELIMINAR', reference: reference.trim() || undefined } });
      toast('Datos del cliente eliminados');
      router.replace('/customers');
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        back={
          <Link href="/customers" className="back-link">
            <Icon name="left" size={15} /> Clientes
          </Link>
        }
        title={c.name ?? c.email}
        subtitle={
          <>
            Cliente desde {formatDate(c.createdAt)} · último acceso {formatDateTime(c.lastLoginAt)}
          </>
        }
        actions={
          can('customers:write') ? (
            <Button loading={busy} variant={c.status === 'active' ? 'secondary' : 'success'} onClick={() => void toggleBlock()}>
              {c.status === 'active' ? 'Bloquear' : 'Desbloquear'}
            </Button>
          ) : null
        }
      />
      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.5fr)', alignItems: 'start' }}>
        <div className="stack">
          <Card title="Datos">
            <dl className="kv">
              <dt>Correo</dt>
              <dd>{c.email}</dd>
              <dt>Teléfono</dt>
              <dd>{c.phone ? <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a> : '—'}</dd>
              <dt>Idioma</dt>
              <dd>{c.lang === 'en' ? 'Inglés' : 'Español'}</dd>
              <dt>Promociones</dt>
              <dd>{c.marketingConsent ? 'Acepta comunicaciones' : 'No acepta'}</dd>
              <dt>Estado</dt>
              <dd>{c.status === 'active' ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Bloqueado</Badge>}</dd>
              <dt>Pedidos</dt>
              <dd>
                {c.orders.count} · {formatEur(c.orders.totalCents)}
              </dd>
            </dl>
          </Card>
          <Card title="Direcciones guardadas">
            {c.addresses.length === 0 ? (
              <p className="muted">Ninguna.</p>
            ) : (
              <ul className="line-list">
                {c.addresses.map((a, i) => (
                  <li key={i}>
                    <span>
                      {a.label ? <strong>{a.label}: </strong> : null}
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ''}, {a.postcode} {a.city}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {can('privacy:manage') ? (
            <Card title="Protección de datos">
              <div className="stack">
                <p className="muted small">Para atender una solicitud de supresión (RGPD). Queda registrado en el registro de actividad.</p>
                <TextField
                  label="Referencia de la solicitud (opcional)"
                  value={reference}
                  maxLength={200}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Correo del 13/10/2026"
                />
                <Button variant="danger" icon="trash" loading={busy} onClick={() => void erase()}>
                  Eliminar datos del cliente
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
        <div className="stack">
          <Card title="Pedidos recientes" padded={false}>
            {orders.length === 0 ? (
              <Empty icon="orders" title="Sin pedidos" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Fecha</th>
                      <th>Restaurante</th>
                      <th>Estado</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link href={`/orders/${o.id}`}>
                            <strong>{o.number}</strong>
                          </Link>
                        </td>
                        <td className="mono">{formatDateTime(o.createdAt)}</td>
                        <td>{byId(o.branchId)?.name ?? '—'}</td>
                        <td>
                          <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                        </td>
                        <td className="num">{formatEur(o.totalCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Reservas" padded={false}>
            {reservations.length === 0 ? (
              <Empty icon="calendar" title="Sin reservas" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Restaurante</th>
                      <th className="num">Personas</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((x) => (
                      <tr key={x.id}>
                        <td className="mono">
                          {x.date} {x.time}
                        </td>
                        <td>{byId(x.branchId)?.name ?? '—'}</td>
                        <td className="num">{x.partySize}</td>
                        <td>{x.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
