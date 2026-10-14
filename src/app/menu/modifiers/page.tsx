'use client';

import { useState } from 'react';
import { cleanGroup, GroupEditor, slugify } from '@/components/forms';
import { useFeedback } from '@/components/ui/feedback';
import { MenuSummary } from '@/components/MenuSummary';
import { Icon } from '@/components/ui/Icon';
import { Alert, Badge, Button, Card, Empty, Modal, PageHeader, SearchInput, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText, formatEur } from '@/lib/format';
import type { MenuItem, ModifierGroupDoc, OptionGroup } from '@/lib/types';
import { useResource } from '@/lib/use-resource';
import { useT } from '@/lib/i18n';
import '../menu.css';

export default function ModifiersPage() {
  const t = useT();
  const { can } = useAuth();
  const groups = useResource<{ items: ModifierGroupDoc[] }>('/api/v1/admin/menu/modifier-groups');
  const items = useResource<{ items: MenuItem[] }>('/api/v1/admin/menu/items');
  const [edit, setEdit] = useState<{ group: OptionGroup; isNew: boolean } | null>(null);
  const { toast } = useFeedback();
  const [q, setQ] = useState('');
  const [view, setView] = useState('grid');
  const [sort, setSort] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const all = groups.data?.items ?? [];
  const list = all
    .filter((m) =>
      `${m.group.name.es} ${m.group.name.en ?? ''} ${m.group.choices.map((c) => `${c.name.es} ${c.name.en ?? ''}`).join(' ')}`
        .toLocaleLowerCase()
        .includes(q.toLocaleLowerCase()),
    )
    .sort((a, b) => (sort ? (a.group.name.es ?? '').localeCompare(b.group.name.es ?? '') : 0));
  async function toggleVisible(m: ModifierGroupDoc) {
    setBusy(m.key);
    const published = m.group.published === false;
    try {
      await api(`/api/v1/admin/menu/modifier-groups/${m.key}`, { method: 'PUT', body: cleanGroup({ ...m.group, published }) });
      groups.setData((d) => ({ items: d.items.map((item) => (item.key === m.key ? { ...item, group: { ...item.group, published } } : item)) }));
      toast(t('Visibilidad guardada', 'Visibility saved'));
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }
  const usage = (key: string) => (items.data?.items ?? []).filter((i) => i.sharedGroupKeys.includes(key)).length;

  return (
    <div className="menu-page modifiers-page">
      <PageHeader
        title={t('Extras y opciones', 'Extras & options')}
        subtitle={t(
          'Grupos compartidos por varios productos: suplementos, ingredientes extra, acompañamientos…',
          'Groups shared by several products: supplements, extra ingredients, sides…',
        )}
        actions={
          <>
            <Button icon="layers" aria-pressed={sort} onClick={() => setSort(!sort)}>
              {t('Ordenar A–Z', 'Sort A–Z')}
            </Button>
            <div className="menu-view-buttons">
              <button
                type="button"
                className="icon-btn"
                aria-label={t('Vista de cuadrícula', 'Grid view')}
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
              >
                <Icon name="dashboard" />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={t('Vista de lista', 'List view')}
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                <Icon name="bars" />
              </button>
            </div>
            {can('menu:write') ? (
              <Button
                variant="primary"
                icon="plus"
                onClick={() => setEdit({ isNew: true, group: { key: '', name: { es: '' }, min: 0, max: 1, published: true, choices: [] } })}
              >
                {t('Nuevo grupo', 'New group')}
              </Button>
            ) : null}
          </>
        }
      />
      {groups.error ? <Alert tone="danger">{errorText(groups.error)}</Alert> : null}
      {items.error ? <Alert tone="danger">{errorText(items.error)}</Alert> : null}
      <MenuSummary
        groups
        total={groups.data?.items.length}
        secondary={groups.data ? all.reduce((total, m) => total + m.group.choices.length, 0) : undefined}
        visible={groups.data ? all.filter((m) => m.group.published !== false).length : undefined}
      />
      <div className="menu-filter-bar">
        <SearchInput value={q} onChange={setQ} placeholder={t('Buscar grupos, ingredientes, opciones…', 'Search groups, ingredients, options…')} />
      </div>
      {groups.loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Card>
          <Empty icon="plus" title={t('No hay grupos compartidos', 'No shared groups')} />
        </Card>
      ) : (
        <div className={`modifier-grid ${view === 'list' ? 'modifier-list' : ''}`}>
          {list.map((m) => {
            const g = m.group;
            const active = g.choices.filter((c) => c.status !== 'draft');
            return (
              <Card
                key={m.key}
                className="modifier-card"
                title={
                  <>
                    <span className="group-icon">
                      <Icon name="plus" size={24} />
                    </span>
                    {g.name.es}
                    <small>
                      {items.data ? usage(m.key) : '—'} {t('productos', 'products')}
                    </small>
                  </>
                }
                actions={
                  <>
                    <button
                      type="button"
                      role="switch"
                      className="menu-switch"
                      aria-checked={g.published !== false}
                      disabled={!can('menu:write') || busy !== null}
                      aria-label={t(`Visible: ${g.name.es}`, `Visible: ${g.name.es}`)}
                      onClick={() => void toggleVisible(m)}
                    >
                      <span />
                    </button>
                    {can('menu:write') ? (
                      <Button size="sm" icon="edit" onClick={() => setEdit({ isNew: false, group: g })}>
                        {t('Editar', 'Edit')}
                      </Button>
                    ) : null}
                  </>
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
                </div>
                {g.note ? (
                  <p className="muted small" style={{ marginBottom: 8 }}>
                    {g.note}
                  </p>
                ) : null}
                <div className="chips">
                  {active.slice(0, expanded.includes(m.key) ? undefined : 6).map((c) => (
                    <span key={c.key} className="chip-input" style={{ paddingRight: 10 }}>
                      {c.name.es}
                      {c.priceDeltaCents ? <span className="muted"> +{formatEur(c.priceDeltaCents)}</span> : null}
                    </span>
                  ))}
                  {can('menu:write') ? (
                    <Button size="sm" icon="plus" className="add-option" onClick={() => setEdit({ isNew: false, group: g })}>
                      {t('Añadir opción', 'Add option')}
                    </Button>
                  ) : null}
                  {g.choices.length - active.length ? (
                    <span className="muted small">
                      {g.choices.length - active.length} {t('en borrador', 'in draft')}
                    </span>
                  ) : null}
                </div>
                {active.length > 6 ? (
                  <button
                    type="button"
                    className="view-options"
                    aria-expanded={expanded.includes(m.key)}
                    onClick={() => setExpanded((keys) => (keys.includes(m.key) ? keys.filter((key) => key !== m.key) : [...keys, m.key]))}
                  >
                    {expanded.includes(m.key) ? t('Ver menos', 'Show less') : `${t('Ver todas', 'View all')} (${active.length})`} →
                  </button>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
      {edit ? <GroupModal initial={edit.group} isNew={edit.isNew} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), groups.reload())} /> : null}
    </div>
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
