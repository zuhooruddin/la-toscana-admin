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
import { useT } from '@/lib/i18n';

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
  const t = useT();
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
    if (isNew && !/^[A-Z0-9-]{3,40}$/.test(f.code))
      return setError(t('El código debe tener 3–40 letras, números o guiones.', 'The code must be 3–40 letters, numbers or hyphens.'));
    if (!f.name.es?.trim()) return setError(t('Pon un nombre a la promoción.', 'Give the promotion a name.'));
    if (isNew && f.type === 'percent' && !(pct > 0 && pct <= 100)) return setError(t('Porcentaje entre 1 y 100.', 'Percentage between 1 and 100.'));
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
      toast(isNew ? t(`Código ${f.code} creado`, `Code ${f.code} created`) : t('Promoción guardada', 'Promotion saved'));
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
      title={isNew ? t('Nuevo código promocional', 'New promo code') : `${t('Editar', 'Edit')} ${coupon!.code}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancelar', 'Cancel')}
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {t('Guardar', 'Save')}
          </Button>
        </>
      }
    >
      <div className="stack">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {!isNew ? (
          <Alert tone="info">
            {t(
              'El tipo de descuento, el importe y las condiciones no se pueden cambiar una vez creado el código. Crea uno nuevo si necesitas otras condiciones.',
              'The discount type, amount and conditions cannot be changed once the code is created. Create a new one if you need different conditions.',
            )}
          </Alert>
        ) : null}
        <TextField
          label={t('Código', 'Code')}
          value={f.code}
          disabled={!isNew}
          onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })}
          hint={t('Lo que escribe el cliente, ej. BIENVENIDA10', 'What the customer types, e.g. WELCOME10')}
          required
        />
        <LocInput label={t('Nombre', 'Name')} value={f.name} onChange={(name) => set({ name })} required maxLength={120} />
        <LocInput label={t('Descripción', 'Description')} value={f.description} onChange={(description) => set({ description })} multiline maxLength={300} />
        <fieldset disabled={!isNew} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
          <div className="grid-3">
            <SelectField label={t('Tipo', 'Type')} value={f.type} onChange={(e) => set({ type: e.target.value as 'percent' | 'fixed' })}>
              <option value="percent">{t('Porcentaje', 'Percentage')}</option>
              <option value="fixed">{t('Importe fijo', 'Fixed amount')}</option>
            </SelectField>
            {f.type === 'percent' ? (
              <TextField
                label={t('Porcentaje (%)', 'Percentage (%)')}
                inputMode="decimal"
                value={f.percent}
                onChange={(e) => set({ percent: e.target.value })}
              />
            ) : (
              <MoneyInput label={t('Descuento', 'Discount')} cents={f.amountCents} onChange={(amountCents) => set({ amountCents })} />
            )}
            {f.type === 'percent' ? (
              <MoneyInput
                label={t('Descuento máximo (0 = sin límite)', 'Maximum discount (0 = no limit)')}
                cents={f.maxDiscountCents}
                onChange={(maxDiscountCents) => set({ maxDiscountCents })}
              />
            ) : (
              <span />
            )}
          </div>
          <div className="grid-3">
            <MoneyInput label={t('Pedido mínimo', 'Minimum order')} cents={f.minSubtotalCents} onChange={(minSubtotalCents) => set({ minSubtotalCents })} />
            <SelectField
              label={t('Válido para', 'Valid for')}
              value={f.fulfilment}
              onChange={(e) => set({ fulfilment: e.target.value as typeof f.fulfilment })}
            >
              <option value="any">{t('Recogida y reparto', 'Pickup and delivery')}</option>
              <option value="pickup">{t('Solo recogida', 'Pickup only')}</option>
              <option value="delivery">{t('Solo reparto', 'Delivery only')}</option>
            </SelectField>
            <TextField label={t('Válido desde', 'Valid from')} type="date" value={f.validFrom} onChange={(e) => set({ validFrom: e.target.value })} />
          </div>
          <Field
            label={t('Restaurantes', 'Restaurants')}
            hint={me?.role === 'owner' ? t('Ninguno marcado = todos los restaurantes.', 'None selected = all restaurants.') : undefined}
          >
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
          <TextField label={t('Válido hasta', 'Valid until')} type="date" value={f.validTo} onChange={(e) => set({ validTo: e.target.value })} />
          <TextField
            label={t('Usos máximos (vacío = ilimitado)', 'Maximum uses (empty = unlimited)')}
            type="number"
            min={1}
            value={f.maxRedemptions}
            onChange={(e) => set({ maxRedemptions: e.target.value })}
          />
        </div>
        <Toggle
          label={t('Activo', 'Active')}
          hint={t('Los clientes pueden usar el código.', 'Customers can use the code.')}
          checked={f.active}
          onChange={(active) => set({ active })}
        />
        <Toggle label={t('Mostrar en la página de ofertas', 'Show on the offers page')} checked={f.public} onChange={(p) => set({ public: p })} />
      </div>
    </Modal>
  );
}
