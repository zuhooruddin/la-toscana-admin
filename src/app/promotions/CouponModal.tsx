'use client';

import { useState } from 'react';
import { LocInput, MoneyInput } from '@/components/forms';
import { useFeedback } from '@/components/ui/feedback';
import { Alert, Button, Field, Modal, SelectField, TextField, Toggle } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { errorText } from '@/lib/format';
import type { Loc } from '@/lib/types';

export interface Coupon {
  _id: string;
  code: string;
  name?: Loc;
  description?: Loc;
  type: 'percent' | 'fixed';
  percentBps?: number;
  amountCents?: number;
  maxDiscountCents?: number;
  minSubtotalCents: number;
  validFrom?: string;
  validTo?: string;
  maxRedemptions?: number;
  redemptions?: number;
  branchIds: string[];
  fulfilment: 'any' | 'pickup' | 'delivery';
  active: boolean;
  public: boolean;
}

const dateInput = (iso?: string) => (iso ? iso.slice(0, 10) : '');

/** New coupons: every field. Existing coupons: the API only allows name, text, dates, limit and visibility (terms are fixed once issued). */
export function CouponModal({ coupon, onClose, onSaved }: { coupon: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const { me } = useAuth();
  const { branches } = useBranches();
  const { toast } = useFeedback();
  const isNew = !coupon;
  const [f, setF] = useState({
    code: coupon?.code ?? '',
    name: coupon?.name ?? ({ es: '' } as Loc),
    description: coupon?.description ?? ({ es: '' } as Loc),
    type: coupon?.type ?? 'percent',
    percent: String((coupon?.percentBps ?? 1000) / 100),
    amountCents: coupon?.amountCents ?? 500,
    maxDiscountCents: coupon?.maxDiscountCents ?? 0,
    minSubtotalCents: coupon?.minSubtotalCents ?? 0,
    validFrom: dateInput(coupon?.validFrom),
    validTo: dateInput(coupon?.validTo),
    maxRedemptions: coupon?.maxRedemptions ? String(coupon.maxRedemptions) : '',
    branchIds: coupon?.branchIds ?? (me?.role === 'owner' ? [] : (me?.branchIds ?? [])),
    fulfilment: coupon?.fulfilment ?? 'any',
    active: coupon?.active ?? false,
    public: coupon?.public ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const endOfDay = (d: string) => (d ? new Date(`${d}T23:59:59`).toISOString() : undefined);

  async function save() {
    const pct = Number(f.percent.replace(',', '.'));
    if (isNew && !/^[A-Z0-9-]{3,40}$/.test(f.code)) return setError('El código debe tener 3–40 letras, números o guiones.');
    if (!f.name.es?.trim()) return setError('Pon un nombre a la promoción.');
    if (isNew && f.type === 'percent' && !(pct > 0 && pct <= 100)) return setError('Porcentaje entre 1 y 100.');
    setBusy(true);
    setError(null);
    try {
      const loc = (l: Loc) => ({ es: l.es ?? '', ...(l.en ? { en: l.en } : {}) });
      const maxRed = f.maxRedemptions ? Number(f.maxRedemptions) : null;
      if (isNew) {
        await api('/api/v1/admin/promotions', {
          method: 'POST',
          body: {
            code: f.code,
            name: loc(f.name),
            description: loc(f.description),
            type: f.type,
            ...(f.type === 'percent' ? { percentBps: Math.round(pct * 100) } : { amountCents: f.amountCents }),
            ...(f.maxDiscountCents ? { maxDiscountCents: f.maxDiscountCents } : {}),
            minSubtotalCents: f.minSubtotalCents,
            ...(f.validFrom ? { validFrom: new Date(`${f.validFrom}T00:00:00`).toISOString() } : {}),
            ...(f.validTo ? { validTo: endOfDay(f.validTo) } : {}),
            ...(maxRed ? { maxRedemptions: maxRed } : {}),
            branchIds: f.branchIds,
            fulfilment: f.fulfilment,
            active: f.active,
            public: f.public,
          },
        });
      } else {
        await api(`/api/v1/admin/promotions/${coupon!._id}`, {
          method: 'PATCH',
          body: {
            name: loc(f.name),
            description: loc(f.description),
            active: f.active,
            public: f.public,
            validTo: f.validTo ? endOfDay(f.validTo) : null,
            maxRedemptions: maxRed,
          },
        });
      }
      toast(isNew ? `Código ${f.code} creado` : 'Promoción guardada');
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Nuevo código promocional' : `Editar ${coupon!.code}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="stack">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {!isNew ? (
          <Alert tone="info">
            El tipo de descuento, el importe y las condiciones no se pueden cambiar una vez creado el código. Crea uno nuevo si necesitas otras condiciones.
          </Alert>
        ) : null}
        <TextField
          label="Código"
          value={f.code}
          disabled={!isNew}
          onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })}
          hint="Lo que escribe el cliente, ej. BIENVENIDA10"
          required
        />
        <LocInput label="Nombre" value={f.name} onChange={(name) => set({ name })} required maxLength={120} />
        <LocInput label="Descripción" value={f.description} onChange={(description) => set({ description })} multiline maxLength={300} />
        <fieldset disabled={!isNew} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
          <div className="grid-3">
            <SelectField label="Tipo" value={f.type} onChange={(e) => set({ type: e.target.value as 'percent' | 'fixed' })}>
              <option value="percent">Porcentaje</option>
              <option value="fixed">Importe fijo</option>
            </SelectField>
            {f.type === 'percent' ? (
              <TextField label="Porcentaje (%)" inputMode="decimal" value={f.percent} onChange={(e) => set({ percent: e.target.value })} />
            ) : (
              <MoneyInput label="Descuento" cents={f.amountCents} onChange={(amountCents) => set({ amountCents })} />
            )}
            {f.type === 'percent' ? (
              <MoneyInput label="Descuento máximo (0 = sin límite)" cents={f.maxDiscountCents} onChange={(maxDiscountCents) => set({ maxDiscountCents })} />
            ) : (
              <span />
            )}
          </div>
          <div className="grid-3">
            <MoneyInput label="Pedido mínimo" cents={f.minSubtotalCents} onChange={(minSubtotalCents) => set({ minSubtotalCents })} />
            <SelectField label="Válido para" value={f.fulfilment} onChange={(e) => set({ fulfilment: e.target.value as typeof f.fulfilment })}>
              <option value="any">Recogida y reparto</option>
              <option value="pickup">Solo recogida</option>
              <option value="delivery">Solo reparto</option>
            </SelectField>
            <TextField label="Válido desde" type="date" value={f.validFrom} onChange={(e) => set({ validFrom: e.target.value })} />
          </div>
          <Field label="Restaurantes" hint={me?.role === 'owner' ? 'Ninguno marcado = todos los restaurantes.' : undefined}>
            <div className="row">
              {branches.map((b) => (
                <label key={b.id} className="checkbox">
                  <input
                    type="checkbox"
                    checked={f.branchIds.includes(b.id)}
                    onChange={(e) => set({ branchIds: e.target.checked ? [...f.branchIds, b.id] : f.branchIds.filter((x) => x !== b.id) })}
                  />
                  {b.name}
                </label>
              ))}
            </div>
          </Field>
        </fieldset>
        <div className="grid-2">
          <TextField label="Válido hasta" type="date" value={f.validTo} onChange={(e) => set({ validTo: e.target.value })} />
          <TextField
            label="Usos máximos (vacío = ilimitado)"
            type="number"
            min={1}
            value={f.maxRedemptions}
            onChange={(e) => set({ maxRedemptions: e.target.value })}
          />
        </div>
        <Toggle label="Activo" hint="Los clientes pueden usar el código." checked={f.active} onChange={(active) => set({ active })} />
        <Toggle label="Mostrar en la página de ofertas" checked={f.public} onChange={(p) => set({ public: p })} />
      </div>
    </Modal>
  );
}
