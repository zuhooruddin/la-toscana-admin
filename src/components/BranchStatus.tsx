'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText, formatTime, readinessLabel } from '@/lib/format';
import { tr, useT } from '@/lib/i18n';
import type { AdminBranch } from '@/lib/types';
import { useFeedback } from './ui/feedback';
import { Badge, Button, Modal, SelectField, TextField } from './ui/kit';

export function orderingBadge(b: AdminBranch) {
  if (!b.ordering?.enabled) return <Badge tone="grey">{tr('Pedidos online desactivados', 'Online ordering disabled')}</Badge>;
  if (b.ordering.paused && (!b.ordering.pausedUntil || new Date(b.ordering.pausedUntil) > new Date()))
    return (
      <Badge tone="amber" dot>
        {tr('En pausa', 'Paused')}
        {b.ordering.pausedUntil ? ` ${tr('hasta', 'until')} ${formatTime(b.ordering.pausedUntil)}` : ''}
      </Badge>
    );
  return (
    <Badge tone="green" dot>
      {tr('Aceptando pedidos', 'Accepting orders')}
    </Badge>
  );
}

/** Pause/resume online ordering during a rush (staff may do this), with an optional automatic resume. */
export function PauseControl({ branch, onChanged }: { branch: AdminBranch; onChanged: () => void }) {
  const { can } = useAuth();
  const { toast } = useFeedback();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState('30');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!can('branch:pause') || !branch.ordering?.enabled) return null;
  const paused = branch.ordering.paused && (!branch.ordering.pausedUntil || new Date(branch.ordering.pausedUntil) > new Date());

  async function send(p: boolean) {
    setBusy(true);
    try {
      await api(`/api/v1/admin/branches/${branch.id}/pause`, {
        method: 'POST',
        body: p ? { paused: true, minutes: minutes ? Number(minutes) : undefined, reason: reason || undefined } : { paused: false },
      });
      toast(p ? t(`Pedidos en pausa en ${branch.name}`, `Orders paused at ${branch.name}`) : t(`${branch.name} vuelve a aceptar pedidos`, `${branch.name} is accepting orders again`));
      setOpen(false);
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {paused ? (
        <Button size="sm" variant="success" icon="play" loading={busy} onClick={() => void send(false)}>
          {t('Reanudar', 'Resume')}
        </Button>
      ) : (
        <Button size="sm" icon="pause" onClick={() => setOpen(true)}>
          {t('Pausar', 'Pause')}
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${t('Pausar pedidos online', 'Pause online orders')} · ${branch.name}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('Cancelar', 'Cancel')}
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void send(true)}>
              {t('Pausar pedidos', 'Pause orders')}
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="muted">{t('La web y la app dejarán de aceptar pedidos nuevos. Los pedidos ya recibidos no cambian.', 'The website and app will stop accepting new orders. Orders already received are not affected.')}</p>
          <SelectField label={t('Duración', 'Duration')} value={minutes} onChange={(e) => setMinutes(e.target.value)}>
            <option value="15">{t('15 minutos', '15 minutes')}</option>
            <option value="30">{t('30 minutos', '30 minutes')}</option>
            <option value="60">{t('1 hora', '1 hour')}</option>
            <option value="120">{t('2 horas', '2 hours')}</option>
            <option value="">{t('Hasta que la reanude', 'Until I resume')}</option>
          </SelectField>
          <TextField
            label={t('Motivo (opcional)', 'Reason (optional)')}
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('Mucha demanda, falta de personal…', 'High demand, short-staffed…')}
          />
        </div>
      </Modal>
    </>
  );
}

export function ReadinessList({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return <span className="muted small">{tr('Falta', 'Missing')}: {codes.map(readinessLabel).join(', ')}</span>;
}
