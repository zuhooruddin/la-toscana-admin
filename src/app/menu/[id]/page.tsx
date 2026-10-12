'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { GroupEditor, ImageInput, LocInput, MoneyInput } from '@/components/forms';
import { useFeedback } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/Icon';
import { Alert, Button, Card, Field, PageHeader, SelectField, Spinner, TextField, Toggle } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/lib/format';
import { ALLERGENS, type Category, type MenuItem, type ModifierGroupDoc } from '@/lib/types';
import { useResource } from '@/lib/use-resource';
import { emptyItem, toBody, validate, type Draft } from './item-form';

export default function ItemEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const item = useResource<{ item: MenuItem }>(isNew ? null : `/api/v1/admin/menu/items/${id}`);
  const cats = useResource<{ items: Category[] }>('/api/v1/admin/menu/categories');
  const groups = useResource<{ items: ModifierGroupDoc[] }>('/api/v1/admin/menu/modifier-groups');
  if (!isNew && !item.data) return item.error ? <Alert tone="danger">{errorText(item.error)}</Alert> : <Spinner />;
  if (!cats.data || !groups.data) return <Spinner />;
  return (
    <Editor
      key={isNew ? 'new' : item.data!.item._id}
      initial={isNew ? emptyItem(cats.data.items[0]?.key) : item.data!.item}
      isNew={isNew}
      categories={cats.data.items}
      shared={groups.data.items}
    />
  );
}

