'use client';

import { useState } from 'react';
import { cleanGroup, GroupEditor, slugify } from '@/components/forms';
import { useFeedback } from '@/components/ui/feedback';
import { Alert, Badge, Button, Card, Empty, Modal, PageHeader, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText, formatEur } from '@/lib/format';
import type { MenuItem, ModifierGroupDoc, OptionGroup } from '@/lib/types';
import { useResource } from '@/lib/use-resource';

export default function ModifiersPage() {
  const { can } = useAuth();
  const groups = useResource<{ items: ModifierGroupDoc[] }>('/api/v1/admin/menu/modifier-groups');
  const items = useResource<{ items: MenuItem[] }>('/api/v1/admin/menu/items');
  const [edit, setEdit] = useState<{ group: OptionGroup; isNew: boolean } | null>(null);
  const usage = (key: string) => (items.data?.items ?? []).filter((i) => i.sharedGroupKeys.includes(key)).length;

  return (
    <>
      <PageHeader
        title="Extras y opciones"
        subtitle="Grupos compartidos por varios productos: suplementos, ingredientes extra, acompañamientos…"
        actions={
          can('menu:write') ? (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => setEdit({ isNew: true, group: { key: '', name: { es: '' }, min: 0, max: 1, published: true, choices: [] } })}
            >
              Nuevo grupo
            </Button>
          ) : null
        }
      />
      {groups.error ? <Alert tone="danger">{errorText(groups.error)}</Alert> : null}
      {groups.loading ? (
        <Spinner />
      ) : (groups.data?.items ?? []).length === 0 ? (
        <Card>
          <Empty icon="plus" title="No hay grupos compartidos" />
        </Card>
      ) : (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {groups.data!.items.map((m) => {
            const g = m.group;
            const active = g.choices.filter((c) => c.status !== 'draft');
            return (
              <Card
                key={m.key}
                title={g.name.es}
                actions={
                  can('menu:write') ? (
                    <Button size="sm" icon="edit" onClick={() => setEdit({ isNew: false, group: g })}>
                      Editar
                    </Button>
                  ) : null
                }
              >
                <div className="row" style={{ marginBottom: 10 }}>
                  {g.published === false ? <Badge tone="grey">Oculto a clientes</Badge> : <Badge tone="green">Visible</Badge>}
                  <Badge tone="blue">
                    Elegir {g.min}–{g.max}
                  </Badge>
                  <span className="muted small">En {usage(m.key)} productos</span>
                </div>
                {g.note ? (
                  <p className="muted small" style={{ marginBottom: 8 }}>
                    {g.note}
                  </p>
                ) : null}
                <div className="chips">
                  {active.slice(0, 24).map((c) => (
                    <span key={c.key} className="chip-input" style={{ paddingRight: 10 }}>
                      {c.name.es}
                      {c.priceDeltaCents ? <span className="muted"> +{formatEur(c.priceDeltaCents)}</span> : null}
                    </span>
                  ))}
                  {active.length > 24 ? <span className="muted small">+{active.length - 24} más</span> : null}
                  {g.choices.length - active.length ? <span className="muted small">{g.choices.length - active.length} en borrador</span> : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {edit ? <GroupModal initial={edit.group} isNew={edit.isNew} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), groups.reload())} /> : null}
    </>
  );
}

function GroupModal({ initial, isNew, onClose, onSaved }: { initial: OptionGroup; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useFeedback();
  const [g, setG] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const body = cleanGroup({ ...g, key: g.key || slugify(g.name.es ?? '') });
    if (!body.name.es?.trim()) return setError('El nombre es obligatorio.');
    if (body.min > body.max) return setError('El mínimo no puede ser mayor que el máximo.');
    if (!body.choices.length) return setError('Añade al menos una opción.');
    setBusy(true);
    setError(null);
    try {
      if (isNew) await api('/api/v1/admin/menu/modifier-groups', { method: 'POST', body });
      else await api(`/api/v1/admin/menu/modifier-groups/${initial.key}`, { method: 'PUT', body });
      toast('Grupo guardado: los cambios ya se ven en la carta');
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Nuevo grupo de extras' : `Editar «${initial.name.es}»`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Guardar grupo
          </Button>
        </>
      }
    >
      <div className="stack">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {!isNew ? <Alert tone="info">Este grupo se usa en varios productos: los cambios se aplican a todos.</Alert> : null}
        <GroupEditor group={g} onChange={setG} lockKey={!isNew} />
      </div>
    </Modal>
  );
}
