'use client';

import { useState } from 'react';
import { ImageInput, imageSrc, LocInput, slugify } from '@/components/forms';
import { useFeedback } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/Icon';
import { MenuSummary } from '@/components/MenuSummary';
import { Alert, Badge, Button, Card, Empty, Modal, PageHeader, SearchInput, Spinner, TextField, Toggle } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/lib/format';
import type { Category, Loc, MenuItem } from '@/lib/types';
import { useResource } from '@/lib/use-resource';
import { useT } from '@/lib/i18n';
import '../menu.css';

type Draft = { _id?: string; key: string; name: Loc; description: Loc; order: number; published: boolean; imageUrl: string | null };

export default function CategoriesPage() {
  const t = useT();
  const { can } = useAuth();
  const cats = useResource<{ items: Category[] }>('/api/v1/admin/menu/categories');
  const items = useResource<{ items: MenuItem[] }>('/api/v1/admin/menu/items');
  const [edit, setEdit] = useState<Draft | null>(null);
  const { toast } = useFeedback();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('asc');
  const [reorder, setReorder] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const counts = new Map<string, number>();
  for (const i of items.data?.items ?? []) counts.set(i.categoryKey, (counts.get(i.categoryKey) ?? 0) + 1);
  const all = [...(cats.data?.items ?? [])].sort((a, b) => a.order - b.order);
  const list = all
    .filter(
      (c) =>
        (!status || c.published === (status === 'visible')) &&
        (!q || `${c.name.es} ${c.name.en ?? ''} ${c.key}`.toLocaleLowerCase().includes(q.toLocaleLowerCase())),
    )
    .sort((a, b) => (sort === 'name' ? (a.name.es ?? '').localeCompare(b.name.es ?? '') : (sort === 'desc' ? -1 : 1) * (a.order - b.order)));
  const nextOrder = all.length ? Math.max(...all.map((c) => c.order)) + 1 : 0;
  async function update(c: Category, body: { published?: boolean; order?: number }) {
    setBusy(c._id);
    try {
      await api(`/api/v1/admin/menu/categories/${c._id}`, { method: 'PATCH', body });
      cats.setData((d) => ({ items: d.items.map((item) => (item._id === c._id ? { ...item, ...body } : item)) }));
      toast(t('Categoría guardada', 'Category saved'));
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }
  async function move(c: Category, direction: number) {
    const index = all.findIndex((item) => item._id === c._id);
    if (!all[index + direction]) return;
    const reordered = [...all];
    reordered.splice(index, 1);
    reordered.splice(index + direction, 0, c);
    const changed: Category[] = [];
    setBusy(c._id);
    try {
      // The API accepts integer positions. Normalize the reordered list, including tied positions.
      for (const [order, item] of reordered.entries()) {
        if (item.order === order) continue;
        await api(`/api/v1/admin/menu/categories/${item._id}`, { method: 'PATCH', body: { order } });
        changed.push(item);
      }
      cats.setData((d) => ({ items: d.items.map((item) => ({ ...item, order: reordered.findIndex((category) => category._id === item._id) })) }));
      toast(t('Orden guardado', 'Order saved'));
    } catch (e) {
      for (const item of changed.reverse()) {
        await api(`/api/v1/admin/menu/categories/${item._id}`, { method: 'PATCH', body: { order: item.order } }).catch(() => undefined);
      }
      cats.reload();
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="menu-page categories-page">
      <PageHeader
        title={t('Categorías', 'Categories')}
        subtitle={t('Secciones de la carta en la web y las apps', 'Menu sections on the website and apps')}
        actions={
          can('menu:write') ? (
            <>
              <Button
                icon="layers"
                aria-pressed={reorder}
                onClick={() => {
                  setReorder(!reorder);
                  setSort('asc');
                }}
              >
                {t('Reordenar', 'Reorder')}
              </Button>
              <Button
                variant="primary"
                icon="plus"
                onClick={() => setEdit({ key: '', name: { es: '' }, description: { es: '' }, order: nextOrder, published: false, imageUrl: null })}
              >
                {t('Nueva categoría', 'New category')}
              </Button>
            </>
          ) : null
        }
      />
      {cats.error ? <Alert tone="danger">{errorText(cats.error)}</Alert> : null}
      {items.error ? <Alert tone="danger">{errorText(items.error)}</Alert> : null}
      <MenuSummary total={cats.data?.items.length} secondary={items.data?.items.length} visible={cats.data?.items.filter((c) => c.published).length} />
      <div className="menu-filter-bar">
        <SearchInput value={q} onChange={setQ} placeholder={t('Buscar categorías…', 'Search categories…')} />
        <span className="spacer" />
        <select className="input" aria-label={t('Estado de categorías', 'Category status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('Todos los estados', 'All status')}</option>
          <option value="visible">{t('Visible', 'Visible')}</option>
          <option value="hidden">{t('Oculta', 'Hidden')}</option>
        </select>
        <select
          className="input"
          aria-label={t('Ordenar categorías', 'Sort categories')}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          disabled={reorder}
        >
          <option value="asc">{t('Orden (ASC)', 'Order (ASC)')}</option>
          <option value="desc">{t('Orden (DESC)', 'Order (DESC)')}</option>
          <option value="name">{t('Nombre (A–Z)', 'Name (A–Z)')}</option>
        </select>
      </div>
      <Card padded={false}>
        {cats.loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty icon="layers" title={t('Todavía no hay categorías', 'No categories yet')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Orden', 'Order')}</th>
                  <th>{t('Categoría', 'Category')}</th>
                  <th className="num">{t('Productos', 'Products')}</th>
                  <th>{t('Estado', 'Status')}</th>
                  <th aria-label={t('Acciones', 'Actions')} />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const src = imageSrc(c.imageUrl);
                  return (
                    <tr key={c._id}>
                      <td className="mono">
                        <div className="menu-reorder">
                          {reorder ? (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={busy !== null || all[0]?._id === c._id}
                                onClick={() => move(c, -1)}
                                aria-label={t(`Subir ${c.name.es}`, `Move ${c.name.es} up`)}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={busy !== null || all[all.length - 1]?._id === c._id}
                                onClick={() => move(c, 1)}
                                aria-label={t(`Bajar ${c.name.es}`, `Move ${c.name.es} down`)}
                              >
                                ↓
                              </button>
                            </>
                          ) : null}
                          {c.order}
                        </div>
                      </td>
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
                      <td>
                        <div className="menu-status">
                          <button
                            type="button"
                            role="switch"
                            className="menu-switch"
                            aria-checked={c.published}
                            aria-label={t(`Visible: ${c.name.es}`, `Visible: ${c.name.es}`)}
                            disabled={!can('menu:write') || busy !== null}
                            onClick={() => void update(c, { published: !c.published })}
                          >
                            <span />
                          </button>
                          {c.published ? <Badge tone="green">{t('Visible', 'Visible')}</Badge> : <Badge tone="grey">{t('Oculta', 'Hidden')}</Badge>}
                        </div>
                      </td>
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
                            {t('Editar', 'Edit')}
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
    </div>
  );
}

function CategoryModal({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const { toast } = useFeedback();
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = !d._id;
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  async function save() {
    if (!d.name.es?.trim()) return setError(t('El nombre en español es obligatorio.', 'The Spanish name is required.'));
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
      toast(isNew ? t('Categoría creada', 'Category created') : t('Categoría guardada', 'Category saved'));
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
      title={isNew ? t('Nueva categoría', 'New category') : `${t('Editar', 'Edit')} «${draft.name.es}»`}
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
        <LocInput
          label={t('Nombre', 'Name')}
          value={d.name}
          onChange={(name) => set({ name, ...(isNew ? { key: slugify(name.es ?? '') } : {}) })}
          required
          maxLength={80}
        />
        <LocInput label={t('Descripción', 'Description')} value={d.description} onChange={(description) => set({ description })} multiline maxLength={300} />
        <div className="grid-2">
          <TextField
            label={t('Clave (URL)', 'Key (URL)')}
            value={d.key}
            disabled={!isNew}
            onChange={(e) => set({ key: slugify(e.target.value) })}
            hint={
              isNew ? t('Se usa en la dirección: /carta#cat-clave', 'Used in the address: /carta#cat-key') : t('No se puede cambiar.', 'Cannot be changed.')
            }
          />
          <TextField label={t('Orden', 'Order')} type="number" value={d.order} onChange={(e) => set({ order: Number(e.target.value) })} />
        </div>
        <ImageInput label={t('Imagen de la categoría', 'Category image')} value={d.imageUrl} onChange={(imageUrl) => set({ imageUrl })} />
        <Toggle label={t('Visible en la carta', 'Visible on the menu')} checked={d.published} onChange={(published) => set({ published })} />
      </div>
    </Modal>
  );
}