function Editor({ initial, isNew, categories, shared }: { initial: Draft; isNew: boolean; categories: Category[]; shared: ModifierGroupDoc[] }) {
  const router = useRouter();
  const { can } = useAuth();
  const { toast } = useFeedback();
  const [d, setD] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const readOnly = !can('menu:write');
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  async function save() {
    const errs = validate(d);
    setErrors(errs);
    if (errs.length) return window.scrollTo({ top: 0, behavior: 'smooth' });
    setSaving(true);
    try {
      const body = toBody(d, isNew);
      const r = isNew
        ? await api<{ item: MenuItem }>('/api/v1/admin/menu/items', { method: 'POST', body })
        : await api<{ item: MenuItem }>(`/api/v1/admin/menu/items/${d._id}`, { method: 'PATCH', body });
      toast(isNew ? 'Producto creado' : 'Cambios guardados');
      if (isNew) router.replace(`/menu/${r.item._id}`);
      else setD(r.item);
    } catch (e) {
      setErrors([errorText(e)]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        back={
          <Link href="/menu" className="back-link">
            <Icon name="left" size={15} /> Productos
          </Link>
        }
        title={isNew ? 'Nuevo producto' : d.name.es || 'Producto'}
        subtitle={d.source?.name ? `Carta PDF: «${d.source.name}» ${d.source.price ?? ''}` : undefined}
      />
      {errors.length ? (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="danger" title="No se ha podido guardar">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert>
        </div>
      ) : null}
      {readOnly ? (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="info">Solo lectura: tu rol no puede editar la carta.</Alert>
        </div>
      ) : null}
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', alignItems: 'start' }}>
          <div className="stack">
            <Card title="Información">
              <div className="stack">
                <LocInput label="Nombre" value={d.name} onChange={(name) => set({ name })} required maxLength={120} />
                <LocInput label="Descripción" value={d.description} onChange={(description) => set({ description })} multiline maxLength={600} />
                <div className="grid-3">
                  <SelectField label="Categoría" value={d.categoryKey} onChange={(e) => set({ categoryKey: e.target.value })}>
                    {categories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.name.es}
                      </option>
                    ))}
                  </SelectField>
                  <MoneyInput
                    label={d.kind === 'pasta' ? 'Precio base (pasta normal)' : 'Precio (IVA incl.)'}
                    cents={d.priceCents}
                    onChange={(priceCents) => set({ priceCents })}
                  />
                  <SelectField label="IVA" value={String(d.taxRateBps)} onChange={(e) => set({ taxRateBps: Number(e.target.value) })}>
                    <option value="1000">10 % (comida)</option>
                    <option value="2100">21 %</option>
                    <option value="400">4 %</option>
                  </SelectField>
                </div>
                <TextField
                  label="Orden dentro de la categoría"
                  type="number"
                  value={d.order}
                  onChange={(e) => set({ order: Number(e.target.value) })}
                  hint="Número menor = aparece antes."
                />
              </div>
            </Card>

            <Card
              title="Opciones del producto"
              actions={
                <Button
                  size="sm"
                  icon="plus"
                  onClick={() => set({ optionGroups: [...d.optionGroups, { key: '', name: { es: '' }, min: 0, max: 1, published: true, choices: [] }] })}
                >
                  Añadir grupo
                </Button>
              }
            >
              <div className="stack">
                {d.optionGroups.length === 0 ? <p className="muted">Sin opciones propias. Por ejemplo: tamaño, sabor, punto de la carne.</p> : null}
                {d.optionGroups.map((g, i) => (
                  <GroupEditor
                    key={i}
                    group={g}
                    lockKey={!isNew && Boolean(initial.optionGroups[i]?.key)}
                    onChange={(ng) => set({ optionGroups: d.optionGroups.map((x, j) => (j === i ? ng : x)) })}
                    onRemove={() => set({ optionGroups: d.optionGroups.filter((_, j) => j !== i) })}
                  />
                ))}
              </div>
            </Card>

            <Card title="Extras compartidos">
              <p className="muted small" style={{ marginBottom: 10 }}>
                Grupos que se usan en varios productos (suplementos de pizza, patatas…). Se editan en «Extras y opciones».
              </p>
              <div className="stack" style={{ gap: 6 }}>
                {shared.map((s) => (
                  <label key={s.key} className="checkbox">
                    <input
                      type="checkbox"
                      checked={d.sharedGroupKeys.includes(s.key)}
                      onChange={(e) =>
                        set({ sharedGroupKeys: e.target.checked ? [...d.sharedGroupKeys, s.key] : d.sharedGroupKeys.filter((k) => k !== s.key) })
                      }
                    />
                    {s.group.name.es}{' '}
                    <span className="muted small">
                      ({s.group.choices.length} opciones{s.group.published === false ? ', oculto' : ''})
                    </span>
                  </label>
                ))}
              </div>
            </Card>
          </div>

          <div className="stack">
            <Card title="Visibilidad">
              <Toggle label="Visible en la carta" hint="Web y apps" checked={d.published} onChange={(published) => set({ published })} />
              <Toggle
                label="Se puede pedir online"
                hint="Si no, se muestra como «solo en el local»"
                checked={d.orderable}
                onChange={(orderable) => set({ orderable })}
              />
              {!d.orderable ? (
                <LocInput label="Nota para el cliente" value={d.orderableNote} onChange={(orderableNote) => set({ orderableNote })} maxLength={200} />
              ) : null}
            </Card>
            <Card title="Foto">
              <div className="stack">
                <ImageInput
                  label="Foto del plato"
                  value={d.imageIsPlaceholder ? null : d.imageUrl}
                  onChange={(imageUrl) => set({ imageUrl, imageIsPlaceholder: !imageUrl })}
                  hint="Usa una foto real del plato. Se convierte a WebP y se eliminan los datos EXIF."
                />
                <LocInput
                  label="Texto alternativo"
                  value={d.imageAlt}
                  onChange={(imageAlt) => set({ imageAlt })}
                  maxLength={200}
                  hint="Describe la foto para lectores de pantalla."
                />
              </div>
            </Card>
            <Card title="Alérgenos">
              <Field label="Contiene">
                <div className="grid-2" style={{ gap: 6 }}>
                  {ALLERGENS.map((a) => (
                    <label key={a.key} className="checkbox small">
                      <input
                        type="checkbox"
                        checked={d.allergens.includes(a.key)}
                        onChange={(e) => set({ allergens: e.target.checked ? [...d.allergens, a.key] : d.allergens.filter((x) => x !== a.key) })}
                      />
                      {a.label}
                    </label>
                  ))}
                </div>
              </Field>
              <Toggle
                label="Información de alérgenos verificada"
                hint="Mientras no esté verificada, la web pide al cliente que consulte al personal."
                checked={d.allergensVerified}
                onChange={(allergensVerified) => set({ allergensVerified })}
              />
            </Card>
          </div>
        </div>
      </fieldset>
      {!readOnly ? (
        <div className="sticky-actions">
          <Link href="/menu" className="btn btn-ghost btn-md">
            Cancelar
          </Link>
          <Button variant="primary" icon="check" loading={saving} onClick={() => void save()}>
            {isNew ? 'Crear producto' : 'Guardar cambios'}
          </Button>
        </div>
      ) : null}
    </>
  );
}
