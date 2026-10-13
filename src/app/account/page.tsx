'use client';

import { ChangePassword } from '@/components/shell/ChangePassword';
import { Card, PageHeader } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { ROLE_LABEL } from '@/lib/format';
import { useT } from '@/lib/i18n';

export default function AccountPage() {
  const t = useT();
  const { me, permissions } = useAuth();
  const { branches } = useBranches();
  return (
    <>
      <PageHeader title={t('Mi cuenta', 'My account')} subtitle={t('Tus datos de acceso y permisos', 'Your login details and permissions')} />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title={t('Perfil', 'Profile')}>
          <dl className="kv">
            <dt>{t('Nombre', 'Name')}</dt>
            <dd>{me?.name ?? '—'}</dd>
            <dt>{t('Correo', 'Email')}</dt>
            <dd>{me?.email}</dd>
            <dt>{t('Rol', 'Role')}</dt>
            <dd>{ROLE_LABEL[me?.role ?? ''] ?? me?.role}</dd>
            <dt>{t('Restaurantes', 'Restaurants')}</dt>
            <dd>{me?.role === 'owner' ? t('Todos', 'All') : branches.map((b) => b.name).join(', ') || '—'}</dd>
            <dt>{t('Permisos', 'Permissions')}</dt>
            <dd className="small muted">{permissions.join(', ')}</dd>
          </dl>
        </Card>
        <Card title={t('Cambiar contraseña', 'Change password')}>
          <ChangePassword />
        </Card>
      </div>
    </>
  );
}
