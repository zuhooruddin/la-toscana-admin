'use client';

import { useId, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { config } from '@/lib/config';
import { centsToInput, errorText, formatEur, parseEur } from '@/lib/format';
import { useT } from '@/lib/i18n';
import type { Choice, Loc, OptionGroup } from '@/lib/types';
import { Icon } from './ui/Icon';
import { Button, Field } from './ui/kit';

/** Turns a stored image reference (/uploads/…, /static/… or absolute) into a URL the browser can load. */
export const imageSrc = (ref?: string | null) => (!ref ? null : /^https?:\/\//i.test(ref) ? ref : `${config.apiUrl}${ref.startsWith('/') ? '' : '/'}${ref}`);

export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

/** Spanish (required) + English (optional) text pair. */
export function LocInput({
  label,
  value,
  onChange,
  multiline,
  required,
  maxLength = 2000,
  hint,
  error,
}: {
  label: string;
  value: Loc | undefined;
  onChange: (v: Loc) => void;
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
  hint?: string;
  error?: string | null;
}) {
  const t = useT();
  const id = useId();
  const v = value ?? {};
  const Input = multiline ? 'textarea' : 'input';
  return (
    <Field label={label} hint={hint} error={error} htmlFor={`${id}-es`} required={required}>
      <div className="grid-2" style={{ gap: 8 }}>
        <div className="field" style={{ gap: 2 }}>
          <span className="muted small">{t('Español', 'Spanish')}</span>
          <Input
            id={`${id}-es`}
            className="input"
            value={v.es ?? ''}
            maxLength={maxLength}
            onChange={(e) => onChange({ ...v, es: e.target.value })}
            aria-invalid={error ? true : undefined}
          />
        </div>
        <div className="field" style={{ gap: 2 }}>
          <span className="muted small">{t('Inglés (opcional)', 'English (optional)')}</span>
          <Input
            id={`${id}-en`}
            aria-label={`${label} (English)`}
            className="input"
            value={v.en ?? ''}
            maxLength={maxLength}
            onChange={(e) => onChange({ ...v, en: e.target.value })}
          />
        </div>
      </div>
    </Field>
  );
}

/** Euro amount input that keeps cents as the source of truth. */
export function MoneyInput({
  label,
  cents,
  onChange,
  allowNegative,
  hint,
}: {
  label: string;
  cents: number;
  onChange: (c: number) => void;
  allowNegative?: boolean;
  hint?: string;
}) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState(centsToInput(Math.abs(cents)));
  const [neg, setNeg] = useState(cents < 0);
  const parsed = parseEur(text);
  return (
    <Field label={label} htmlFor={id} hint={hint} error={parsed === null ? t('Importe no válido (ej. 12,50)', 'Invalid amount (e.g. 12.50)') : null}>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        {allowNegative ? (
          <select
            className="input"
            style={{ width: 70 }}
            aria-label={t('Signo', 'Sign')}
            value={neg ? '-' : '+'}
            onChange={(e) => {
              const n = e.target.value === '-';
              setNeg(n);
              if (parsed !== null) onChange(n ? -parsed : parsed);
            }}
          >
            <option value="+">+</option>
            <option value="-">−</option>
          </select>
        ) : null}
        <input
          id={id}
          className="input"
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const p = parseEur(e.target.value);
            if (p !== null) onChange(neg ? -p : p);
          }}
          aria-invalid={parsed === null ? true : undefined}
        />
        <span className="muted">€</span>
      </div>
    </Field>
  );
}

/** Upload an image to the API (re-encoded to WebP, EXIF stripped) and return its host-independent path. */
export function ImageInput({
  label,
  value,
  onChange,
  purpose = 'menu',
  hint,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  purpose?: 'menu' | 'banner' | 'logo' | 'page';
  hint?: string;
}) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = imageSrc(value);
  async function upload(file: File) {
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError(t('Solo imágenes JPG, PNG o WebP.', 'Only JPG, PNG or WebP images.'));
    if (file.size > 8 * 1024 * 1024) return setError(t('La imagen supera 8 MB.', 'The image exceeds 8 MB.'));
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api<{ path: string; url: string }>(`/api/v1/admin/uploads/images?purpose=${purpose}`, { method: 'POST', form });
      onChange(r.path ?? r.url);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="image-input">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- image served by the API
          <img className="preview" src={src} alt="" />
        ) : (
          <span className="preview-ph" aria-hidden="true">
            <Icon name="image" size={26} />
          </span>
        )}
        <div className="stack" style={{ gap: 8 }}>
          <input
            ref={ref}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
          />
          <Button size="sm" icon="upload" loading={busy} onClick={() => ref.current?.click()}>
            {src ? t('Cambiar imagen', 'Change image') : t('Subir imagen', 'Upload image')}
          </Button>
          {src ? (
            <Button size="sm" variant="ghost" icon="trash" onClick={() => onChange(null)}>
              {t('Quitar', 'Remove')}
            </Button>
          ) : null}
        </div>
      </div>
    </Field>
  );
}

