'use client';

import { useState } from 'react';
import { ImageInput, imageSrc, LocInput, slugify } from '@/components/forms';
import { useFeedback } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/Icon';
import { Alert, Badge, Button, Card, Empty, Modal, PageHeader, Spinner, TextField, Toggle } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/lib/format';
import type { Category, Loc, MenuItem } from '@/lib/types';
import { useResource } from '@/lib/use-resource';

type Draft = { _id?: string; key: string; name: Loc; description: Loc; order: number; published: boolean; imageUrl: string | null };

export default function CategoriesPage() {
  const { can } = useAuth();
  const cats = useResource<{ items: Category[] }>('/api/v1/admin/menu/categories');
  const items = useResource<{ items: MenuItem[] }>('/api/v1/admin/menu/items');
  const [edit, setEdit] = useState<Draft | null>(null);
  const counts = new Map<string, number>();
  for (const i of items.data?.items ?? []) counts.set(i.categoryKey, (counts.get(i.categoryKey) ?? 0) + 1);
  const list = [...(cats.data?.items ?? [])].sort((a, b) => a.order - b.order);
  const nextOrder = list.length ? Math.max(...list.map((c) => c.order)) + 1 : 0;

  return (
    <>
      <PageHeader
        title="Categorías"
        subtitle="Secciones de la carta en la web y las apps"
        actions={
          can('menu:write') ? (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => setEdit({ key: '', name: { es: '' }, description: { es: '' }, order: nextOrder, published: false, imageUrl: null })}
            >
              Nueva categoría
            </Button>
          ) : null
        }
      />
      {cats.error ? <Alert tone="danger">{errorText(cats.error)}</Alert> : null}
      <Card padded={false}>
        {cats.loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty icon="layers" title="Todavía no hay categorías" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Categoría</th>
                  <th className="num">Productos</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const src = imageSrc(c.imageUrl);
                  return (
                    <tr key={c._id}>
                      <td className="mono">{c.order}</td>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element -- API image
                            <img className="thumb" src={src} alt="" />
                          ) : (
                            <span className="thumb-ph" aria-hidden="true">
                              <Icon name="image" />
                            </span>
                          )}
                          <div>
                            <strong>{c.name.es}</strong>
                            <div className="muted small">
                              {c.name.en ?? ''} · {c.key}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="num">{counts.get(c.key) ?? 0}</td>
                      <td>{c.published ? <Badge tone="green">Visible</Badge> : <Badge tone="grey">Oculta</Badge>}</td>
                      <td className="num">
                        {can('menu:write') ? (
                          <Button
                            size="sm"
                            icon="edit"
                            onClick={() =>
                              setEdit({
                                _id: c._id,
                                key: c.key,
                                name: c.name,
                                description: c.description ?? { es: '' },
                                order: c.order,
                                published: c.published,
                                imageUrl: c.imageUrl ?? null,
                              })
                            }
                          >
                            Editar
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {edit ? <CategoryModal draft={edit} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), cats.reload())} /> : null}
    </>
  );
}

function CategoryModal({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const { toast } = useFeedback();
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = !d._id;
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  async function save() {
    if (!d.name.es?.trim()) return setError('El nombre en español es obligatorio.');
    const key = d.key || slugify(d.name.es);
    setBusy(true);
    setError(null);
    try {
      const loc = (l: Loc) => ({ es: l.es ?? '', ...(l.en ? { en: l.en } : {}) });
      if (isNew) {
        const r = await api<{ category: Category }>('/api/v1/admin/menu/categories', {
          method: 'POST',
          body: { key, name: loc(d.name), description: loc(d.description), order: d.order, published: d.published },
        });
        if (d.imageUrl) await api(`/api/v1/admin/menu/categories/${r.category._id}`, { method: 'PATCH', body: { imageUrl: d.imageUrl } });
      } else {
        await api(`/api/v1/admin/menu/categories/${d._id}`, {
          method: 'PATCH',
          body: { name: loc(d.name), description: loc(d.description), order: d.order, published: d.published, imageUrl: d.imageUrl },
        });
      }
      toast(isNew ? 'Categoría creada' : 'Categoría guardada');
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
      title={isNew ? 'Nueva categoría' : `Editar «${draft.name.es}»`}
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
        <LocInput label="Nombre" value={d.name} onChange={(name) => set({ name, ...(isNew ? { key: slugify(name.es ?? '') } : {}) })} required maxLength={80} />
        <LocInput label="Descripción" value={d.description} onChange={(description) => set({ description })} multiline maxLength={300} />
        <div className="grid-2">
          <TextField
            label="Clave (URL)"
            value={d.key}
            disabled={!isNew}
            onChange={(e) => set({ key: slugify(e.target.value) })}
            hint={isNew ? 'Se usa en la dirección: /carta#cat-clave' : 'No se puede cambiar.'}
          />
          <TextField label="Orden" type="number" value={d.order} onChange={(e) => set({ order: Number(e.target.value) })} />
        </div>
        <ImageInput label="Imagen de la categoría" value={d.imageUrl} onChange={(imageUrl) => set({ imageUrl })} />
        <Toggle label="Visible en la carta" checked={d.published} onChange={(published) => set({ published })} />
      </div>
    </Modal>
  );
}
