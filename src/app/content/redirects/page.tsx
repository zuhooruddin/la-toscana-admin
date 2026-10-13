'use client';

import { useState } from 'react';
import { useFeedback } from '@/components/ui/feedback';
import { Alert, Badge, Button, Card, Empty, PageHeader, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/lib/format';
import { useResource } from '@/lib/use-resource';
import { useT } from '@/lib/i18n';

interface Redirect {
  _id: string;
  from: string;
  to: string;
  permanent: boolean;
}

/** Old URLs (e.g. from the previous website) pointing to their new page, to keep Google rankings and links working. */
export default function RedirectsPage() {
  const t = useT();
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const r = useResource<{ items: Redirect[] }>('/api/v1/admin/redirects');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [permanent, setPermanent] = useState(true);
  const [busy, setBusy] = useState(false);
  const write = can('content:write');
  const valid = /^\/\S{0,300}$/.test(from) && (/^\/\S{0,300}$/.test(to) || /^https?:\/\/\S+$/.test(to));

  async function add() {
    setBusy(true);
    try {
      await api('/api/v1/admin/redirects', { method: 'PUT', body: { from, to, permanent } });
      toast(t('Redirección guardada', 'Redirect saved'));
      setFrom('');
      setTo('');
      r.reload();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }
  async function remove(x: Redirect) {
    if (
      !(await confirm({
        title: t('Eliminar redirección', 'Delete redirect'),
        message: `${x.from} → ${x.to}`,
        danger: true,
        confirmLabel: t('Eliminar', 'Delete'),
      }))
    )
      return;
    try {
      await api(`/api/v1/admin/redirects/${x._id}`, { method: 'DELETE' });
      r.reload();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <>
      <PageHeader
        title={t('Redirecciones', 'Redirects')}
        subtitle={t(
          'Direcciones antiguas que llevan a su página nueva (conserva el posicionamiento en Google).',
          'Old addresses that lead to their new page (keeps your Google ranking).',
        )}
      />
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      {write ? (
        <Card title={t('Añadir', 'Add')}>
          <div className="filters" style={{ marginBottom: 0 }}>
            <input
              className="input"
              aria-label={t('Desde', 'From')}
              placeholder="/menu-antiguo"
              value={from}
              onChange={(e) => setFrom(e.target.value.trim())}
              style={{ flex: 1 }}
            />
            <span aria-hidden="true">→</span>
            <input
              className="input"
              aria-label={t('Hacia', 'To')}
              placeholder="/carta"
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
              style={{ flex: 1 }}
            />
            <label className="checkbox small">
              <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
              {t('Permanente (301)', 'Permanent (301)')}
            </label>
            <Button variant="primary" icon="plus" disabled={!valid} loading={busy} onClick={() => void add()}>
              {t('Guardar', 'Save')}
            </Button>
          </div>
        </Card>
      ) : null}
      <div style={{ height: 16 }} />
      <Card padded={false}>
        {r.loading ? (
          <Spinner />
        ) : (r.data?.items ?? []).length === 0 ? (
          <Empty icon="link" title={t('Sin redirecciones', 'No redirects')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Desde', 'From')}</th>
                  <th>{t('Hacia', 'To')}</th>
                  <th>{t('Tipo', 'Type')}</th>
                  <th aria-label={t('Acciones', 'Actions')} />
                </tr>
              </thead>
              <tbody>
                {r.data!.items.map((x) => (
                  <tr key={x._id}>
                    <td className="mono">{x.from}</td>
                    <td className="mono">{x.to}</td>
                    <td>
                      <Badge tone={x.permanent ? 'blue' : 'grey'}>
                        {x.permanent ? t('301 permanente', '301 permanent') : t('302 temporal', '302 temporary')}
                      </Badge>
                    </td>
                    <td className="num">
                      {write ? (
                        <Button size="sm" variant="ghost" icon="trash" onClick={() => void remove(x)}>
                          {t('Eliminar', 'Delete')}
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
    </>
  );
}
