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
import { useT } from '@/lib/i18n';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function MenuItemsPage() {
  const t = useT();
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
      toast(`${i.name.es} ${!i.published ? t('visible en la carta', 'visible on the menu') : t('oculto de la carta', 'hidden from the menu')}`);
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
        title={t('Productos', 'Products')}
        subtitle={
          items.data
            ? t(`${total} productos en la carta · ${noPhoto} sin foto real`, `${total} products on the menu · ${noPhoto} without a real photo`)
            : undefined
        }
        actions={
          can('menu:write') ? (
            <Link href="/menu/new" className="btn btn-primary btn-md">
              <Icon name="plus" /> {t('Nuevo producto', 'New product')}
            </Link>
          ) : null
        }
      />
      {items.error ? <Alert tone="danger">{errorText(items.error)}</Alert> : null}
      <Card padded={false}>
        <div className="filters" style={{ padding: '14px 14px 0' }}>
          <SearchInput value={q} onChange={setQ} placeholder={t('Buscar producto…', 'Search product…')} />
          <select className="input" aria-label={t('Categoría', 'Category')} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">{t('Todas las categorías', 'All categories')}</option>
            {(cats.data?.items ?? []).map((c) => (
              <option key={c.key} value={c.key}>
                {c.name.es}
              </option>
            ))}
          </select>
          <select className="input" aria-label={t('Visibilidad', 'Visibility')} value={vis} onChange={(e) => setVis(e.target.value as typeof vis)}>
            <option value="">{t('Todos', 'All')}</option>
            <option value="published">{t('Visibles', 'Visible')}</option>
            <option value="hidden">{t('Ocultos', 'Hidden')}</option>
            <option value="nophoto">{t('Sin foto real', 'No real photo')}</option>
          </select>
        </div>
        {items.loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <Empty icon="menu" title={t('No hay productos con estos filtros', 'No products match these filters')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Producto', 'Product')}</th>
                  <th>{t('Categoría', 'Category')}</th>
                  <th className="num">{t('Precio', 'Price')}</th>
                  <th>{t('Opciones', 'Options')}</th>
                  <th>{t('Estado', 'Status')}</th>
                  <th aria-label={t('Acciones', 'Actions')} />
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
                                <Badge tone="amber">{t('Precio por confirmar', 'Price to be confirmed')}</Badge>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>{catName.get(i.categoryKey) ?? i.categoryKey}</td>
                      <td className="num">
                        {i.kind === 'pasta' ? <span className="muted small">{t('desde', 'from')} </span> : null}
                        {formatEur(i.priceCents)}
                      </td>
                      <td className="muted">{groups ? t(`${groups} grupo${groups > 1 ? 's' : ''}`, `${groups} group${groups > 1 ? 's' : ''}`) : '—'}</td>
                      <td>
                        {i.published ? <Badge tone="green">{t('Visible', 'Visible')}</Badge> : <Badge tone="grey">{t('Oculto', 'Hidden')}</Badge>}
                        {!i.orderable ? (
                          <>
                            {' '}
                            <Badge tone="amber">{t('Solo en local', 'In-store only')}</Badge>
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
                            aria-label={i.published ? `${t('Ocultar', 'Hide')} ${i.name.es}` : `${t('Mostrar', 'Show')} ${i.name.es}`}
                          >
                            <Icon name={i.published ? 'eye' : 'plus'} size={15} />
                            {i.published ? t('Ocultar', 'Hide') : t('Mostrar', 'Show')}
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
