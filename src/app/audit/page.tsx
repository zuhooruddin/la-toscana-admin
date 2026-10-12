'use client';

import { useState } from 'react';
import { Alert, Button, Card, Empty, PageHeader, Spinner } from '@/components/ui/kit';
import { qs } from '@/lib/api';
import { errorText, formatDateTime, ROLE_LABEL } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

interface Entry {
  _id: string;
  at: string;
  action: string;
  entity: string;
  entityId?: string;
  actorRole?: string;
  actorId?: { name?: string; email?: string; role?: string } | null;
  ip?: string;
}

const ENTITIES = [
  'order',
  'menuItem',
  'category',
  'modifierGroup',
  'branch',
  'branchItem',
  'user',
  'reservation',
  'coupon',
  'page',
  'banner',
  'settings',
  'upload',
];

/** Who changed what and when. Read-only by design. */
export default function AuditPage() {
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const r = useResource<{ items: Entry[] }>(`/api/v1/admin/audit${qs({ entity, page })}`);
  const items = (r.data ?? r.stale)?.items ?? [];
  return (
    <>
      <PageHeader title="Registro de actividad" subtitle="Cambios hechos en el panel, la web y las apps. No se puede modificar." />
      <div className="filters">
        <select className="input" aria-label="Tipo" value={entity} onChange={(e) => (setEntity(e.target.value), setPage(1))}>
          <option value="">Todo</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      <Card padded={false}>
        {r.loading && !r.stale ? (
          <Spinner />
        ) : items.length === 0 ? (
          <Empty icon="history" title="Sin actividad" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Quién</th>
                    <th>Acción</th>
                    <th>Elemento</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e._id}>
                      <td className="mono small">{formatDateTime(e.at)}</td>
                      <td>
                        {e.actorId?.name ?? e.actorId?.email ?? (e.actorRole === 'system' ? 'Sistema' : '—')}
                        <div className="muted small">{ROLE_LABEL[e.actorId?.role ?? e.actorRole ?? ''] ?? e.actorRole}</div>
                      </td>
                      <td className="mono small">{e.action}</td>
                      <td className="small">
                        {e.entity}
                        <div className="muted mono">{e.entityId}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <span className="muted">Página {page}</span>
              <Button size="sm" variant="ghost" disabled={items.length < 50} onClick={() => setPage(page + 1)}>
                Siguiente
              </Button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
