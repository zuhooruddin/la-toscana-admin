'use client';

import { useState } from 'react';
import { ImageInput, LocInput } from '@/components/forms';
import { useFeedback } from '@/components/ui/feedback';
import { Alert, Badge, Button, Card, TextField, Toggle } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { errorText } from '@/lib/format';
import type { Loc } from '@/lib/types';
import { useT } from '@/lib/i18n';

export interface Settings {
  identity?: { name?: string; tagline?: Loc; logoUrl?: string | null; logoIsPlaceholder?: boolean; contactEmail?: string | null };
  legalEntity?: { name?: string; taxId?: string; address?: string; verified?: boolean };
  social?: { network: string; url: string; handle?: string }[];
  apps?: { ios?: string | null; android?: string | null };
  features?: { promotions?: boolean; loyalty?: boolean; accounts?: boolean; socialCalendar?: boolean };
  seo?: { titleTemplate?: string; defaultTitle?: Loc; defaultDescription?: Loc; ogImageUrl?: string | null };
  cookieBanner?: { text?: Loc; policyVersion?: string };
  analytics?: { ga4MeasurementId?: string | null; searchConsoleVerification?: string | null };
  secrets?: Record<string, { configured: boolean }>;
}

const NETWORKS = ['facebook', 'instagram', 'tiktok', 'x', 'youtube', 'google', 'whatsapp'];
const loc = (l?: Loc) => ({ es: l?.es ?? '', ...(l?.en ? { en: l.en } : {}) });

function useSettingsSave(onSaved: () => void) {
  const t = useT();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await api('/api/v1/admin/settings', { method: 'PATCH', body });
      toast(t('Ajustes guardados. La web los muestra en un minuto.', 'Settings saved. The website shows them within a minute.'));
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return { save, busy, error };
}

