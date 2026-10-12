'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, Empty, PageHeader, Spinner } from '@/components/ui/kit';
import { qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { errorText, formatDateTime, ROLE_LABEL } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { StaffModal, type StaffUser } from './StaffModal';

const ROLE_HELP: Record<string, string> = {
  owner: 'Todo, incluidos ajustes, pagos y datos personales.',
  manager: 'Gestiona su restaurante: carta, pedidos, reembolsos, equipo, promociones y contenido.',
  staff: 'Cocina y sala: pedidos, agotados, pausas y reservas.',
  driver: 'Solo la app de reparto: sus entregas asignadas.',
};

export function StaffList({ roleFilter }: { roleFilter?: 'driver' }) {
  const { can, me } = useAuth();
  const { branchParam, byId } = useBranches();
  const [edit, setEdit] = useState<StaffUser | 'new' | null>(null);
  const r = useResource<{ items: StaffUser[] }>(`/api/v1/admin/staff${qs({ branchId: branchParam, role: roleFilter })}`);
  const items = r.data?.items ?? [];
  return (
    <>
      <PageHeader
        title={roleFilter === 'driver' ? 'Repartidores' : 'Equipo y permisos'}
        subtitle={
          roleFilter === 'driver'
            ? 'Cuentas para la app de reparto. Se asignan a los pedidos a domicilio desde cada pedido.'
            : 'Cuentas del personal y lo que puede hacer cada rol'
        }
        actions={
          can('staff:write') ? (
            <Button variant="primary" icon="plus" onClick={() => setEdit('new')}>
              {roleFilter === 'driver' ? 'Nuevo repartidor' : 'Nueva cuenta'}
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
                {help}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      <Card padded={false}>
        {r.loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty icon={roleFilter ? 'truck' : 'shield'} title={roleFilter ? 'Todavía no hay repartidores' : 'No hay cuentas'} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Restaurantes</th>
                  <th>Último acceso</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
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
                      {u.role === 'owner' ? 'Todos' : u.branchIds.map((id) => byId(id)?.name.replace('La Toscana ', '') ?? '—').join(', ')}
                    </td>
                    <td className="mono small">{formatDateTime(u.lastLoginAt)}</td>
                    <td>
                      {u.status === 'active' ? <Badge tone="green">Activa</Badge> : <Badge tone="grey">Desactivada</Badge>}
                      {u.mustChangePassword ? (
                        <>
                          {' '}
                          <Badge tone="amber">Contraseña temporal</Badge>
                        </>
                      ) : null}
                    </td>
                    <td className="num">
                      {can('staff:write') && u.role !== 'owner' && u.id !== me?.id ? (
                        <Button size="sm" icon="edit" onClick={() => setEdit(u)}>
                          Editar
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
