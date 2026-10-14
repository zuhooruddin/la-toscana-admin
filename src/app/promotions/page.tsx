'use client';

import { useState } from 'react';
import { useFeedback } from '@/components/ui/feedback';
import { Alert, Badge, Button, Card, Empty, PageHeader, Spinner, Stat } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { errorText, formatDate, formatEur } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { CouponModal, type Coupon } from './CouponModal';
import { useT } from '@/lib/i18n';

export default function PromotionsPage() {
  const t = useT();
  const { can } = useAuth();
  const { byId } = useBranches();
  const { toast } = useFeedback();
  const r = useResource<{ items: Coupon[] }>('/api/v1/admin/promotions');
  const [edit, setEdit] = useState<Coupon | 'new' | null>(null);
  const items = r.data?.items ?? [];

  async function toggle(c: Coupon) {
    try {
      await api(`/api/v1/admin/promotions/${c._id}`, { method: 'PATCH', body: { active: !c.active } });
      toast(`${c.code} ${!c.active ? t('activado', 'activated') : t('desactivado', 'deactivated')}`);
      r.reload();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <>
      <PageHeader
        title={t('Promociones', 'Promotions')}
        subtitle={t(
          'Códigos de descuento para la web y la app. Las ofertas públicas aparecen en la página «Ofertas».',
          'Discount codes for the website and app. Public offers appear on the “Offers” page.',
        )}
        actions={
          can('promotions:write') ? (
            <Button variant="primary" icon="plus" onClick={() => setEdit('new')}>
              {t('Nuevo código', 'New code')}
            </Button>
          ) : null
        }
      />
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      <div className="grid-4 secondary-summary">
        <Stat icon="tag" tone="red" label={t('Códigos', 'Discount codes')} value={r.data ? items.length : '—'} />
        <Stat icon="check" tone="green" label={t('Activados', 'Enabled')} value={r.data ? items.filter((c) => c.active).length : '—'} />
        <Stat
          icon="clock"
          tone="amber"
          label={t('Caducados', 'Expired')}
          value={r.data ? items.filter((c) => c.validTo && new Date(c.validTo) < new Date()).length : '—'}
        />
        <Stat
          icon="orders"
          tone="blue"
          label={t('Usos totales', 'Total redemptions')}
          value={r.data ? items.reduce((n, c) => n + (c.redemptions ?? 0), 0) : '—'}
        />
      </div>
      <Card padded={false}>
        {r.loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty icon="tag" title={t('Todavía no hay promociones', 'No promotions yet')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Código', 'Code')}</th>
                  <th>{t('Descuento', 'Discount')}</th>
                  <th>{t('Condiciones', 'Conditions')}</th>
                  <th>{t('Vigencia', 'Validity')}</th>
                  <th className="num">{t('Usos', 'Uses')}</th>
                  <th>{t('Estado', 'Status')}</th>
                  <th aria-label={t('Acciones', 'Actions')} />
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const expired = c.validTo && new Date(c.validTo) < new Date();
                  return (
                    <tr key={c._id}>
                      <td>
                        <strong className="mono">{c.code}</strong>
                        <div className="muted small">{c.name?.es}</div>
                      </td>
                      <td>
                        {c.type === 'percent' ? `${(c.percentBps ?? 0) / 100} %` : formatEur(c.amountCents)}
                        {c.maxDiscountCents ? (
                          <div className="muted small">
                            {t('máx.', 'max.')} {formatEur(c.maxDiscountCents)}
                          </div>
                        ) : null}
                      </td>
                      <td className="small">
                        {c.minSubtotalCents
                          ? t(`Mínimo ${formatEur(c.minSubtotalCents)}`, `Minimum ${formatEur(c.minSubtotalCents)}`)
                          : t('Sin mínimo', 'No minimum')}
                        {c.fulfilment !== 'any'
                          ? ` · ${c.fulfilment === 'pickup' ? t('solo recogida', 'pickup only') : t('solo reparto', 'delivery only')}`
                          : ''}
                        <div className="muted">
                          {c.branchIds.length
                            ? c.branchIds.map((id) => byId(id)?.name.replace('La Toscana ', '') ?? '—').join(', ')
                            : t('Todos los restaurantes', 'All restaurants')}
                        </div>
                      </td>
                      <td className="small">
                        {c.validFrom ? formatDate(c.validFrom) : t('Desde ya', 'From now')} → {c.validTo ? formatDate(c.validTo) : t('sin fin', 'no end')}
                      </td>
                      <td className="num">
                        {c.redemptions ?? 0}
                        {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
                      </td>
                      <td>
                        {expired ? (
                          <Badge tone="grey">{t('Caducado', 'Expired')}</Badge>
                        ) : c.active ? (
                          <Badge tone="green">{t('Activo', 'Active')}</Badge>
                        ) : (
                          <Badge tone="grey">{t('Inactivo', 'Inactive')}</Badge>
                        )}
                        {c.public ? (
                          <>
                            {' '}
                            <Badge tone="blue">{t('Público', 'Public')}</Badge>
                          </>
                        ) : null}
                      </td>
                      <td className="num">
                        {can('promotions:write') ? (
                          <span className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            <Button size="sm" variant="ghost" onClick={() => void toggle(c)}>
                              {c.active ? t('Desactivar', 'Deactivate') : t('Activar', 'Activate')}
                            </Button>
                            <Button size="sm" icon="edit" onClick={() => setEdit(c)}>
                              {t('Editar', 'Edit')}
                            </Button>
                          </span>
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
      {edit ? <CouponModal coupon={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), r.reload())} /> : null}
    </>
  );
}
