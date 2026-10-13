'use client';

import { useMemo, useState } from 'react';
import { useFeedback } from '@/components/ui/feedback';
import { Alert, Badge, Button, Card, Empty, PageHeader, SearchInput, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { centsToInput, errorText, formatEur, parseEur } from '@/lib/format';
import type { Category, Loc } from '@/lib/types';
import { useResource } from '@/lib/use-resource';
import { useT } from '@/lib/i18n';

interface Row {
  itemId: string;
  slug: string;
  name: Loc;
  categoryKey: string;
  basePriceCents: number;
  priceCentsOverride: number | null;
  available: boolean;
  soldOut: boolean;
  status: 'confirmed' | 'pending_confirmation';
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function AvailabilityPage() {
  const t = useT();
  const { can } = useAuth();
  const { branches, selected, select } = useBranches();
  const { toast } = useFeedback();
  const branchId = selected !== 'all' ? selected : null;
  const rows = useResource<{ items: Row[] }>(branchId ? `/api/v1/admin/branches/${branchId}/menu` : null);
  const cats = useResource<{ items: Category[] }>('/api/v1/admin/menu/categories');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'' | 'off' | 'soldout' | 'pending'>('');
  const [busy, setBusy] = useState<string | null>(null);
  const canWrite = can('menu:write');

  const catName = useMemo(() => new Map((cats.data?.items ?? []).map((c) => [c.key, c.name.es])), [cats.data]);
  const list = (rows.data?.items ?? [])
    .filter((r) => (filter === 'off' ? !r.available : filter === 'soldout' ? r.soldOut : filter === 'pending' ? r.status === 'pending_confirmation' : true))
    .filter((r) => !q || norm(r.name.es ?? '').includes(norm(q)));

  async function patch(r: Row, body: Record<string, unknown>, msg: string) {
    if (!branchId) return;
    setBusy(r.itemId);
    try {
      await api(`/api/v1/admin/branches/${branchId}/menu/${r.itemId}`, { method: 'PATCH', body });
      rows.setData((d) => ({ items: d.items.map((x) => (x.itemId === r.itemId ? { ...x, ...body } : x)) }));
      toast(msg);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function confirmAll() {
    if (!branchId) return;
    const pending = (rows.data?.items ?? []).filter((r) => r.status === 'pending_confirmation');
    setBusy('all');
    try {
      for (const r of pending)
        await api(`/api/v1/admin/branches/${branchId}/menu/${r.itemId}`, { method: 'PATCH', body: { available: true, status: 'confirmed' } });
      toast(t(`${pending.length} productos confirmados en este restaurante`, `${pending.length} products confirmed at this restaurant`));
      rows.reload();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = (rows.data?.items ?? []).filter((r) => r.status === 'pending_confirmation').length;
  return (
    <>
      <PageHeader
        title={t('Disponibilidad', 'Availability')}
        subtitle={t(
          'Qué se puede pedir en cada restaurante, productos agotados y precios propios',
          'What can be ordered at each restaurant, sold-out items and own prices',
        )}
      />
      {!branchId ? (
        <Card>
          <p style={{ marginBottom: 12 }}>{t('Elige un restaurante:', 'Choose a restaurant:')}</p>
          <div className="row">
            {branches.map((b) => (
              <Button key={b.id} onClick={() => select(b.id)}>
                {b.name}
              </Button>
            ))}
          </div>
        </Card>
      ) : (
        <>
          {pendingCount ? (
            <div style={{ marginBottom: 16 }}>
              <Alert
                tone="warning"
                title={t(
                  `${pendingCount} productos pendientes de confirmar en este restaurante`,
                  `${pendingCount} products awaiting confirmation at this restaurant`,
                )}
              >
                {t(
                  'Hasta que confirmes qué productos se sirven aquí no aparecen como disponibles para pedir.',
                  'Until you confirm which products are served here, they do not appear as available to order.',
                )}
                {canWrite ? (
                  <div style={{ marginTop: 8 }}>
                    <Button size="sm" variant="primary" loading={busy === 'all'} onClick={() => void confirmAll()}>
                      {t('Confirmar todos como disponibles', 'Confirm all as available')}
                    </Button>
                  </div>
                ) : null}
              </Alert>
            </div>
          ) : null}
          <Card padded={false}>
            <div className="filters" style={{ padding: '14px 14px 0' }}>
              <SearchInput value={q} onChange={setQ} placeholder={t('Buscar producto…', 'Search product…')} />
              <select className="input" aria-label={t('Filtro', 'Filter')} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                <option value="">{t('Todos', 'All')}</option>
                <option value="off">{t('No disponibles', 'Unavailable')}</option>
                <option value="soldout">{t('Agotados', 'Sold out')}</option>
                <option value="pending">{t('Pendientes de confirmar', 'Awaiting confirmation')}</option>
              </select>
            </div>
            {rows.loading ? (
              <Spinner />
            ) : list.length === 0 ? (
              <Empty icon="toggle" title={t('Ningún producto con este filtro', 'No products match this filter')} />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('Producto', 'Product')}</th>
                      <th>{t('Categoría', 'Category')}</th>
                      <th>{t('Disponible aquí', 'Available here')}</th>
                      <th>{t('Agotado hoy', 'Sold out today')}</th>
                      <th className="num">{t('Precio', 'Price')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.itemId}>
                        <td>
                          <strong>{r.name.es}</strong>
                          {r.status === 'pending_confirmation' ? (
                            <div>
                              <Badge tone="amber">{t('Pendiente de confirmar', 'Awaiting confirmation')}</Badge>
                            </div>
                          ) : null}
                        </td>
                        <td>{catName.get(r.categoryKey) ?? r.categoryKey}</td>
                        <td>
                          <button
                            type="button"
                            role="switch"
                            className="switch"
                            aria-checked={r.available}
                            aria-label={`${t('Disponible', 'Available')}: ${r.name.es}`}
                            disabled={!canWrite || busy === r.itemId}
                            onClick={() =>
                              void patch(
                                r,
                                { available: !r.available, status: 'confirmed' },
                                `${r.name.es}: ${!r.available ? t('disponible', 'available') : t('no disponible', 'unavailable')}`,
                              )
                            }
                          >
                            <span />
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            role="switch"
                            className="switch"
                            style={r.soldOut ? { background: 'var(--red)' } : undefined}
                            aria-checked={r.soldOut}
                            aria-label={`${t('Agotado', 'Sold out')}: ${r.name.es}`}
                            disabled={!r.available || busy === r.itemId}
                            onClick={() =>
                              void patch(
                                r,
                                { soldOut: !r.soldOut },
                                `${r.name.es}: ${!r.soldOut ? t('marcado como agotado', 'marked as sold out') : t('vuelve a estar disponible', 'available again')}`,
                              )
                            }
                          >
                            <span />
                          </button>
                        </td>
                        <td className="num">
                          <PriceOverride
                            row={r}
                            disabled={!canWrite || busy === r.itemId}
                            onSave={(cents) =>
                              void patch(
                                r,
                                { priceCentsOverride: cents },
                                cents === null
                                  ? t('Precio general restaurado', 'Standard price restored')
                                  : `${t('Precio propio', 'Own price')}: ${formatEur(cents)}`,
                              )
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}

function PriceOverride({ row, disabled, onSave }: { row: Row; disabled: boolean; onSave: (cents: number | null) => void }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(centsToInput(row.priceCentsOverride ?? row.basePriceCents));
  if (!editing)
    return (
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={disabled}
        onClick={() => setEditing(true)}
        title={t('Cambiar precio en este restaurante', 'Change price at this restaurant')}
      >
        {row.priceCentsOverride !== null ? (
          <>
            <s className="muted">{formatEur(row.basePriceCents)}</s> <strong>{formatEur(row.priceCentsOverride)}</strong>
          </>
        ) : (
          formatEur(row.basePriceCents)
        )}
      </button>
    );
  const cents = parseEur(text);
  return (
    <span className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
      <input
        className="input"
        style={{ width: 90 }}
        aria-label={t('Precio en este restaurante', 'Price at this restaurant')}
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <Button size="sm" variant="primary" disabled={cents === null} onClick={() => (setEditing(false), onSave(cents === row.basePriceCents ? null : cents))}>
        OK
      </Button>
      {row.priceCentsOverride !== null ? (
        <Button size="sm" variant="ghost" onClick={() => (setEditing(false), onSave(null))}>
          {t('Quitar', 'Remove')}
        </Button>
      ) : null}
    </span>
  );
}
