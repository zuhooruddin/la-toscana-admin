'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText, formatTime, readinessLabel } from '@/lib/format';
import type { AdminBranch } from '@/lib/types';
import { useFeedback } from './ui/feedback';
import { Badge, Button, Modal, SelectField, TextField } from './ui/kit';

export function orderingBadge(b: AdminBranch) {
  if (!b.ordering?.enabled) return <Badge tone="grey">Pedidos online desactivados</Badge>;
  if (b.ordering.paused && (!b.ordering.pausedUntil || new Date(b.ordering.pausedUntil) > new Date()))
    return (
      <Badge tone="amber" dot>
        En pausa{b.ordering.pausedUntil ? ` hasta ${formatTime(b.ordering.pausedUntil)}` : ''}
      </Badge>
    );
  return (
    <Badge tone="green" dot>
      Aceptando pedidos
    </Badge>
  );
}

/** Pause/resume online ordering during a rush (staff may do this), with an optional automatic resume. */
export function PauseControl({ branch, onChanged }: { branch: AdminBranch; onChanged: () => void }) {
  const { can } = useAuth();
  const { toast } = useFeedback();
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
      toast(p ? `Pedidos en pausa en ${branch.name}` : `${branch.name} vuelve a aceptar pedidos`);
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
          Reanudar
        </Button>
      ) : (
        <Button size="sm" icon="pause" onClick={() => setOpen(true)}>
          Pausar
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Pausar pedidos online · ${branch.name}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void send(true)}>
              Pausar pedidos
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="muted">La web y la app dejarán de aceptar pedidos nuevos. Los pedidos ya recibidos no cambian.</p>
          <SelectField label="Duración" value={minutes} onChange={(e) => setMinutes(e.target.value)}>
            <option value="15">15 minutos</option>
            <option value="30">30 minutos</option>
            <option value="60">1 hora</option>
            <option value="120">2 horas</option>
            <option value="">Hasta que la reanude</option>
          </SelectField>
          <TextField
            label="Motivo (opcional)"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Mucha demanda, falta de personal…"
          />
        </div>
      </Modal>
    </>
  );
}

export function ReadinessList({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return <span className="muted small">Falta: {codes.map(readinessLabel).join(', ')}</span>;
}
