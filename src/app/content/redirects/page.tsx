'use client';

import { useState } from 'react';
import { useFeedback } from '@/components/ui/feedback';
import { Alert, Badge, Button, Card, Empty, PageHeader, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

interface Redirect {
  _id: string;
  from: string;
  to: string;
  permanent: boolean;
}

/** Old URLs (e.g. from the previous website) pointing to their new page, to keep Google rankings and links working. */
export default function RedirectsPage() {
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
      toast('Redirección guardada');
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
    if (!(await confirm({ title: 'Eliminar redirección', message: `${x.from} → ${x.to}`, danger: true, confirmLabel: 'Eliminar' }))) return;
    try {
      await api(`/api/v1/admin/redirects/${x._id}`, { method: 'DELETE' });
      r.reload();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <>
      <PageHeader title="Redirecciones" subtitle="Direcciones antiguas que llevan a su página nueva (conserva el posicionamiento en Google)." />
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      {write ? (
        <Card title="Añadir">
          <div className="filters" style={{ marginBottom: 0 }}>
            <input
              className="input"
              aria-label="Desde"
              placeholder="/menu-antiguo"
              value={from}
              onChange={(e) => setFrom(e.target.value.trim())}
              style={{ flex: 1 }}
            />
            <span aria-hidden="true">→</span>
            <input className="input" aria-label="Hacia" placeholder="/carta" value={to} onChange={(e) => setTo(e.target.value.trim())} style={{ flex: 1 }} />
            <label className="checkbox small">
              <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
              Permanente (301)
            </label>
            <Button variant="primary" icon="plus" disabled={!valid} loading={busy} onClick={() => void add()}>
              Guardar
            </Button>
          </div>
        </Card>
      ) : null}
      <div style={{ height: 16 }} />
      <Card padded={false}>
        {r.loading ? (
          <Spinner />
        ) : (r.data?.items ?? []).length === 0 ? (
          <Empty icon="link" title="Sin redirecciones" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Desde</th>
                  <th>Hacia</th>
                  <th>Tipo</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {r.data!.items.map((x) => (
                  <tr key={x._id}>
                    <td className="mono">{x.from}</td>
                    <td className="mono">{x.to}</td>
                    <td>
                      <Badge tone={x.permanent ? 'blue' : 'grey'}>{x.permanent ? '301 permanente' : '302 temporal'}</Badge>
                    </td>
                    <td className="num">
                      {write ? (
                        <Button size="sm" variant="ghost" icon="trash" onClick={() => void remove(x)}>
                          Eliminar
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