/** Editor for one option group (min/max, choices with price deltas). */
export function GroupEditor({
  group,
  onChange,
  onRemove,
  lockKey,
}: {
  group: OptionGroup;
  onChange: (g: OptionGroup) => void;
  onRemove?: () => void;
  lockKey?: boolean;
}) {
  const t = useT();
  const set = (patch: Partial<OptionGroup>) => onChange({ ...group, ...patch });
  const setChoice = (i: number, patch: Partial<Choice>) => set({ choices: group.choices.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const invalid = group.min > group.max ? t('El mínimo no puede ser mayor que el máximo', 'The minimum cannot be greater than the maximum') : null;
  return (
    <div className="card" style={{ background: 'var(--surface-2)' }}>
      <div className="stack">
        <div className="row-between">
          <strong>{group.name.es || t('Nuevo grupo', 'New group')}</strong>
          {onRemove ? (
            <Button size="sm" variant="ghost" icon="trash" onClick={onRemove}>
              {t('Quitar grupo', 'Remove group')}
            </Button>
          ) : null}
        </div>
        <LocInput
          label={t('Nombre del grupo', 'Group name')}
          value={group.name}
          onChange={(name) => set({ name, ...(lockKey || group.key ? {} : { key: slugify(name.es ?? '') }) })}
          required
          maxLength={80}
        />
        <div className="grid-3">
          <Field label={t('Clave interna', 'Internal key')} hint={t('Minúsculas y guiones; no se puede cambiar después.', 'Lowercase and hyphens; cannot be changed later.')}>
            <input className="input" value={group.key} disabled={lockKey} onChange={(e) => set({ key: slugify(e.target.value) })} />
          </Field>
          <Field label={t('Mínimo a elegir', 'Minimum to choose')} error={invalid}>
            <input className="input" type="number" min={0} max={20} value={group.min} onChange={(e) => set({ min: Math.max(0, Number(e.target.value)) })} />
          </Field>
          <Field label={t('Máximo a elegir', 'Maximum to choose')}>
            <input className="input" type="number" min={1} max={20} value={group.max} onChange={(e) => set({ max: Math.max(1, Number(e.target.value)) })} />
          </Field>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={group.published !== false} onChange={(e) => set({ published: e.target.checked })} />
          {t('Visible para los clientes', 'Visible to customers')}
        </label>
        <p className="section-title">{t('Opciones', 'Options')} ({group.choices.length})</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('Nombre (es)', 'Name (es)')}</th>
                <th>{t('Nombre (en)', 'Name (en)')}</th>
                <th>{t('Precio extra', 'Extra price')}</th>
                <th>{t('Disponible', 'Available')}</th>
                <th aria-label={t('Acciones', 'Actions')} />
              </tr>
            </thead>
            <tbody>
              {group.choices.map((c, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className="input"
                      aria-label={t('Nombre en español', 'Name in Spanish')}
                      value={c.name.es ?? ''}
                      onChange={(e) => setChoice(i, { name: { ...c.name, es: e.target.value }, ...(c.key ? {} : { key: slugify(e.target.value) }) })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      aria-label={t('Nombre en inglés', 'Name in English')}
                      value={c.name.en ?? ''}
                      onChange={(e) => setChoice(i, { name: { ...c.name, en: e.target.value } })}
                    />
                  </td>
                  <td style={{ minWidth: 120 }}>
                    <ChoicePrice cents={c.priceDeltaCents} onChange={(v) => setChoice(i, { priceDeltaCents: v })} />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={t('Disponible', 'Available')}
                      checked={c.available !== false && c.status !== 'draft'}
                      onChange={(e) => setChoice(i, { available: e.target.checked, status: 'active' })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`${t('Quitar', 'Remove')} ${c.name.es}`}
                      onClick={() => set({ choices: group.choices.filter((_, j) => j !== i) })}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <Button
            size="sm"
            icon="plus"
            onClick={() => set({ choices: [...group.choices, { key: '', name: { es: '' }, priceDeltaCents: 0, available: true, status: 'active' }] })}
          >
            {t('Añadir opción', 'Add option')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChoicePrice({ cents, onChange }: { cents: number; onChange: (c: number) => void }) {
  const t = useT();
  const [text, setText] = useState(centsToInput(cents));
  const p = parseEur(text);
  return (
    <input
      className="input"
      aria-label={t('Precio extra en euros', 'Extra price in euros')}
      inputMode="decimal"
      value={text}
      title={p === null ? t('Importe no válido', 'Invalid amount') : formatEur(p)}
      aria-invalid={p === null ? true : undefined}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseEur(e.target.value);
        if (v !== null) onChange(v);
      }}
    />
  );
}

/** Strip UI-only fields and drop empty choices before sending a group to the API. */
export function cleanGroup(g: OptionGroup): OptionGroup {
  return {
    key: g.key,
    name: { es: g.name.es ?? '', ...(g.name.en ? { en: g.name.en } : {}) },
    min: g.min,
    max: g.max,
    ...(g.warning?.es || g.warning?.en ? { warning: { es: g.warning.es ?? '', ...(g.warning.en ? { en: g.warning.en } : {}) } } : {}),
    published: g.published !== false,
    ...(g.note ? { note: g.note } : {}),
    ...(g.maxByChoice?.groupKey ? { maxByChoice: g.maxByChoice } : {}),
    choices: g.choices
      .filter((c) => (c.name.es ?? '').trim())
      .map((c) => ({
        key: c.key || slugify(c.name.es ?? ''),
        name: { es: c.name.es ?? '', ...(c.name.en ? { en: c.name.en } : {}) },
        priceDeltaCents: c.priceDeltaCents,
        available: c.available !== false,
        status: c.status === 'draft' ? 'draft' : 'active',
        ...(c.needsConfirmation ? { needsConfirmation: true } : {}),
        ...(c.imageUrl ? { imageUrl: c.imageUrl } : {}),
        ...(c.sourceText ? { sourceText: c.sourceText } : {}),
      })),
  };
}
