'use client';

import { useState } from 'react';
import { useFeedback } from '@/components/ui/feedback';
import { Alert, Badge, Button, Card, Empty, PageHeader, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { errorText, formatDate, formatEur } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { CouponModal, type Coupon } from './CouponModal';

export default function PromotionsPage() {
  const { can } = useAuth();
  const { byId } = useBranches();
  const { toast } = useFeedback();
  const r = useResource<{ items: Coupon[] }>('/api/v1/admin/promotions');
  const [edit, setEdit] = useState<Coupon | 'new' | null>(null);
  const items = r.data?.items ?? [];

  async function toggle(c: Coupon) {
    try {
      await api(`/api/v1/admin/promotions/${c._id}`, { method: 'PATCH', body: { active: !c.active } });
      toast(`${c.code} ${!c.active ? 'activado' : 'desactivado'}`);
      r.reload();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <>
      <PageHeader
        title="Promociones"
        subtitle="Códigos de descuento para la web y la app. Las ofertas públicas aparecen en la página «Ofertas»."
        actions={
          can('promotions:write') ? (
            <Button variant="primary" icon="plus" onClick={() => setEdit('new')}>
              Nuevo código
            </Button>
          ) : null
        }
      />
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      <Card padded={false}>
        {r.loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty icon="tag" title="Todavía no hay promociones" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descuento</th>
                  <th>Condiciones</th>
                  <th>Vigencia</th>
                  <th className="num">Usos</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
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
                        {c.maxDiscountCents ? <div className="muted small">máx. {formatEur(c.maxDiscountCents)}</div> : null}
                      </td>
                      <td className="small">
                        {c.minSubtotalCents ? `Mínimo ${formatEur(c.minSubtotalCents)}` : 'Sin mínimo'}
                        {c.fulfilment !== 'any' ? ` · solo ${c.fulfilment === 'pickup' ? 'recogida' : 'reparto'}` : ''}
                        <div className="muted">
                          {c.branchIds.length ? c.branchIds.map((id) => byId(id)?.name.replace('La Toscana ', '') ?? '—').join(', ') : 'Todos los restaurantes'}
                        </div>
                      </td>
                      <td className="small">
                        {c.validFrom ? formatDate(c.validFrom) : 'Desde ya'} → {c.validTo ? formatDate(c.validTo) : 'sin fin'}
                      </td>
                      <td className="num">
                        {c.redemptions ?? 0}
                        {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
                      </td>
                      <td>
                        {expired ? <Badge tone="grey">Caducado</Badge> : c.active ? <Badge tone="green">Activo</Badge> : <Badge tone="grey">Inactivo</Badge>}
                        {c.public ? (
                          <>
                            {' '}
                            <Badge tone="blue">Público</Badge>
                          </>
                        ) : null}
                      </td>
                      <td className="num">
                        {can('promotions:write') ? (
                          <span className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            <Button size="sm" variant="ghost" onClick={() => void toggle(c)}>
                              {c.active ? 'Desactivar' : 'Activar'}
                            </Button>
                            <Button size="sm" icon="edit" onClick={() => setEdit(c)}>
                              Editar
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
