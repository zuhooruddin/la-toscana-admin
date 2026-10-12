'use client';

import { useState } from 'react';
import { Alert, Card, PageHeader, Spinner, Tabs } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { IdentityTab, IntegrationsTab, SeoTab, type Settings } from './tabs';

type Tab = 'identity' | 'seo' | 'integrations';

export default function SettingsPage() {
  const { can } = useAuth();
  const r = useResource<{ settings: Settings }>('/api/v1/admin/settings');
  const site = useResource<{ payments: { provider: string; simulated: boolean; stripePublishableKey: string | null } }>('/api/v1/public/site');
  const [tab, setTab] = useState<Tab>('identity');
  if (r.error) return <Alert tone="danger">{errorText(r.error)}</Alert>;
  if (!r.data) return <Spinner />;
  const s = r.data.settings;
  const ro = !can('settings:write');
  return (
    <>
      <PageHeader title="Ajustes" subtitle="Datos del negocio, redes, apps, SEO e integraciones. Se aplican a la web y a las apps." />
      {ro ? (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="info">Solo lectura: solo el propietario puede cambiar los ajustes.</Alert>
        </div>
      ) : null}
      {site.data ? (
        <div style={{ marginBottom: 16 }}>
          {site.data.payments.simulated ? (
            <Alert tone="warning" title="Pagos con tarjeta en modo de pruebas">
              Los pagos con tarjeta están simulados: no se cobra dinero real. Para cobrar de verdad, el administrador del servidor debe configurar las claves de
              Stripe (STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET y PAYMENTS_PROVIDER=stripe). Por seguridad, estas claves no se guardan
              desde el panel.
            </Alert>
          ) : (
            <Alert tone="success">Pagos con tarjeta activos con Stripe.</Alert>
          )}
        </div>
      ) : null}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'identity', label: 'Negocio y redes' },
          { value: 'seo', label: 'SEO y analítica' },
          { value: 'integrations', label: 'Integraciones' },
        ]}
      />
      <fieldset disabled={ro} style={{ border: 0, padding: 0, margin: 0 }}>
        {tab === 'identity' ? <IdentityTab settings={s} onSaved={r.reload} readOnly={ro} /> : null}
        {tab === 'seo' ? <SeoTab settings={s} onSaved={r.reload} readOnly={ro} /> : null}
        {tab === 'integrations' ? (
          can('integrations:write') ? (
            <IntegrationsTab settings={s} onSaved={r.reload} />
          ) : (
            <Card>
              <p className="muted">Solo el propietario gestiona las integraciones.</p>
            </Card>
          )
        ) : null}
      </fieldset>
    </>
  );
}
