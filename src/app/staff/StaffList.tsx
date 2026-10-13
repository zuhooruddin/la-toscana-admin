'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, Empty, PageHeader, Spinner } from '@/components/ui/kit';
import { qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { errorText, formatDateTime, ROLE_LABEL } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { StaffModal, type StaffUser } from './StaffModal';
import { useT } from '@/lib/i18n';

const ROLE_HELP: Record<string, [string, string]> = {
  owner: ['Todo, incluidos ajustes, pagos y datos personales.', 'Everything, including settings, payments and personal data.'],
  manager: ['Gestiona su restaurante: carta, pedidos, reembolsos, equipo, promociones y contenido.', 'Manages their restaurant: menu, orders, refunds, team, promotions and content.'],
  staff: ['Cocina y sala: pedidos, agotados, pausas y reservas.', 'Kitchen and floor: orders, sold-out items, pauses and reservations.'],
  driver: ['Solo la app de reparto: sus entregas asignadas.', 'Delivery app only: their assigned deliveries.'],
};

export function StaffList({ roleFilter }: { roleFilter?: 'driver' }) {
  const t = useT();
  const { can, me } = useAuth();
  const { branchParam, byId } = useBranches();
  const [edit, setEdit] = useState<StaffUser | 'new' | null>(null);
  const r = useResource<{ items: StaffUser[] }>(`/api/v1/admin/staff${qs({ branchId: branchParam, role: roleFilter })}`);
  const items = r.data?.items ?? [];
  return (
    <>
      <PageHeader
        title={roleFilter === 'driver' ? t('Repartidores', 'Drivers') : t('Equipo y permisos', 'Team & permissions')}
        subtitle={
          roleFilter === 'driver'
            ? t('Cuentas para la app de reparto. Se asignan a los pedidos a domicilio desde cada pedido.', 'Accounts for the delivery app. They are assigned to home-delivery orders from each order.')
            : t('Cuentas del personal y lo que puede hacer cada rol', 'Staff accounts and what each role can do')
        }
        actions={
          can('staff:write') ? (
            <Button variant="primary" icon="plus" onClick={() => setEdit('new')}>
              {roleFilter === 'driver' ? t('Nuevo repartidor', 'New driver') : t('Nueva cuenta', 'New account')}
            </Button>
          ) : null
        }
      />
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      {!roleFilter ? (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          {Object.entries(ROLE_HELP).map(([role, help]) => (
            <div key={role} className="card" style={{ padding: 14 }}>
              <strong>{ROLE_LABEL[role]}</strong>
              <p className="muted small" style={{ marginTop: 4 }}>
                {t(...help)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      <Card padded={false}>
        {r.loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty icon={roleFilter ? 'truck' : 'shield'} title={roleFilter ? t('Todavía no hay repartidores', 'No drivers yet') : t('No hay cuentas', 'No accounts')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Nombre', 'Name')}</th>
                  <th>{t('Rol', 'Role')}</th>
                  <th>{t('Restaurantes', 'Restaurants')}</th>
                  <th>{t('Último acceso', 'Last login')}</th>
                  <th>{t('Estado', 'Status')}</th>
                  <th aria-label={t('Acciones', 'Actions')} />
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name ?? '—'}</strong>
                      <div className="muted small">
                        {u.email}
                        {u.phone ? ` · ${u.phone}` : ''}
                      </div>
                    </td>
                    <td>{ROLE_LABEL[u.role] ?? u.role}</td>
                    <td className="small">
                      {u.role === 'owner' ? t('Todos', 'All') : u.branchIds.map((id) => byId(id)?.name.replace('La Toscana ', '') ?? '—').join(', ')}
                    </td>
                    <td className="mono small">{formatDateTime(u.lastLoginAt)}</td>
                    <td>
                      {u.status === 'active' ? <Badge tone="green">{t('Activa', 'Active')}</Badge> : <Badge tone="grey">{t('Desactivada', 'Disabled')}</Badge>}
                      {u.mustChangePassword ? (
                        <>
                          {' '}
                          <Badge tone="amber">{t('Contraseña temporal', 'Temporary password')}</Badge>
                        </>
                      ) : null}
                    </td>
                    <td className="num">
                      {can('staff:write') && u.role !== 'owner' && u.id !== me?.id ? (
                        <Button size="sm" icon="edit" onClick={() => setEdit(u)}>
                          {t('Editar', 'Edit')}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {edit ? (
        <StaffModal user={edit === 'new' ? null : edit} defaultRole={roleFilter ?? 'staff'} onClose={() => setEdit(null)} onSaved={() => r.reload()} />
      ) : null}
    </>
  );
}
