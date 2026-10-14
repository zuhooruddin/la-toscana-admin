'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { imageSrc } from '@/components/forms';
import { useFeedback } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/Icon';
import { Alert, Badge, Button, Card, Empty, PageHeader, SearchInput, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText, formatEur } from '@/lib/format';
import type { Category, MenuItem } from '@/lib/types';
import { useResource } from '@/lib/use-resource';
import { useT } from '@/lib/i18n';
import './menu.css';

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState('order');

  const catName = useMemo(() => new Map((cats.data?.items ?? []).map((c) => [c.key, c.name.es ?? c.key])), [cats.data]);
  const list = useMemo(() => {
    const all = items.data?.items ?? [];
    const order = new Map((cats.data?.items ?? []).map((c, i) => [c.key, c.order ?? i]));
    return all
      .filter((i) => !cat || i.categoryKey === cat)
      .filter((i) => (vis === 'published' ? i.published : vis === 'hidden' ? !i.published : vis === 'nophoto' ? !i.imageUrl || i.imageIsPlaceholder : true))
      .filter((i) => !q || norm(`${i.name.es} ${i.name.en ?? ''} ${i.slug}`).includes(norm(q)))
      .sort((a, b) =>
        sort === 'name'
          ? (a.name.es ?? '').localeCompare(b.name.es ?? '')
          : sort === 'price'
            ? a.priceCents - b.priceCents
            : (order.get(a.categoryKey) ?? 99) - (order.get(b.categoryKey) ?? 99) || a.order - b.order,
      );
  }, [items.data, cats.data, q, cat, vis, sort]);

  async function toggleOrderable(i: MenuItem) {
    setBusy(i._id);
    try {
      await api(`/api/v1/admin/menu/items/${i._id}`, { method: 'PATCH', body: { orderable: !i.orderable } });
      items.setData((d) => ({ items: d.items.map((x) => (x._id === i._id ? { ...x, orderable: !i.orderable } : x)) }));
      toast(t('Disponibilidad guardada', 'Availability saved'));
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }
  function exportCsv() {
    const rows = [
      ['Name', 'Category', 'Price EUR', 'Available', 'Published'],
      ...list.map((i) => [
        i.name.es ?? '',
        catName.get(i.categoryKey) ?? i.categoryKey,
        (i.priceCents / 100).toFixed(2),
        String(i.orderable),
        String(i.published),
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'la-toscana-products.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

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
  return (
    <div className="menu-page products-page">
      <PageHeader
        title={t('Productos', 'Products')}
        subtitle={t('Gestiona tus productos, precios, disponibilidad y categorías.', 'Manage your menu items, prices, availability and categories.')}
        actions={
          <>
            <Button icon="upload" disabled={!items.data} onClick={exportCsv}>
              {t('Exportar CSV', 'Export CSV')}
            </Button>
            <Button icon="toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
              {t('Filtros', 'Filters')}
            </Button>
            {can('menu:write') ? (
              <Link href="/menu/new" className="btn btn-primary btn-md">
                <Icon name="plus" /> {t('Nuevo producto', 'New product')}
              </Link>
            ) : null}
          </>
        }
      />
      {items.error ? <Alert tone="danger">{errorText(items.error)}</Alert> : null}
      {cats.error ? <Alert tone="danger">{errorText(cats.error)}</Alert> : null}
      <div className="menu-category-tabs">
        <button type="button" aria-pressed={!cat} onClick={() => setCat('')}>
          <Icon name="layers" />
          <span>{t('Todos', 'All')}</span>
          <small>{total}</small>
        </button>
        {(cats.data?.items ?? []).map((category) => (
          <button type="button" key={category.key} aria-pressed={cat === category.key} onClick={() => setCat(category.key)}>
            <span>{category.name.es}</span>
            <small>{(items.data?.items ?? []).filter((i) => i.categoryKey === category.key).length}</small>
          </button>
        ))}
      </div>
      <div className="menu-filter-bar">
        <SearchInput value={q} onChange={setQ} placeholder={t('Buscar productos…', 'Search products…')} />
        <span className="spacer" />
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('Ordenar productos', 'Sort products')}>
          <option value="order">{t('Orden de carta', 'Menu order')}</option>
          <option value="name">{t('Nombre (A–Z)', 'Name (A–Z)')}</option>
          <option value="price">{t('Precio ascendente', 'Price ascending')}</option>
        </select>
      </div>
      <Card padded={false}>
        {filtersOpen ? (
          <div className="filters" style={{ padding: '14px 14px 0' }}>
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
        ) : null}
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
                  <th>{t('Disponible', 'Available')}</th>
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
                            <div className="menu-description">{i.description?.es}</div>
                            {i.tags.includes('precio-pendiente-confirmar') ? (
                              <div>
                                <Badge tone="amber">{t('Precio por confirmar', 'Price to be confirmed')}</Badge>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone="red">{catName.get(i.categoryKey) ?? i.categoryKey}</Badge>
                      </td>
                      <td className="num">
                        {i.kind === 'pasta' ? <span className="muted small">{t('desde', 'from')} </span> : null}
                        {formatEur(i.priceCents)}
                      </td>
                      <td className="muted">{groups ? t(`${groups} grupo${groups > 1 ? 's' : ''}`, `${groups} group${groups > 1 ? 's' : ''}`) : '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="menu-switch"
                          role="switch"
                          aria-checked={i.orderable}
                          aria-label={t(`Disponible: ${i.name.es}`, `Available: ${i.name.es}`)}
                          disabled={!can('menu:write') || busy !== null}
                          onClick={() => void toggleOrderable(i)}
                        >
                          <span />
                        </button>
                      </td>
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
    </div>
  );
}
