'use client';

import { useState } from 'react';
import { ImageInput, MoneyInput } from '@/components/forms';
import { Alert, Button, Card, Field, TextField, Toggle } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth';
import { DAY_LABEL, formatEur, readinessLabel } from '@/lib/format';
import type { AdminBranch, DeliveryZone, Interval } from '@/lib/types';
import { useBranchSave } from './use-save';

type Props = { branch: AdminBranch & { readiness: { ordering: string[]; reservations: string[] } }; onSaved: () => void };

function SaveBar({ busy, onSave, disabled }: { busy: boolean; onSave: () => void; disabled?: boolean }) {
  return (
    <div className="form-actions">
      <Button variant="primary" icon="check" loading={busy} disabled={disabled} onClick={onSave}>
        Guardar
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- general
export function GeneralTab({ branch: b, onSaved }: Props) {
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
        <Card title="Local">
          <div className="stack">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <TextField label="Nombre" value={f.name} onChange={(e) => set({ name: e.target.value })} required />
            <TextField label="Dirección" value={f.line1} onChange={(e) => set({ line1: e.target.value })} required />
            <div className="grid-2">
              <TextField label="Ciudad" value={f.city} onChange={(e) => set({ city: e.target.value })} required />
              <TextField label="Código postal" value={f.postcode} maxLength={5} inputMode="numeric" onChange={(e) => set({ postcode: e.target.value })} />
            </div>
            <div className="grid-2">
              <TextField
                label="Latitud"
                value={f.lat}
                inputMode="decimal"
                onChange={(e) => set({ lat: e.target.value })}
                hint="Para «cómo llegar» y el restaurante más cercano"
              />
              <TextField
                label="Longitud"
                value={f.lng}
                inputMode="decimal"
                onChange={(e) => set({ lng: e.target.value })}
                error={geoValid ? null : 'Coordenadas no válidas'}
              />
            </div>
            <ImageInput label="Foto del local" value={f.imageUrl} onChange={(imageUrl) => set({ imageUrl })} />
            <Toggle label="Publicado en la web y la app" checked={f.published} onChange={(published) => set({ published })} />
          </div>
        </Card>
        <Card title="Contacto">
          <div className="stack">
            <TextField label="Teléfono" value={f.phone} type="tel" onChange={(e) => set({ phone: e.target.value })} />
            <TextField label="WhatsApp" value={f.whatsapp} type="tel" onChange={(e) => set({ whatsapp: e.target.value })} />
            <TextField label="Correo" value={f.email} type="email" onChange={(e) => set({ email: e.target.value })} />
            <Toggle
              label="Datos de contacto verificados"
              hint="Necesario para activar los pedidos online."
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
  return (
    <div>
      {value.length === 0 ? <span className="muted">Cerrado</span> : null}
      {value.map((iv, i) => (
        <span key={i} className="interval">
          <input
            className="input"
            type="time"
            aria-label="Abre"
            value={iv.open}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))}
          />
          –
          <input
            className="input"
            type="time"
            aria-label="Cierra"
            value={iv.close}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))}
          />
          <button type="button" className="icon-btn" aria-label="Quitar franja" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export function HoursTab({ branch: b, onSaved }: Props) {
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
        <Card title="Horario semanal">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <p className="muted small" style={{ marginBottom: 8 }}>
            Hora de España. Una franja que cierra después de medianoche (ej. 20:00–01:00) cuenta para el día en que abre.
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
                Franja
              </Button>
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <Toggle
              label="Horario verificado"
              hint="Confirma que este es el horario real. Necesario para pedidos y reservas online."
              checked={verified}
              onChange={setVerified}
            />
          </div>
        </Card>
        <Card title="Cierres y horarios especiales">
          <p className="muted small" style={{ marginBottom: 10 }}>
            Festivos, vacaciones o días con horario distinto.
          </p>
          <div className="row" style={{ marginBottom: 12 }}>
            <input className="input" type="date" aria-label="Fecha" value={exDate} onChange={(e) => setExDate(e.target.value)} style={{ width: 'auto' }} />
            <Button
              size="sm"
              icon="plus"
              disabled={!exDate || exceptions.some((x) => x.date === exDate)}
              onClick={() => (
                setExceptions([...exceptions, { date: exDate, closed: true, intervals: [], note: '' }].sort((a, c) => a.date.localeCompare(c.date))),
                setExDate('')
              )}
            >
              Añadir día
            </Button>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {exceptions.length === 0 ? <p className="muted">Sin días especiales.</p> : null}
            {exceptions.map((x, i) => (
              <div key={x.date} className="card" style={{ background: 'var(--surface-2)', padding: 12 }}>
                <div className="row-between">
                  <strong>
                    {new Date(`${x.date}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </strong>
                  <button type="button" className="icon-btn" aria-label="Quitar día" onClick={() => setExceptions(exceptions.filter((_, j) => j !== i))}>
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
                  Cerrado todo el día
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
                  placeholder="Nota (ej. Festivo local)"
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
        <Card title="Pedidos online">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {b.readiness.ordering.length ? (
            <Alert tone="warning" title="Antes de activar los pedidos falta:">
              {b.readiness.ordering.map(readinessLabel).join(', ')}
            </Alert>
          ) : null}
          <Toggle label="Aceptar pedidos online" hint="Web y app de clientes" checked={f.enabled} onChange={(enabled) => set({ enabled })} />
          <Toggle
            label="Permitir pedidos programados"
            hint="El cliente puede elegir hora (también cuando el local está cerrado)."
            checked={f.scheduledOrders}
            onChange={(scheduledOrders) => set({ scheduledOrders })}
          />
          <TextField
            label="Tiempo de preparación (minutos)"
            type="number"
            min={0}
            max={240}
            value={f.prep}
            onChange={(e) => set({ prep: Number(e.target.value) })}
            hint="Se usa para la hora estimada y la primera hora programable."
          />
        </Card>
        <div className="stack">
          <Card title="Servicios">
            <Toggle label="Recogida en el local" checked={f.pickup} onChange={(pickup) => set({ pickup })} />
            <Toggle
              label="Reparto a domicilio"
              hint="Configura las zonas en la pestaña «Reparto»."
              checked={f.delivery}
              onChange={(delivery) => set({ delivery })}
            />
            <Toggle label="Consumo en el local" checked={f.dineIn} onChange={(dineIn) => set({ dineIn })} />
          </Card>
          <Card title="Métodos de pago">
            <Toggle label="Efectivo" hint="Al recoger o al recibir el pedido" checked={f.cash} onChange={(cash) => set({ cash })} />
            <Toggle
              label="Tarjeta online (Stripe)"
              hint="Requiere las claves de Stripe en Ajustes → Pagos."
              checked={f.card}
              onChange={(card) => set({ card })}
            />
            <p className="muted small">Bizum no está disponible hasta configurar un proveedor real.</p>
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
        title="Zonas de reparto"
        actions={
          <Button
            size="sm"
            icon="plus"
            onClick={() => setZones([...zones, { name: '', postcodes: [], feeCents: 0, minOrderCents: 0, etaMinutes: 45, active: true }])}
          >
            Añadir zona
          </Button>
        }
      >
        <div className="stack">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {!b.services.delivery ? (
            <Alert tone="info">El reparto está desactivado en «Pedidos y pagos». Puedes preparar las zonas antes de activarlo.</Alert>
          ) : null}
          {zones.length === 0 ? <p className="muted">Sin zonas. El reparto solo se ofrece en los códigos postales de una zona activa.</p> : null}
          {zones.map((z, i) => (
            <div key={i} className="card" style={{ background: 'var(--surface-2)' }}>
              <div className="grid-4">
                <TextField label="Nombre de la zona" value={z.name} onChange={(e) => setZone(i, { name: e.target.value })} />
                <MoneyInput label="Gastos de envío" cents={z.feeCents} onChange={(feeCents) => setZone(i, { feeCents })} />
                <MoneyInput label="Pedido mínimo" cents={z.minOrderCents} onChange={(minOrderCents) => setZone(i, { minOrderCents })} />
                <TextField
                  label="Tiempo estimado (min)"
                  type="number"
                  min={5}
                  max={240}
                  value={z.etaMinutes}
                  onChange={(e) => setZone(i, { etaMinutes: Number(e.target.value) })}
                />
              </div>
              <Field label="Códigos postales" hint="Separados por comas o espacios (5 cifras).">
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
                  Zona activa
                </label>
                <span className="muted small">
                  {z.postcodes.length} CP · envío {formatEur(z.feeCents)} · mínimo {formatEur(z.minOrderCents)}
                </span>
                <Button size="sm" variant="ghost" icon="trash" onClick={() => setZones(zones.filter((_, j) => j !== i))}>
                  Quitar
                </Button>
              </div>
            </div>
          ))}
          <Toggle
            label="El repartidor debe aceptar cada entrega"
            hint="Si se desactiva, el pedido queda aceptado al asignarlo."
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
  const { can } = useAuth();
  const { save, busy, error } = useBranchSave(b.id, onSaved);
  const [f, setF] = useState(b.reservations);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const ro = !can('branch:write');
  return (
    <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0 }}>
      <Card title="Reservas online">
        <div className="stack">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {b.readiness.reservations.length ? <Alert tone="warning">Falta: {b.readiness.reservations.map(readinessLabel).join(', ')}</Alert> : null}
          <Toggle
            label="Aceptar reservas online"
            hint="Se confirman automáticamente hasta la capacidad indicada."
            checked={f.enabled}
            onChange={(enabled) => set({ enabled })}
          />
          <div className="grid-3">
            <TextField
              label="Comensales por franja"
              type="number"
              min={0}
              max={500}
              value={f.capacityPerSlot}
              onChange={(e) => set({ capacityPerSlot: Number(e.target.value) })}
            />
            <TextField
              label="Duración de la franja (min)"
              type="number"
              min={15}
              max={120}
              step={15}
              value={f.slotMinutes}
              onChange={(e) => set({ slotMinutes: Number(e.target.value) })}
            />
            <TextField
              label="Máx. personas por reserva"
              type="number"
              min={1}
              max={50}
              value={f.maxPartySize}
              onChange={(e) => set({ maxPartySize: Number(e.target.value) })}
            />
            <TextField
              label="Antelación mínima (min)"
              type="number"
              min={0}
              value={f.minLeadMinutes}
              onChange={(e) => set({ minLeadMinutes: Number(e.target.value) })}
            />
            <TextField
              label="Días máximos de antelación"
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
