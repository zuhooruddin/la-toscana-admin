'use client';

import { useState } from 'react';
import { useFeedback } from '@/components/ui/feedback';
import { Alert, Button, Field, Modal, SelectField, TextField, Toggle } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { errorText, ROLE_LABEL } from '@/lib/format';
import type { Role } from '@/lib/types';
import { useT } from '@/lib/i18n';

export interface StaffUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: Role;
  branchIds: string[];
  status: 'active' | 'disabled';
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

/** Create or edit a staff/manager/driver account. A new account gets a one-time password shown only here. */
export function StaffModal({ user, defaultRole, onClose, onSaved }: { user: StaffUser | null; defaultRole: Role; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const { me } = useAuth();
  const { branches } = useBranches();
  const { toast } = useFeedback();
  const isNew = !user;
  const roles: Role[] = me?.role === 'owner' ? ['manager', 'staff', 'driver'] : ['staff', 'driver'];
  const [f, setF] = useState({
    email: user?.email ?? '',
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    role: (user?.role ?? defaultRole) as Role,
    branchIds: user?.branchIds ?? (branches.length === 1 ? [branches[0]!.id] : []),
    active: (user?.status ?? 'active') === 'active',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  async function save() {
    if (!f.name.trim() || (isNew && !/^\S+@\S+\.\S+$/.test(f.email)) || !f.branchIds.length)
      return setError(t('Completa nombre, correo y al menos un restaurante.', 'Fill in name, email and at least one restaurant.'));
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        const r = await api<{ temporaryPassword: string }>('/api/v1/admin/staff', {
          method: 'POST',
          body: { email: f.email.trim(), name: f.name.trim(), phone: f.phone.trim() || undefined, role: f.role, branchIds: f.branchIds },
        });
        setTempPassword(r.temporaryPassword);
        onSaved();
      } else {
        await api(`/api/v1/admin/staff/${user!.id}`, {
          method: 'PATCH',
          body: { name: f.name.trim(), phone: f.phone.trim(), role: f.role, branchIds: f.branchIds, status: f.active ? 'active' : 'disabled' },
        });
        toast(t('Cuenta actualizada. Si cambiaste rol, restaurantes o estado, sus sesiones se han cerrado.', 'Account updated. If you changed the role, restaurants or status, their sessions have been signed out.'));
        onSaved();
        onClose();
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (tempPassword)
    return (
      <Modal
        open
        onClose={onClose}
        title={t('Cuenta creada', 'Account created')}
        size="sm"
        footer={
          <Button variant="primary" onClick={onClose}>
            {t('Hecho', 'Done')}
          </Button>
        }
      >
        <div className="stack">
          <Alert tone="warning" title={t('Contraseña temporal: se muestra solo esta vez', 'Temporary password: shown only this once')}>
            {t('Entrégala en persona. Al entrar por primera vez tendrá que cambiarla.', 'Hand it over in person. They will have to change it on first login.')}
          </Alert>
          <dl className="kv">
            <dt>{t('Usuario', 'Username')}</dt>
            <dd>{f.email}</dd>
            <dt>{t('Contraseña', 'Password')}</dt>
            <dd>
              <code style={{ fontSize: '1.1rem', fontWeight: 800 }}>{tempPassword}</code>
            </dd>
          </dl>
          <Button size="sm" icon="check" onClick={() => void navigator.clipboard?.writeText(tempPassword).then(() => toast(t('Copiada', 'Copied')))}>
            {t('Copiar contraseña', 'Copy password')}
          </Button>
        </div>
      </Modal>
    );

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? t('Nueva cuenta del equipo', 'New team account') : `${t('Editar', 'Edit')} ${user!.name ?? user!.email}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancelar', 'Cancel')}
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {isNew ? t('Crear cuenta', 'Create account') : t('Guardar', 'Save')}
          </Button>
        </>
      }
    >
      <div className="stack">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="grid-2">
          <TextField label={t('Nombre', 'Name')} value={f.name} onChange={(e) => set({ name: e.target.value })} required />
          <TextField label={t('Teléfono', 'Phone')} type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
        </div>
        <TextField label={t('Correo (usuario)', 'Email (username)')} type="email" value={f.email} disabled={!isNew} onChange={(e) => set({ email: e.target.value })} required />
        <SelectField label={t('Rol', 'Role')} value={f.role} onChange={(e) => set({ role: e.target.value as Role })}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </SelectField>
        <Field label={t('Restaurantes', 'Restaurants')} required>
          <div className="stack" style={{ gap: 6 }}>
            {branches.map((b) => (
              <label key={b.id} className="checkbox">
                <input
                  type="checkbox"
                  checked={f.branchIds.includes(b.id)}
                  onChange={(e) => set({ branchIds: e.target.checked ? [...f.branchIds, b.id] : f.branchIds.filter((x) => x !== b.id) })}
                />
                {b.name}
              </label>
            ))}
          </div>
        </Field>
        {!isNew ? (
          <Toggle label={t('Cuenta activa', 'Account active')} hint={t('Desactivarla cierra sus sesiones y le impide entrar.', 'Disabling it signs them out and blocks login.')} checked={f.active} onChange={(active) => set({ active })} />
        ) : null}
      </div>
    </Modal>
  );
}
