'use client';

import { ChangePassword } from '@/components/shell/ChangePassword';
import { Card, PageHeader } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { ROLE_LABEL } from '@/lib/format';

export default function AccountPage() {
  const { me, permissions } = useAuth();
  const { branches } = useBranches();
  return (
    <>
      <PageHeader title="Mi cuenta" subtitle="Tus datos de acceso y permisos" />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title="Perfil">
          <dl className="kv">
            <dt>Nombre</dt>
            <dd>{me?.name ?? '—'}</dd>
            <dt>Correo</dt>
            <dd>{me?.email}</dd>
            <dt>Rol</dt>
            <dd>{ROLE_LABEL[me?.role ?? ''] ?? me?.role}</dd>
            <dt>Restaurantes</dt>
            <dd>{me?.role === 'owner' ? 'Todos' : branches.map((b) => b.name).join(', ') || '—'}</dd>
            <dt>Permisos</dt>
            <dd className="small muted">{permissions.join(', ')}</dd>
          </dl>
        </Card>
        <Card title="Cambiar contraseña">
          <ChangePassword />
        </Card>
      </div>
    </>
  );
}
