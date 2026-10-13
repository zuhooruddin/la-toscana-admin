'use client';

import { useState } from 'react';
import { useFeedback } from '@/components/ui/feedback';
import { Alert, Badge, Button, Card, Empty, PageHeader, Spinner } from '@/components/ui/kit';
import { api, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { errorText, todayLocal } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { PhoneBooking } from './PhoneBooking';
import { useT } from '@/lib/i18n';

interface Reservation {
  _id: string;
  branchId: string;
  date: string;
  time: string;
  partySize: number;
  name: string;
  phone: string;
  notes?: string;
  status: 'confirmed' | 'cancelled' | 'no_show' | 'seated';
}
const STATUS: Record<Reservation['status'], { label: [string, string]; tone: 'blue' | 'green' | 'grey' | 'red' }> = {
  confirmed: { label: ['Confirmada', 'Confirmed'], tone: 'blue' },
  seated: { label: ['Sentados', 'Seated'], tone: 'green' },
  no_show: { label: ['No se presentó', 'No-show'], tone: 'red' },
  cancelled: { label: ['Cancelada', 'Cancelled'], tone: 'grey' },
};

export default function ReservationsPage() {
  const t = useT();
  const { can } = useAuth();
  const { branchParam, byId, branches } = useBranches();
  const { toast, confirm } = useFeedback();
  const [date, setDate] = useState(todayLocal());
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const r = useResource<{ items: Reservation[] }>(`/api/v1/admin/reservations${qs({ branchId: branchParam, date })}`, { refreshMs: 60_000 });
  const items = r.data?.items ?? [];
  const active = items.filter((x) => x.status !== 'cancelled');

  async function setStatus(x: Reservation, status: 'seated' | 'no_show' | 'cancelled') {
    if (
      status === 'cancelled' &&
      !(await confirm({
        title: t('Cancelar reserva', 'Cancel reservation'),
        message: t(`¿Cancelar la reserva de ${x.name} (${x.partySize} pers., ${x.time})?`, `Cancel the reservation for ${x.name} (${x.partySize} guests, ${x.time})?`),
        danger: true,
        confirmLabel: t('Cancelar reserva', 'Cancel reservation'),
      }))
    )
      return;
    setBusy(x._id);
    try {
      await api(`/api/v1/admin/reservations/${x._id}/status`, { method: 'POST', body: { status } });
      toast(`${x.name}: ${t(...STATUS[status].label).toLowerCase()}`);
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
        title={t('Reservas', 'Reservations')}
        subtitle={r.data ? t(`${active.length} reservas · ${active.reduce((n, x) => n + x.partySize, 0)} comensales`, `${active.length} reservations · ${active.reduce((n, x) => n + x.partySize, 0)} guests`) : undefined}
        actions={
          can('reservations:write') ? (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              {t('Reserva por teléfono', 'Phone reservation')}
            </Button>
          ) : null
        }
      />
      <div className="filters">
        <Button size="sm" variant={date === todayLocal() ? 'secondary' : 'ghost'} onClick={() => setDate(todayLocal())}>
          {t('Hoy', 'Today')}
        </Button>
        <Button size="sm" variant={date === todayLocal(1) ? 'secondary' : 'ghost'} onClick={() => setDate(todayLocal(1))}>
          {t('Mañana', 'Tomorrow')}
        </Button>
        <input className="input" type="date" aria-label={t('Fecha', 'Date')} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      <Card padded={false}>
        {r.loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty icon="calendar" title={t('No hay reservas este día', 'No reservations this day')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Hora', 'Time')}</th>
                  <th>{t('Nombre', 'Name')}</th>
                  <th className="num">{t('Personas', 'Guests')}</th>
                  <th>{t('Teléfono', 'Phone')}</th>
                  {branches.length > 1 ? <th>{t('Restaurante', 'Restaurant')}</th> : null}
                  <th>{t('Notas', 'Notes')}</th>
                  <th>{t('Estado', 'Status')}</th>
                  <th aria-label={t('Acciones', 'Actions')} />
                </tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr key={x._id} style={x.status === 'cancelled' ? { opacity: 0.55 } : undefined}>
                    <td className="mono">
                      <strong>{x.time}</strong>
                    </td>
                    <td>{x.name}</td>
                    <td className="num">{x.partySize}</td>
                    <td>
                      <a href={`tel:${x.phone.replace(/\s/g, '')}`}>{x.phone}</a>
                    </td>
                    {branches.length > 1 ? <td>{byId(x.branchId)?.name}</td> : null}
                    <td className="small muted">{x.notes ?? ''}</td>
                    <td>
                      <Badge tone={STATUS[x.status].tone}>{t(...STATUS[x.status].label)}</Badge>
                    </td>
                    <td className="num">
                      {can('reservations:write') && x.status === 'confirmed' ? (
                        <span className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          <Button size="sm" variant="success" disabled={busy === x._id} onClick={() => void setStatus(x, 'seated')}>
                            {t('Sentados', 'Seated')}
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busy === x._id} onClick={() => void setStatus(x, 'no_show')}>
                            {t('No vino', 'No-show')}
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busy === x._id} onClick={() => void setStatus(x, 'cancelled')}>
                            {t('Cancelar', 'Cancel')}
                          </Button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {creating ? <PhoneBooking defaultDate={date} onClose={() => setCreating(false)} onDone={() => (setCreating(false), r.reload())} /> : null}
    </>
  );
}
