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
import { useT } from '@/lib/i18n';

interface Detail {
  customer: CustomerSummary & { lang: string; addresses: { label: string | null; line1: string; line2: string | null; postcode: string; city: string }[] };
  orders: { id: string; number: string; status: string; branchId: string; type: string; totalCents: number; paymentMethod: string; createdAt: string }[];
  reservations: { id: string; branchId: string; date: string; time: string; partySize: number; status: string }[];
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
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
        title: block ? t('Bloquear cliente', 'Block customer') : t('Desbloquear cliente', 'Unblock customer'),
        message: block
          ? t(
              'No podrá iniciar sesión ni pedir con su cuenta. Se cerrarán sus sesiones abiertas.',
              'They will not be able to log in or order with their account. Their open sessions will be closed.',
            )
          : t('Podrá volver a usar su cuenta.', 'They will be able to use their account again.'),
        danger: block,
        confirmLabel: block ? t('Bloquear', 'Block') : t('Desbloquear', 'Unblock'),
      }))
    )
      return;
    setBusy(true);
    try {
      await api(`/api/v1/admin/customers/${id}`, { method: 'PATCH', body: { status: block ? 'disabled' : 'active' } });
      toast(block ? t('Cliente bloqueado', 'Customer blocked') : t('Cliente desbloqueado', 'Customer unblocked'));
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
        title: t('Eliminar datos del cliente (RGPD)', 'Delete customer data (GDPR)'),
        message: t(
          'Se borran nombre, correo, teléfono y direcciones. Los pedidos se conservan anonimizados por obligación contable. No se puede deshacer.',
          'Name, email, phone and addresses are deleted. Orders are kept anonymised for accounting purposes. This cannot be undone.',
        ),
        danger: true,
        confirmLabel: t('Eliminar datos', 'Delete data'),
        typeToConfirm: 'ELIMINAR',
      }))
    )
      return;
    setBusy(true);
    try {
      await api(`/api/v1/admin/customers/${id}/erase`, { method: 'POST', body: { confirm: 'ELIMINAR', reference: reference.trim() || undefined } });
      toast(t('Datos del cliente eliminados', 'Customer data deleted'));
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
            <Icon name="left" size={15} /> {t('Clientes', 'Customers')}
          </Link>
        }
        title={c.name ?? c.email}
        subtitle={
          <>
            {t('Cliente desde', 'Customer since')} {formatDate(c.createdAt)} · {t('último acceso', 'last login')} {formatDateTime(c.lastLoginAt)}
          </>
        }
        actions={
          can('customers:write') ? (
            <Button loading={busy} variant={c.status === 'active' ? 'secondary' : 'success'} onClick={() => void toggleBlock()}>
              {c.status === 'active' ? t('Bloquear', 'Block') : t('Desbloquear', 'Unblock')}
            </Button>
          ) : null
        }
      />
      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.5fr)', alignItems: 'start' }}>
        <div className="stack">
          <Card title={t('Datos', 'Details')}>
            <dl className="kv">
              <dt>{t('Correo', 'Email')}</dt>
              <dd>{c.email}</dd>
              <dt>{t('Teléfono', 'Phone')}</dt>
              <dd>{c.phone ? <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a> : '—'}</dd>
              <dt>{t('Idioma', 'Language')}</dt>
              <dd>{c.lang === 'en' ? t('Inglés', 'English') : t('Español', 'Spanish')}</dd>
              <dt>{t('Promociones', 'Promotions')}</dt>
              <dd>{c.marketingConsent ? t('Acepta comunicaciones', 'Accepts communications') : t('No acepta', 'Does not accept')}</dd>
              <dt>{t('Estado', 'Status')}</dt>
              <dd>{c.status === 'active' ? <Badge tone="green">{t('Activo', 'Active')}</Badge> : <Badge tone="red">{t('Bloqueado', 'Blocked')}</Badge>}</dd>
              <dt>{t('Pedidos', 'Orders')}</dt>
              <dd>
                {c.orders.count} · {formatEur(c.orders.totalCents)}
              </dd>
            </dl>
          </Card>
          <Card title={t('Direcciones guardadas', 'Saved addresses')}>
            {c.addresses.length === 0 ? (
              <p className="muted">{t('Ninguna.', 'None.')}</p>
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
            <Card title={t('Protección de datos', 'Data protection')}>
              <div className="stack">
                <p className="muted small">
                  {t(
                    'Para atender una solicitud de supresión (RGPD). Queda registrado en el registro de actividad.',
                    'To handle an erasure request (GDPR). It is recorded in the activity log.',
                  )}
                </p>
                <TextField
                  label={t('Referencia de la solicitud (opcional)', 'Request reference (optional)')}
                  value={reference}
                  maxLength={200}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={t('Correo del 13/10/2026', 'Email of 13/10/2026')}
                />
                <Button variant="danger" icon="trash" loading={busy} onClick={() => void erase()}>
                  {t('Eliminar datos del cliente', 'Delete customer data')}
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
        <div className="stack">
          <Card title={t('Pedidos recientes', 'Recent orders')} padded={false}>
            {orders.length === 0 ? (
              <Empty icon="orders" title={t('Sin pedidos', 'No orders')} />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('Pedido', 'Order')}</th>
                      <th>{t('Fecha', 'Date')}</th>
                      <th>{t('Restaurante', 'Restaurant')}</th>
                      <th>{t('Estado', 'Status')}</th>
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
          <Card title={t('Reservas', 'Reservations')} padded={false}>
            {reservations.length === 0 ? (
              <Empty icon="calendar" title={t('Sin reservas', 'No reservations')} />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('Fecha', 'Date')}</th>
                      <th>{t('Restaurante', 'Restaurant')}</th>
                      <th className="num">{t('Personas', 'Guests')}</th>
                      <th>{t('Estado', 'Status')}</th>
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
