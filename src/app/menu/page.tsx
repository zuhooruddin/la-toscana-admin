'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { imageSrc } from '@/components/forms';
import { useFeedback } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/Icon';
import { Alert, Badge, Card, Empty, PageHeader, SearchInput, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText, formatEur } from '@/lib/format';
import type { Category, MenuItem } from '@/lib/types';
import { useResource } from '@/lib/use-resource';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function MenuItemsPage() {
  const router = useRouter();
  const { can } = useAuth();
  const { toast } = useFeedback();
  const items = useResource<{ items: MenuItem[] }>('/api/v1/admin/menu/items');
  const cats = useResource<{ items: Category[] }>('/api/v1/admin/menu/categories');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [vis, setVis] = useState<'' | 'published' | 'hidden' | 'nophoto'>('');
  const [busy, setBusy] = useState<string | null>(null);

  const catName = useMemo(() => new Map((cats.data?.items ?? []).map((c) => [c.key, c.name.es ?? c.key])), [cats.data]);
  const list = useMemo(() => {
    const all = items.data?.items ?? [];
    const order = new Map((cats.data?.items ?? []).map((c, i) => [c.key, c.order ?? i]));
    return all
      .filter((i) => !cat || i.categoryKey === cat)
      .filter((i) => (vis === 'published' ? i.published : vis === 'hidden' ? !i.published : vis === 'nophoto' ? !i.imageUrl || i.imageIsPlaceholder : true))
      .filter((i) => !q || norm(`${i.name.es} ${i.name.en ?? ''} ${i.slug}`).includes(norm(q)))
      .sort((a, b) => (order.get(a.categoryKey) ?? 99) - (order.get(b.categoryKey) ?? 99) || a.order - b.order);
  }, [items.data, cats.data, q, cat, vis]);

  async function togglePublished(i: MenuItem) {
    setBusy(i._id);
    try {
      await api(`/api/v1/admin/menu/items/${i._id}`, { method: 'PATCH', body: { published: !i.published } });
      items.setData((d) => ({ items: d.items.map((x) => (x._id === i._id ? { ...x, published: !i.published } : x)) }));
      toast(`${i.name.es} ${!i.published ? 'visible en la carta' : 'oculto de la carta'}`);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  const total = items.data?.items.length ?? 0;
  const noPhoto = (items.data?.items ?? []).filter((i) => !i.imageUrl || i.imageIsPlaceholder).length;
  return (
    <>
      <PageHeader
        title="Productos"
        subtitle={items.data ? `${total} productos en la carta · ${noPhoto} sin foto real` : undefined}
        actions={
          can('menu:write') ? (
            <Link href="/menu/new" className="btn btn-primary btn-md">
              <Icon name="plus" /> Nuevo producto
            </Link>
          ) : null
        }
      />
      {items.error ? <Alert tone="danger">{errorText(items.error)}</Alert> : null}
      <Card padded={false}>
        <div className="filters" style={{ padding: '14px 14px 0' }}>
          <SearchInput value={q} onChange={setQ} placeholder="Buscar producto…" />
          <select className="input" aria-label="Categoría" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas las categorías</option>
            {(cats.data?.items ?? []).map((c) => (
              <option key={c.key} value={c.key}>
                {c.name.es}
              </option>
            ))}
          </select>
          <select className="input" aria-label="Visibilidad" value={vis} onChange={(e) => setVis(e.target.value as typeof vis)}>
            <option value="">Todos</option>
            <option value="published">Visibles</option>
            <option value="hidden">Ocultos</option>
            <option value="nophoto">Sin foto real</option>
          </select>
        </div>
        {items.loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty icon="menu" title="No hay productos con estos filtros" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th className="num">Precio</th>
                  <th>Opciones</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {list.map((i) => {
                  const src = !i.imageIsPlaceholder ? imageSrc(i.imageUrl) : null;
                  const groups = i.optionGroups.length + i.sharedGroupKeys.length;
                  return (
                    <tr key={i._id} className="clickable" onClick={() => router.push(`/menu/${i._id}`)}>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element -- API image
                            <img className="thumb" src={src} alt="" loading="lazy" />
                          ) : (
                            <span className="thumb-ph" aria-hidden="true">
                              <Icon name="image" />
                            </span>
                          )}
                          <div>
                            <Link href={`/menu/${i._id}`} onClick={(e) => e.stopPropagation()}>
                              <strong>{i.name.es}</strong>
                            </Link>
                            {i.tags.includes('precio-pendiente-confirmar') ? (
                              <div>
                                <Badge tone="amber">Precio por confirmar</Badge>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>{catName.get(i.categoryKey) ?? i.categoryKey}</td>
                      <td className="num">
                        {i.kind === 'pasta' ? <span className="muted small">desde </span> : null}
                        {formatEur(i.priceCents)}
                      </td>
                      <td className="muted">{groups ? `${groups} grupo${groups > 1 ? 's' : ''}` : '—'}</td>
                      <td>
                        {i.published ? <Badge tone="green">Visible</Badge> : <Badge tone="grey">Oculto</Badge>}
                        {!i.orderable ? (
                          <>
                            {' '}
                            <Badge tone="amber">Solo en local</Badge>
                          </>
                        ) : null}
                      </td>
                      <td className="num" onClick={(e) => e.stopPropagation()}>
                        {can('menu:write') ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy === i._id}
                            onClick={() => void togglePublished(i)}
                            aria-label={i.published ? `Ocultar ${i.name.es}` : `Mostrar ${i.name.es}`}
                          >
                            <Icon name={i.published ? 'eye' : 'plus'} size={15} />
                            {i.published ? 'Ocultar' : 'Mostrar'}
                          </button>
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
    </>
  );
}
