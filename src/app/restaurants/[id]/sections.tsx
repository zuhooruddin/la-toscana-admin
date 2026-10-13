'use client';

import { useState } from 'react';
import { ImageInput, MoneyInput } from '@/components/forms';
import { Alert, Button, Card, Field, TextField, Toggle } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth';
import { DAY_LABEL, formatEur, readinessLabel } from '@/lib/format';
import type { AdminBranch, DeliveryZone, Interval } from '@/lib/types';
import { useBranchSave } from './use-save';
import { intlLocale, useT } from '@/lib/i18n';

type Props = { branch: AdminBranch & { readiness: { ordering: string[]; reservations: string[] } }; onSaved: () => void };

function SaveBar({ busy, onSave, disabled }: { busy: boolean; onSave: () => void; disabled?: boolean }) {
  const t = useT();
  return (
    <div className="form-actions">
      <Button variant="primary" icon="check" loading={busy} disabled={disabled} onClick={onSave}>
        {t('Guardar', 'Save')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- general
export function GeneralTab({ branch: b, onSaved }: Props) {
  const t = useT();
  const { can } = useAuth();
  const { save, busy, error } = useBranchSave(b.id, onSaved);
  const [f, setF] = useState({
    name: b.name,
    published: b.published,
    imageUrl: b.imageUrl ?? null,
    line1: b.address.line1,
    city: b.address.city,
    postcode: b.address.postcode ?? '',
    lat: b.geo?.lat?.toString() ?? '',
    lng: b.geo?.lng?.toString() ?? '',
    phone: b.contact?.phone ?? '',
    email: b.contact?.email ?? '',
    whatsapp: b.contact?.whatsapp ?? '',
    verified: Boolean(b.contact?.verified),
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const ro = !can('branch:write');
  const geoValid = (!f.lat && !f.lng) || (Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lng)) && f.lat !== '' && f.lng !== '');
  return (
    <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title={t('Local', 'Venue')}>
          <div className="stack">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <TextField label={t('Nombre', 'Name')} value={f.name} onChange={(e) => set({ name: e.target.value })} required />
            <TextField label={t('Dirección', 'Address')} value={f.line1} onChange={(e) => set({ line1: e.target.value })} required />
            <div className="grid-2">
              <TextField label={t('Ciudad', 'City')} value={f.city} onChange={(e) => set({ city: e.target.value })} required />
              <TextField
                label={t('Código postal', 'Postcode')}
                value={f.postcode}
                maxLength={5}
                inputMode="numeric"
                onChange={(e) => set({ postcode: e.target.value })}
              />
            </div>
            <div className="grid-2">
              <TextField
                label={t('Latitud', 'Latitude')}
                value={f.lat}
                inputMode="decimal"
                onChange={(e) => set({ lat: e.target.value })}
                hint={t('Para «cómo llegar» y el restaurante más cercano', 'For directions and the nearest restaurant')}
              />
              <TextField
                label={t('Longitud', 'Longitude')}
                value={f.lng}
                inputMode="decimal"
                onChange={(e) => set({ lng: e.target.value })}
                error={geoValid ? null : t('Coordenadas no válidas', 'Invalid coordinates')}
              />
            </div>
            <ImageInput label={t('Foto del local', 'Venue photo')} value={f.imageUrl} onChange={(imageUrl) => set({ imageUrl })} />
            <Toggle
              label={t('Publicado en la web y la app', 'Published on the website and app')}
              checked={f.published}
              onChange={(published) => set({ published })}
            />
          </div>
        </Card>
        <Card title={t('Contacto', 'Contact')}>
          <div className="stack">
            <TextField label={t('Teléfono', 'Phone')} value={f.phone} type="tel" onChange={(e) => set({ phone: e.target.value })} />
            <TextField label="WhatsApp" value={f.whatsapp} type="tel" onChange={(e) => set({ whatsapp: e.target.value })} />
            <TextField label={t('Correo', 'Email')} value={f.email} type="email" onChange={(e) => set({ email: e.target.value })} />
            <Toggle
              label={t('Datos de contacto verificados', 'Contact details verified')}
              hint={t('Necesario para activar los pedidos online.', 'Required to enable online orders.')}
              checked={f.verified}
              onChange={(verified) => set({ verified })}
            />
          </div>
        </Card>
      </div>
      {!ro ? (
        <SaveBar
          busy={busy}
          disabled={!geoValid}
          onSave={() =>
            void save({
              name: f.name.trim(),
              published: f.published,
              imageUrl: f.imageUrl,
              address: { line1: f.line1.trim(), city: f.city.trim(), postcode: f.postcode.trim() },
              ...(f.lat && f.lng ? { geo: { lat: Number(f.lat), lng: Number(f.lng) } } : {}),
              contact: {
                phone: f.phone.trim(),
                whatsapp: f.whatsapp.trim(),
                verified: f.verified,
                ...(f.email.trim() ? { email: f.email.trim() } : {}),
              },
            })
          }
        />
      ) : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------- hours
function IntervalsEditor({ value, onChange }: { value: Interval[]; onChange: (v: Interval[]) => void }) {
  const t = useT();
  return (
    <div>
      {value.length === 0 ? <span className="muted">{t('Cerrado', 'Closed')}</span> : null}
      {value.map((iv, i) => (
        <span key={i} className="interval">
          <input
            className="input"
            type="time"
            aria-label={t('Abre', 'Opens')}
            value={iv.open}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))}
          />
          –
          <input
            className="input"
            type="time"
            aria-label={t('Cierra', 'Closes')}
            value={iv.close}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label={t('Quitar franja', 'Remove time range')}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export function HoursTab({ branch: b, onSaved }: Props) {
  const t = useT();
  const { can } = useAuth();
  const { save, busy, error } = useBranchSave(b.id, onSaved);
  const [hours, setHours] = useState(() => [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, intervals: b.hours.find((h) => h.day === day)?.intervals ?? [] })));
  const [verified, setVerified] = useState(b.hoursVerified);
  const [exceptions, setExceptions] = useState(b.exceptions ?? []);
  const [exDate, setExDate] = useState('');
  const ro = !can('branch:write');
  const bad = hours.some((h) => h.intervals.some((i) => !/^\d\d:\d\d$/.test(i.open) || !/^\d\d:\d\d$/.test(i.close)));
  return (
    <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', alignItems: 'start' }}>
        <Card title={t('Horario semanal', 'Weekly hours')}>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <p className="muted small" style={{ marginBottom: 8 }}>
            {t(
              'Hora de España. Una franja que cierra después de medianoche (ej. 20:00–01:00) cuenta para el día en que abre.',
              'Spain time. A range that closes after midnight (e.g. 20:00–01:00) counts for the day it opens.',
            )}
          </p>
          {hours.map((h, i) => (
            <div key={h.day} className="hours-row">
              <strong>{DAY_LABEL[h.day]}</strong>
              <IntervalsEditor value={h.intervals} onChange={(intervals) => setHours(hours.map((x, j) => (j === i ? { ...x, intervals } : x)))} />
              <Button
                size="sm"
                variant="ghost"
                icon="plus"
                disabled={h.intervals.length >= 4}
                onClick={() => setHours(hours.map((x, j) => (j === i ? { ...x, intervals: [...x.intervals, { open: '13:00', close: '16:00' }] } : x)))}
              >
                {t('Franja', 'Range')}
              </Button>
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <Toggle
              label={t('Horario verificado', 'Hours verified')}
              hint={t(
                'Confirma que este es el horario real. Necesario para pedidos y reservas online.',
                'Confirms this is the real schedule. Required for online orders and reservations.',
              )}
              checked={verified}
              onChange={setVerified}
            />
          </div>
        </Card>
        <Card title={t('Cierres y horarios especiales', 'Closures and special hours')}>
          <p className="muted small" style={{ marginBottom: 10 }}>
            {t('Festivos, vacaciones o días con horario distinto.', 'Holidays, vacations or days with different hours.')}
          </p>
          <div className="row" style={{ marginBottom: 12 }}>
            <input
              className="input"
              type="date"
              aria-label={t('Fecha', 'Date')}
              value={exDate}
              onChange={(e) => setExDate(e.target.value)}
              style={{ width: 'auto' }}
            />
            <Button
              size="sm"
              icon="plus"
              disabled={!exDate || exceptions.some((x) => x.date === exDate)}
              onClick={() => (
                setExceptions([...exceptions, { date: exDate, closed: true, intervals: [], note: '' }].sort((a, c) => a.date.localeCompare(c.date))),
                setExDate('')
              )}
            >
              {t('Añadir día', 'Add day')}
            </Button>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {exceptions.length === 0 ? <p className="muted">{t('Sin días especiales.', 'No special days.')}</p> : null}
            {exceptions.map((x, i) => (
              <div key={x.date} className="card" style={{ background: 'var(--surface-2)', padding: 12 }}>
                <div className="row-between">
                  <strong>
                    {new Date(`${x.date}T12:00:00Z`).toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </strong>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('Quitar día', 'Remove day')}
                    onClick={() => setExceptions(exceptions.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </div>
                <label className="checkbox" style={{ margin: '8px 0' }}>
                  <input
                    type="checkbox"
                    checked={x.closed}
                    onChange={(e) =>
                      setExceptions(
                        exceptions.map((y, j) =>
                          j === i
                            ? {
                                ...y,
                                closed: e.target.checked,
                                intervals: e.target.checked ? [] : y.intervals?.length ? y.intervals : [{ open: '13:00', close: '16:00' }],
                              }
                            : y,
                        ),
                      )
                    }
                  />
                  {t('Cerrado todo el día', 'Closed all day')}
                </label>
                {!x.closed ? (
                  <IntervalsEditor
                    value={x.intervals ?? []}
                    onChange={(intervals) => setExceptions(exceptions.map((y, j) => (j === i ? { ...y, intervals } : y)))}
                  />
                ) : null}
                <input
                  className="input"
                  style={{ marginTop: 8 }}
                  placeholder={t('Nota (ej. Festivo local)', 'Note (e.g. Local holiday)')}
                  maxLength={200}
                  value={x.note ?? ''}
                  onChange={(e) => setExceptions(exceptions.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)))}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
      {!ro ? (
        <SaveBar
          busy={busy}
          disabled={bad}
          onSave={() =>
            void save({
              hours: hours.filter((h) => h.intervals.length),
              hoursVerified: verified,
              exceptions: exceptions.map((x) => ({
                date: x.date,
                closed: x.closed,
                ...(x.closed ? {} : { intervals: x.intervals ?? [] }),
                ...(x.note ? { note: x.note } : {}),
              })),
            })
          }
        />
      ) : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------- ordering & payments
export function OrderingTab({ branch: b, onSaved }: Props) {
  const t = useT();
  const { can } = useAuth();
  const { save, busy, error } = useBranchSave(b.id, onSaved);
  const [f, setF] = useState({
    enabled: b.ordering.enabled,
    scheduledOrders: b.ordering.scheduledOrders,
    prep: b.ordering.prepTimeMinutes,
    pickup: b.services.pickup,
    delivery: b.services.delivery,
    dineIn: b.services.dineIn,
    cash: b.payments.cash,
    card: b.payments.card,
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const ro = !can('branch:write');
  return (
    <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title={t('Pedidos online', 'Online orders')}>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {b.readiness.ordering.length ? (
            <Alert tone="warning" title={t('Antes de activar los pedidos falta:', 'Before enabling orders, the following is missing:')}>
              {b.readiness.ordering.map(readinessLabel).join(', ')}
            </Alert>
          ) : null}
          <Toggle
            label={t('Aceptar pedidos online', 'Accept online orders')}
            hint={t('Web y app de clientes', 'Customer website and app')}
            checked={f.enabled}
            onChange={(enabled) => set({ enabled })}
          />
          <Toggle
            label={t('Permitir pedidos programados', 'Allow scheduled orders')}
            hint={t(
              'El cliente puede elegir hora (también cuando el local está cerrado).',
              'The customer can choose a time (also when the restaurant is closed).',
            )}
            checked={f.scheduledOrders}
            onChange={(scheduledOrders) => set({ scheduledOrders })}
          />
          <TextField
            label={t('Tiempo de preparación (minutos)', 'Preparation time (minutes)')}
            type="number"
            min={0}
            max={240}
            value={f.prep}
            onChange={(e) => set({ prep: Number(e.target.value) })}
            hint={t('Se usa para la hora estimada y la primera hora programable.', 'Used for the estimated time and the first schedulable time.')}
          />
        </Card>
        <div className="stack">
          <Card title={t('Servicios', 'Services')}>
            <Toggle label={t('Recogida en el local', 'Pickup at the restaurant')} checked={f.pickup} onChange={(pickup) => set({ pickup })} />
            <Toggle
              label={t('Reparto a domicilio', 'Home delivery')}
              hint={t('Configura las zonas en la pestaña «Reparto».', 'Set up the zones in the “Delivery” tab.')}
              checked={f.delivery}
              onChange={(delivery) => set({ delivery })}
            />
            <Toggle label={t('Consumo en el local', 'Dine-in')} checked={f.dineIn} onChange={(dineIn) => set({ dineIn })} />
          </Card>
          <Card title={t('Métodos de pago', 'Payment methods')}>
            <Toggle
              label={t('Efectivo', 'Cash')}
              hint={t('Al recoger o al recibir el pedido', 'On pickup or when receiving the order')}
              checked={f.cash}
              onChange={(cash) => set({ cash })}
            />
            <Toggle
              label={t('Tarjeta online (Stripe)', 'Online card (Stripe)')}
              hint={t('Requiere las claves de Stripe en Ajustes → Pagos.', 'Requires the Stripe keys in Settings → Payments.')}
              checked={f.card}
              onChange={(card) => set({ card })}
            />
            <p className="muted small">
              {t('Bizum no está disponible hasta configurar un proveedor real.', 'Bizum is not available until a real provider is configured.')}
            </p>
          </Card>
        </div>
      </div>
      {!ro ? (
        <SaveBar
          busy={busy}
          onSave={() =>
            void save({
              ordering: { enabled: f.enabled, scheduledOrders: f.scheduledOrders, prepTimeMinutes: f.prep },
              services: { pickup: f.pickup, delivery: f.delivery, dineIn: f.dineIn },
              payments: { cash: f.cash, card: f.card },
            })
          }
        />
      ) : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------- delivery zones
export function DeliveryTab({ branch: b, onSaved }: Props) {
  const t = useT();
  const { can } = useAuth();
  const { save, busy, error } = useBranchSave(b.id, onSaved);
  const [zones, setZones] = useState<DeliveryZone[]>(b.delivery?.zones ?? []);
  const [requireAccept, setRequireAccept] = useState(b.drivers?.requireAccept ?? true);
  const ro = !can('branch:write');
  const setZone = (i: number, p: Partial<DeliveryZone>) => setZones(zones.map((z, j) => (j === i ? { ...z, ...p } : z)));
  const invalid = zones.some((z) => !z.name.trim() || !z.postcodes.length || z.postcodes.some((p) => !/^\d{5}$/.test(p)));
  return (
    <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0 }}>
      <Card
        title={t('Zonas de reparto', 'Delivery zones')}
        actions={
          <Button
            size="sm"
            icon="plus"
            onClick={() => setZones([...zones, { name: '', postcodes: [], feeCents: 0, minOrderCents: 0, etaMinutes: 45, active: true }])}
          >
            {t('Añadir zona', 'Add zone')}
          </Button>
        }
      >
        <div className="stack">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {!b.services.delivery ? (
            <Alert tone="info">
              {t(
                'El reparto está desactivado en «Pedidos y pagos». Puedes preparar las zonas antes de activarlo.',
                'Delivery is disabled under “Orders & payments”. You can prepare the zones before enabling it.',
              )}
            </Alert>
          ) : null}
          {zones.length === 0 ? (
            <p className="muted">
              {t(
                'Sin zonas. El reparto solo se ofrece en los códigos postales de una zona activa.',
                'No zones. Delivery is only offered at the postcodes of an active zone.',
              )}
            </p>
          ) : null}
          {zones.map((z, i) => (
            <div key={i} className="card" style={{ background: 'var(--surface-2)' }}>
              <div className="grid-4">
                <TextField label={t('Nombre de la zona', 'Zone name')} value={z.name} onChange={(e) => setZone(i, { name: e.target.value })} />
                <MoneyInput label={t('Gastos de envío', 'Delivery fee')} cents={z.feeCents} onChange={(feeCents) => setZone(i, { feeCents })} />
                <MoneyInput label={t('Pedido mínimo', 'Minimum order')} cents={z.minOrderCents} onChange={(minOrderCents) => setZone(i, { minOrderCents })} />
                <TextField
                  label={t('Tiempo estimado (min)', 'Estimated time (min)')}
                  type="number"
                  min={5}
                  max={240}
                  value={z.etaMinutes}
                  onChange={(e) => setZone(i, { etaMinutes: Number(e.target.value) })}
                />
              </div>
              <Field
                label={t('Códigos postales', 'Postcodes')}
                hint={t('Separados por comas o espacios (5 cifras).', 'Separated by commas or spaces (5 digits).')}
              >
                <input
                  className="input"
                  defaultValue={z.postcodes.join(', ')}
                  onBlur={(e) =>
                    setZone(i, {
                      postcodes: [
                        ...new Set(
                          e.target.value
                            .split(/[\s,;]+/)
                            .map((p) => p.trim())
                            .filter(Boolean),
                        ),
                      ],
                    })
                  }
                  aria-invalid={z.postcodes.some((p) => !/^\d{5}$/.test(p)) ? true : undefined}
                />
              </Field>
              <div className="row-between" style={{ marginTop: 8 }}>
                <label className="checkbox">
                  <input type="checkbox" checked={z.active} onChange={(e) => setZone(i, { active: e.target.checked })} />
                  {t('Zona activa', 'Active zone')}
                </label>
                <span className="muted small">
                  {t(
                    `${z.postcodes.length} CP · envío ${formatEur(z.feeCents)} · mínimo ${formatEur(z.minOrderCents)}`,
                    `${z.postcodes.length} postcodes · delivery ${formatEur(z.feeCents)} · minimum ${formatEur(z.minOrderCents)}`,
                  )}
                </span>
                <Button size="sm" variant="ghost" icon="trash" onClick={() => setZones(zones.filter((_, j) => j !== i))}>
                  {t('Quitar', 'Remove')}
                </Button>
              </div>
            </div>
          ))}
          <Toggle
            label={t('El repartidor debe aceptar cada entrega', 'The driver must accept each delivery')}
            hint={t('Si se desactiva, el pedido queda aceptado al asignarlo.', 'If disabled, the order is accepted as soon as it is assigned.')}
            checked={requireAccept}
            onChange={setRequireAccept}
          />
        </div>
      </Card>
      {!ro ? (
        <SaveBar
          busy={busy}
          disabled={invalid}
          onSave={() =>
            void save({
              delivery: {
                zones: zones.map((z) => ({
                  name: z.name.trim(),
                  postcodes: z.postcodes,
                  feeCents: z.feeCents,
                  minOrderCents: z.minOrderCents,
                  etaMinutes: z.etaMinutes,
                  active: z.active,
                })),
              },
              drivers: { requireAccept },
            })
          }
        />
      ) : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------- reservations
export function ReservationsTab({ branch: b, onSaved }: Props) {
  const t = useT();
  const { can } = useAuth();
  const { save, busy, error } = useBranchSave(b.id, onSaved);
  const [f, setF] = useState(b.reservations);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const ro = !can('branch:write');
  return (
    <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0 }}>
      <Card title={t('Reservas online', 'Online reservations')}>
        <div className="stack">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {b.readiness.reservations.length ? (
            <Alert tone="warning">
              {t('Falta', 'Missing')}: {b.readiness.reservations.map(readinessLabel).join(', ')}
            </Alert>
          ) : null}
          <Toggle
            label={t('Aceptar reservas online', 'Accept online reservations')}
            hint={t('Se confirman automáticamente hasta la capacidad indicada.', 'They are confirmed automatically up to the stated capacity.')}
            checked={f.enabled}
            onChange={(enabled) => set({ enabled })}
          />
          <div className="grid-3">
            <TextField
              label={t('Comensales por franja', 'Guests per time slot')}
              type="number"
              min={0}
              max={500}
              value={f.capacityPerSlot}
              onChange={(e) => set({ capacityPerSlot: Number(e.target.value) })}
            />
            <TextField
              label={t('Duración de la franja (min)', 'Slot length (min)')}
              type="number"
              min={15}
              max={120}
              step={15}
              value={f.slotMinutes}
              onChange={(e) => set({ slotMinutes: Number(e.target.value) })}
            />
            <TextField
              label={t('Máx. personas por reserva', 'Max. guests per reservation')}
              type="number"
              min={1}
              max={50}
              value={f.maxPartySize}
              onChange={(e) => set({ maxPartySize: Number(e.target.value) })}
            />
            <TextField
              label={t('Antelación mínima (min)', 'Minimum lead time (min)')}
              type="number"
              min={0}
              value={f.minLeadMinutes}
              onChange={(e) => set({ minLeadMinutes: Number(e.target.value) })}
            />
            <TextField
              label={t('Días máximos de antelación', 'Maximum days ahead')}
              type="number"
              min={1}
              max={365}
              value={f.maxDaysAhead}
              onChange={(e) => set({ maxDaysAhead: Number(e.target.value) })}
            />
          </div>
        </div>
      </Card>
      {!ro ? <SaveBar busy={busy} onSave={() => void save({ reservations: f })} /> : null}
    </fieldset>
  );
}