export function IdentityTab({ settings: s, onSaved, readOnly }: { settings: Settings; onSaved: () => void; readOnly: boolean }) {
  const t = useT();
  const { save, busy, error } = useSettingsSave(onSaved);
  const [f, setF] = useState({
    name: s.identity?.name ?? '',
    tagline: s.identity?.tagline ?? {},
    logoUrl: s.identity?.logoIsPlaceholder ? null : (s.identity?.logoUrl ?? null),
    contactEmail: s.identity?.contactEmail ?? '',
    legalName: s.legalEntity?.name ?? '',
    taxId: s.legalEntity?.taxId ?? '',
    legalAddress: s.legalEntity?.address ?? '',
    legalVerified: Boolean(s.legalEntity?.verified),
    social: s.social ?? [],
    ios: s.apps?.ios ?? '',
    android: s.apps?.android ?? '',
    features: { promotions: false, loyalty: false, accounts: true, socialCalendar: false, ...s.features },
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  return (
    <div className="stack">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title={t('Identidad', 'Identity')}>
          <div className="stack">
            <TextField label={t('Nombre comercial', 'Trade name')} value={f.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} />
            <LocInput label={t('Eslogan', 'Tagline')} value={f.tagline} onChange={(tagline) => set({ tagline })} maxLength={160} />
            <ImageInput
              label={t('Logotipo', 'Logo')}
              value={f.logoUrl}
              onChange={(logoUrl) => set({ logoUrl })}
              purpose="logo"
              hint={t('PNG o WebP con fondo transparente.', 'PNG or WebP with a transparent background.')}
            />
            <TextField
              label={t('Correo de contacto', 'Contact email')}
              type="email"
              value={f.contactEmail}
              onChange={(e) => set({ contactEmail: e.target.value })}
            />
          </div>
        </Card>
        <Card title={t('Datos fiscales (aviso legal y facturas)', 'Tax details (legal notice and invoices)')}>
          <div className="stack">
            <TextField label={t('Razón social', 'Legal name')} value={f.legalName} maxLength={160} onChange={(e) => set({ legalName: e.target.value })} />
            <TextField
              label={t('NIF / CIF', 'Tax ID (NIF / CIF)')}
              value={f.taxId}
              maxLength={20}
              onChange={(e) => set({ taxId: e.target.value.toUpperCase() })}
            />
            <TextField
              label={t('Domicilio social', 'Registered address')}
              value={f.legalAddress}
              maxLength={300}
              onChange={(e) => set({ legalAddress: e.target.value })}
            />
            <Toggle
              label={t('Datos verificados', 'Details verified')}
              hint={t('Solo se muestran en la web cuando están verificados.', 'They are only shown on the website once verified.')}
              checked={f.legalVerified}
              onChange={(legalVerified) => set({ legalVerified })}
            />
          </div>
        </Card>
        <Card
          title={t('Redes sociales', 'Social networks')}
          actions={
            !readOnly ? (
              <Button size="sm" icon="plus" onClick={() => set({ social: [...f.social, { network: 'instagram', url: '' }] })}>
                {t('Añadir', 'Add')}
              </Button>
            ) : null
          }
        >
          <div className="stack">
            {f.social.length === 0 ? <p className="muted">{t('Sin redes.', 'No networks.')}</p> : null}
            {f.social.map((x, i) => (
              <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
                <select
                  className="input"
                  style={{ width: 140 }}
                  aria-label={t('Red', 'Network')}
                  value={x.network}
                  onChange={(e) => set({ social: f.social.map((y, j) => (j === i ? { ...y, network: e.target.value } : y)) })}
                >
                  {NETWORKS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  aria-label="URL"
                  placeholder="https://…"
                  value={x.url}
                  onChange={(e) => set({ social: f.social.map((y, j) => (j === i ? { ...y, url: e.target.value.trim() } : y)) })}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('Quitar', 'Remove')}
                  onClick={() => set({ social: f.social.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </Card>
        <Card title={t('Apps y funciones', 'Apps and features')}>
          <div className="stack">
            <TextField
              label={t('App Store (iPhone)', 'App Store (iPhone)')}
              value={f.ios}
              placeholder="https://apps.apple.com/…"
              onChange={(e) => set({ ios: e.target.value.trim() })}
            />
            <TextField
              label="Google Play (Android)"
              value={f.android}
              placeholder="https://play.google.com/store/apps/details?id=…"
              onChange={(e) => set({ android: e.target.value.trim() })}
            />
            <Toggle
              label={t('Página de ofertas', 'Offers page')}
              checked={Boolean(f.features.promotions)}
              onChange={(v) => set({ features: { ...f.features, promotions: v } })}
            />
            <Toggle
              label={t('Cuentas de cliente', 'Customer accounts')}
              hint={t('Registro e inicio de sesión en la web y la app.', 'Sign-up and login on the website and app.')}
              checked={Boolean(f.features.accounts)}
              onChange={(v) => set({ features: { ...f.features, accounts: v } })}
            />
          </div>
        </Card>
      </div>
      {!readOnly ? (
        <div className="form-actions">
          <Button
            variant="primary"
            icon="check"
            loading={busy}
            disabled={f.social.some((x) => !/^https:\/\//.test(x.url))}
            onClick={() =>
              void save({
                identity: {
                  name: f.name.trim(),
                  tagline: loc(f.tagline),
                  logoUrl: f.logoUrl,
                  logoIsPlaceholder: !f.logoUrl,
                  contactEmail: f.contactEmail.trim() || null,
                },
                legalEntity: { name: f.legalName.trim(), taxId: f.taxId.trim(), address: f.legalAddress.trim(), verified: f.legalVerified },
                social: f.social.filter((x) => x.url),
                apps: { ios: f.ios || null, android: f.android || null },
                features: f.features,
              })
            }
          >
            {t('Guardar', 'Save')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function SeoTab({ settings: s, onSaved, readOnly }: { settings: Settings; onSaved: () => void; readOnly: boolean }) {
  const t = useT();
  const { save, busy, error } = useSettingsSave(onSaved);
  const [f, setF] = useState({
    titleTemplate: s.seo?.titleTemplate ?? '%s | La Toscana Pizzeria',
    defaultTitle: s.seo?.defaultTitle ?? {},
    defaultDescription: s.seo?.defaultDescription ?? {},
    ogImageUrl: s.seo?.ogImageUrl ?? null,
    ga4: s.analytics?.ga4MeasurementId ?? '',
    gsc: s.analytics?.searchConsoleVerification ?? '',
    cookieText: s.cookieBanner?.text ?? {},
    policyVersion: s.cookieBanner?.policyVersion ?? 'v1',
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const gaInvalid = f.ga4 && !/^G-[A-Z0-9]{4,12}$/.test(f.ga4);
  return (
    <div className="stack">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title={t('Buscadores (SEO)', 'Search engines (SEO)')}>
          <div className="stack">
            <TextField
              label={t('Plantilla de título', 'Title template')}
              value={f.titleTemplate}
              maxLength={80}
              onChange={(e) => set({ titleTemplate: e.target.value })}
              hint={t('%s se sustituye por el título de cada página.', '%s is replaced by each page title.')}
            />
            <LocInput
              label={t('Título por defecto', 'Default title')}
              value={f.defaultTitle}
              onChange={(defaultTitle) => set({ defaultTitle })}
              maxLength={70}
            />
            <LocInput
              label={t('Descripción por defecto', 'Default description')}
              value={f.defaultDescription}
              onChange={(defaultDescription) => set({ defaultDescription })}
              multiline
              maxLength={170}
            />
            <ImageInput
              label={t('Imagen al compartir en redes', 'Image when sharing on social media')}
              value={f.ogImageUrl}
              onChange={(ogImageUrl) => set({ ogImageUrl })}
              purpose="page"
              hint={t('1200×630 recomendado.', '1200×630 recommended.')}
            />
          </div>
        </Card>
        <div className="stack">
          <Card title={t('Analítica', 'Analytics')}>
            <div className="stack">
              <TextField
                label={t('Google Analytics 4 (ID de medición)', 'Google Analytics 4 (measurement ID)')}
                value={f.ga4}
                placeholder="G-XXXXXXX"
                onChange={(e) => set({ ga4: e.target.value.trim().toUpperCase() })}
                error={gaInvalid ? t('Formato G-XXXXXXX', 'Format G-XXXXXXX') : null}
                hint={t('Solo se carga si el visitante acepta las cookies de analítica.', 'Only loaded if the visitor accepts analytics cookies.')}
              />
              <TextField
                label={t('Verificación de Google Search Console', 'Google Search Console verification')}
                value={f.gsc}
                maxLength={100}
                onChange={(e) => set({ gsc: e.target.value.trim() })}
              />
            </div>
          </Card>
          <Card title={t('Aviso de cookies', 'Cookie notice')}>
            <div className="stack">
              <LocInput
                label={t('Texto del aviso', 'Notice text')}
                value={f.cookieText}
                onChange={(cookieText) => set({ cookieText })}
                multiline
                maxLength={600}
              />
              <TextField
                label={t('Versión de la política', 'Policy version')}
                value={f.policyVersion}
                maxLength={20}
                onChange={(e) => set({ policyVersion: e.target.value })}
                hint={t(
                  'Cámbiala cuando cambie la política: se vuelve a pedir el consentimiento.',
                  'Change it when the policy changes: consent is requested again.',
                )}
              />
            </div>
          </Card>
        </div>
      </div>
      {!readOnly ? (
        <div className="form-actions">
          <Button
            variant="primary"
            icon="check"
            loading={busy}
            disabled={Boolean(gaInvalid)}
            onClick={() =>
              void save({
                seo: {
                  titleTemplate: f.titleTemplate,
                  defaultTitle: loc(f.defaultTitle),
                  defaultDescription: loc(f.defaultDescription),
                  ogImageUrl: f.ogImageUrl,
                },
                analytics: { ga4MeasurementId: f.ga4 || null, searchConsoleVerification: f.gsc || null },
                cookieBanner: { text: loc(f.cookieText), policyVersion: f.policyVersion },
              })
            }
          >
            {t('Guardar', 'Save')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const SECRETS: { name: string; label: [string, string]; help: [string, string] }[] = [
  {
    name: 'mapsApiKey',
    label: ['Clave de Google Maps', 'Google Maps key'],
    help: ['Para mapas y cálculo de zonas de reparto.', 'For maps and delivery zone calculation.'],
  },
  {
    name: 'smtpPassword',
    label: ['Contraseña del correo (SMTP)', 'Email password (SMTP)'],
    help: ['Para enviar confirmaciones de pedido y reserva.', 'To send order and reservation confirmations.'],
  },
  {
    name: 'socialApiToken',
    label: ['Token de redes sociales', 'Social media token'],
    help: ['Solo si se contrata la publicación automática.', 'Only if automatic posting is purchased.'],
  },
];

/** Write-only secrets: encrypted at rest on the server, never sent back to the browser. */
export function IntegrationsTab({ settings: s, onSaved }: { settings: Settings; onSaved: () => void }) {
  const t = useT();
  const { toast } = useFeedback();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  async function put(name: string, value: string | null) {
    setBusy(name);
    try {
      await api(`/api/v1/admin/integrations/secrets/${name}`, { method: 'PUT', body: { value } });
      toast(value === null ? t('Clave eliminada', 'Key removed') : t('Clave guardada (cifrada)', 'Key saved (encrypted)'));
      setValues((v) => ({ ...v, [name]: '' }));
      onSaved();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }
  return (
    <Card title={t('Claves de integración', 'Integration keys')}>
      <div className="stack">
        <Alert tone="info">
          {t(
            'Las claves se guardan cifradas y nunca se vuelven a mostrar. Para cambiar una, escribe la nueva.',
            'Keys are stored encrypted and are never shown again. To change one, type the new value.',
          )}
        </Alert>
        {SECRETS.map((x) => {
          const configured = Boolean(s.secrets?.[x.name]?.configured);
          return (
            <div key={x.name} className="stack" style={{ gap: 6 }}>
              <div className="row-between">
                <strong>{t(...x.label)}</strong>
                {configured ? <Badge tone="green">{t('Configurada', 'Configured')}</Badge> : <Badge tone="grey">{t('Sin configurar', 'Not configured')}</Badge>}
              </div>
              <p className="muted small">{t(...x.help)}</p>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input
                  className="input"
                  type="password"
                  autoComplete="off"
                  aria-label={t(...x.label)}
                  placeholder={configured ? '••••••••' : ''}
                  value={values[x.name] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [x.name]: e.target.value }))}
                />
                <Button variant="primary" size="sm" disabled={!values[x.name]} loading={busy === x.name} onClick={() => void put(x.name, values[x.name]!)}>
                  {t('Guardar', 'Save')}
                </Button>
                {configured ? (
                  <Button variant="ghost" size="sm" onClick={() => void put(x.name, null)}>
                    {t('Quitar', 'Remove')}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
