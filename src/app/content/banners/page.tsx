'use client';

import { useState } from 'react';
import { ImageInput, imageSrc, LocInput } from '@/components/forms';
import { useFeedback } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/Icon';
import { Alert, Badge, Button, Card, Empty, Modal, PageHeader, SelectField, Spinner, TextField, Toggle } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText, formatDate } from '@/lib/format';
import type { Loc } from '@/lib/types';
import { useResource } from '@/lib/use-resource';
import { labels, useT } from '@/lib/i18n';

interface Banner {
  _id: string;
  placement: string;
  title: Loc;
  body?: Loc;
  imageUrl?: string;
  imageAlt?: Loc;
  link?: string;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  order: number;
  branchIds: string[];
}

const PLACEMENTS = labels({
  es: {
    home_top: 'Inicio · carrusel principal',
    home_middle: 'Inicio · banda central',
    app_promo: 'Inicio · promoción de la app',
    app_promo_wide: 'Inicio · promoción de la app (ancha)',
    menu_top: 'Carta · arriba',
    menu_sidebar: 'Carta · lateral',
    restaurants_top: 'Restaurantes · arriba',
    checkout: 'Pago',
  },
  en: {
    home_top: 'Home · main carousel',
    home_middle: 'Home · middle band',
    app_promo: 'Home · app promotion',
    app_promo_wide: 'Home · app promotion (wide)',
    menu_top: 'Menu · top',
    menu_sidebar: 'Menu · sidebar',
    restaurants_top: 'Restaurants · top',
    checkout: 'Checkout',
  },
});

