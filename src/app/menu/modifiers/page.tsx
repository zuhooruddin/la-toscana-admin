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
import { useT } from '@/lib/i18n';

export default function ModifiersPage() {
  const t = useT();
  const { can } = useAuth();
  const groups = useResource<{ items: ModifierGroupDoc[] }>('/api/v1/admin/menu/modifier-groups');
  const items = useResource<{ items: MenuItem[] }>('/api/v1/admin/menu/items');
  const [edit, setEdit] = useState<{ group: OptionGroup; isNew: boolean } | null>(null);
  const usage = (key: string) => (items.data?.items ?? []).filter((i) => i.sharedGroupKeys.includes(key)).length;

  return (
    <>
      <PageHeader
        title={t('Extras y opciones', 'Extras & options')}
        subtitle={t(
          'Grupos compartidos por varios productos: suplementos, ingredientes extra, acompañamientos…',
          'Groups shared by several products: supplements, extra ingredients, sides…',
        )}
        actions={
          can('menu:write') ? (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => setEdit({ isNew: true, group: { key: '', name: { es: '' }, min: 0, max: 1, published: true, choices: [] } })}
            >
              {t('Nuevo grupo', 'New group')}
            </Button>
          ) : null
        }
      />
      {groups.error ? <Alert tone="danger">{errorText(groups.error)}</Alert> : null}
      {groups.loading ? (
        <Spinner />
      ) : (groups.data?.items ?? []).length === 0 ? (
        <Card>
          <Empty icon="plus" title={t('No hay grupos compartidos', 'No shared groups')} />
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
                      {t('Editar', 'Edit')}
                    </Button>
                  ) : null
                }
              >
                <div className="row" style={{ marginBottom: 10 }}>
                  {g.published === false ? (
                    <Badge tone="grey">{t('Oculto a clientes', 'Hidden from customers')}</Badge>
                  ) : (
                    <Badge tone="green">{t('Visible', 'Visible')}</Badge>
                  )}
                  <Badge tone="blue">
                    {t('Elegir', 'Choose')} {g.min}–{g.max}
                  </Badge>
                  <span className="muted small">{t(`En ${usage(m.key)} productos`, `In ${usage(m.key)} products`)}</span>
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
                  {active.length > 24 ? (
                    <span className="muted small">
                      +{active.length - 24} {t('más', 'more')}
                    </span>
                  ) : null}
                  {g.choices.length - active.length ? (
                    <span className="muted small">
                      {g.choices.length - active.length} {t('en borrador', 'in draft')}
                    </span>
                  ) : null}
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
  const t = useT();
  const { toast } = useFeedback();
  const [g, setG] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const body = cleanGroup({ ...g, key: g.key || slugify(g.name.es ?? '') });
    if (!body.name.es?.trim()) return setError(t('El nombre es obligatorio.', 'The name is required.'));
    if (body.min > body.max) return setError(t('El mínimo no puede ser mayor que el máximo.', 'The minimum cannot be greater than the maximum.'));
    if (!body.choices.length) return setError(t('Añade al menos una opción.', 'Add at least one option.'));
    setBusy(true);
    setError(null);
    try {
      if (isNew) await api('/api/v1/admin/menu/modifier-groups', { method: 'POST', body });
      else await api(`/api/v1/admin/menu/modifier-groups/${initial.key}`, { method: 'PUT', body });
      toast(t('Grupo guardado: los cambios ya se ven en la carta', 'Group saved: changes are already live on the menu'));
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
      title={isNew ? t('Nuevo grupo de extras', 'New extras group') : `${t('Editar', 'Edit')} «${initial.name.es}»`}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('Cancelar', 'Cancel')}
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            {t('Guardar grupo', 'Save group')}
          </Button>
        </>
      }
    >
      <div className="stack">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {!isNew ? (
          <Alert tone="info">
            {t(
              'Este grupo se usa en varios productos: los cambios se aplican a todos.',
              'This group is used in several products: changes apply to all of them.',
            )}
          </Alert>
        ) : null}
        <GroupEditor group={g} onChange={setG} lockKey={!isNew} />
      </div>
    </Modal>
  );
}