export default function BannersPage() {
  const t = useT();
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const r = useResource<{ items: Banner[] }>('/api/v1/admin/banners');
  const [edit, setEdit] = useState<Partial<Banner> | null>(null);
  const items = r.data?.items ?? [];
  const groups = Object.keys(PLACEMENTS).filter((p) => items.some((b) => b.placement === p));
  const write = can('content:write');

  async function remove(b: Banner) {
    if (
      !(await confirm({
        title: t('Eliminar banner', 'Delete banner'),
        message: t(`¿Eliminar «${b.title.es}»?`, `Delete “${b.title.es}”?`),
        danger: true,
        confirmLabel: t('Eliminar', 'Delete'),
      }))
    )
      return;
    try {
      await api(`/api/v1/admin/banners/${b._id}`, { method: 'DELETE' });
      toast(t('Banner eliminado', 'Banner deleted'));
      r.reload();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <>
      <PageHeader
        title={t('Banners', 'Banners')}
        subtitle={t(
          'Imágenes y mensajes de la web (carrusel de inicio, promoción de la app…). Los cambios se ven en la web en un minuto.',
          'Website images and messages (home carousel, app promotion…). Changes appear on the website within a minute.',
        )}
        actions={
          write ? (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => setEdit({ placement: 'home_top', title: { es: '' }, active: false, order: items.length + 1, branchIds: [] })}
            >
              {t('Nuevo banner', 'New banner')}
            </Button>
          ) : null
        }
      />
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      {r.loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card>
          <Empty icon="image" title={t('No hay banners', 'No banners')} />
        </Card>
      ) : (
        <div className="stack">
          {groups.map((p) => (
            <Card key={p} title={PLACEMENTS[p]} padded={false}>
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {items
                      .filter((b) => b.placement === p)
                      .sort((a, b) => a.order - b.order)
                      .map((b) => {
                        const src = imageSrc(b.imageUrl);
                        return (
                          <tr key={b._id}>
                            <td style={{ width: 140 }}>
                              {src ? (
                                // eslint-disable-next-line @next/next/no-img-element -- API image
                                <img src={src} alt="" style={{ width: 120, height: 60, objectFit: 'cover', borderRadius: 8 }} />
                              ) : (
                                <span className="thumb-ph">
                                  <Icon name="image" />
                                </span>
                              )}
                            </td>
                            <td>
                              <strong>{b.title.es}</strong>
                              <div className="muted small">{b.body?.es}</div>
                              {b.link ? <div className="muted small mono">→ {b.link}</div> : null}
                            </td>
                            <td className="small">
                              {b.startsAt || b.endsAt
                                ? `${b.startsAt ? formatDate(b.startsAt) : '…'} – ${b.endsAt ? formatDate(b.endsAt) : '…'}`
                                : t('Siempre', 'Always')}
                            </td>
                            <td className="mono">#{b.order}</td>
                            <td>{b.active ? <Badge tone="green">{t('Activo', 'Active')}</Badge> : <Badge tone="grey">{t('Inactivo', 'Inactive')}</Badge>}</td>
                            <td className="num">
                              {write ? (
                                <span className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                                  <Button size="sm" icon="edit" onClick={() => setEdit(b)}>
                                    {t('Editar', 'Edit')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    icon="trash"
                                    onClick={() => void remove(b)}
                                    aria-label={`${t('Eliminar', 'Delete')} ${b.title.es}`}
                                  />
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
      {edit ? <BannerModal banner={edit} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), r.reload())} /> : null}
    </>
  );
}

function BannerModal({ banner, onClose, onSaved }: { banner: Partial<Banner>; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const { toast } = useFeedback();
  const isNew = !banner._id;
  const [b, setB] = useState({
    placement: banner.placement ?? 'home_top',
    title: banner.title ?? { es: '' },
    body: banner.body ?? { es: '' },
    imageUrl: banner.imageUrl ?? null,
    imageAlt: banner.imageAlt ?? { es: '' },
    link: banner.link ?? '',
    active: banner.active ?? false,
    startsAt: banner.startsAt?.slice(0, 10) ?? '',
    endsAt: banner.endsAt?.slice(0, 10) ?? '',
    order: banner.order ?? 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<typeof b>) => setB((x) => ({ ...x, ...p }));
  async function save() {
    if (!b.title.es?.trim()) return setError(t('El título en español es obligatorio.', 'The Spanish title is required.'));
    if (b.link && !/^(\/|https?:\/\/)/.test(b.link))
      return setError(t('El enlace debe empezar por / (página de la web) o https://', 'The link must start with / (a website page) or https://'));
    setBusy(true);
    setError(null);
    const loc = (l: Loc) => ({ es: l.es ?? '', ...(l.en ? { en: l.en } : {}) });
    const body = {
      placement: b.placement,
      title: loc(b.title),
      body: loc(b.body),
      ...(b.imageUrl ? { imageUrl: b.imageUrl } : {}),
      imageAlt: loc(b.imageAlt),
      ...(b.link ? { link: b.link } : {}),
      active: b.active,
      ...(b.startsAt ? { startsAt: new Date(`${b.startsAt}T00:00:00`).toISOString() } : {}),
      ...(b.endsAt ? { endsAt: new Date(`${b.endsAt}T23:59:59`).toISOString() } : {}),
      order: b.order,
    };
    try {
      if (isNew) await api('/api/v1/admin/banners', { method: 'POST', body });
      else await api(`/api/v1/admin/banners/${banner._id}`, { method: 'PATCH', body });
      toast(t('Banner guardado', 'Banner saved'));
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
      title={isNew ? t('Nuevo banner', 'New banner') : t('Editar banner', 'Edit banner')}
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
        <div className="grid-2">
          <SelectField label={t('Ubicación', 'Placement')} value={b.placement} onChange={(e) => set({ placement: e.target.value })}>
            {Object.entries(PLACEMENTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </SelectField>
          <TextField label={t('Orden', 'Order')} type="number" value={b.order} onChange={(e) => set({ order: Number(e.target.value) })} />
        </div>
        <LocInput label={t('Título', 'Title')} value={b.title} onChange={(title) => set({ title })} required maxLength={120} />
        <LocInput label={t('Texto', 'Text')} value={b.body} onChange={(body) => set({ body })} multiline maxLength={300} />
        <ImageInput
          label={t('Imagen', 'Image')}
          value={b.imageUrl}
          onChange={(imageUrl) => set({ imageUrl })}
          purpose="banner"
          hint={t(
            'Usa fotos reales o márcalas como imagen ambiental en el texto alternativo.',
            'Use real photos or mark them as ambient imagery in the alt text.',
          )}
        />
        <LocInput label={t('Texto alternativo de la imagen', 'Image alt text')} value={b.imageAlt} onChange={(imageAlt) => set({ imageAlt })} maxLength={200} />
        <TextField
          label={t('Enlace (opcional)', 'Link (optional)')}
          value={b.link}
          placeholder="/carta#cat-pizzas-artesanales"
          onChange={(e) => set({ link: e.target.value })}
        />
        <div className="grid-2">
          <TextField label={t('Mostrar desde', 'Show from')} type="date" value={b.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
          <TextField label={t('Mostrar hasta', 'Show until')} type="date" value={b.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
        </div>
        <Toggle label={t('Activo', 'Active')} checked={b.active} onChange={(active) => set({ active })} />
      </div>
    </Modal>
  );
}
