'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { orderingBadge, PauseControl, ReadinessList } from '@/components/BranchStatus';
import { slugify } from '@/components/forms';
import { useFeedback } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/Icon';
import { Alert, Badge, Button, Card, Modal, PageHeader, Spinner, TextField } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/lib/branch';
import { errorText } from '@/lib/format';
import type { AdminBranch } from '@/lib/types';

export default function RestaurantsPage() {
  const { can } = useAuth();
  const { branches, loading, reload } = useBranches();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        title="Restaurantes"
        subtitle="Horarios, pedidos online, reparto, pagos y reservas de cada local"
        actions={
          can('branch:create') ? (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Nuevo restaurante
            </Button>
          ) : null
        }
      />
      {loading ? (
        <Spinner />
      ) : (
        <div className="grid-3" style={{ alignItems: 'start' }}>
          {branches.map((b) => (
            <Card
              key={b.id}
              title={b.name}
              actions={
                <Link href={`/restaurants/${b.id}`} className="btn btn-secondary btn-sm">
                  <Icon name="edit" size={15} /> Configurar
                </Link>
              }
            >
              <div className="stack" style={{ gap: 10 }}>
                <p className="muted small">
                  <Icon name="pin" size={14} /> {b.address.line1}, {b.address.postcode ?? ''} {b.address.city}
                </p>
                <div className="row">
                  {orderingBadge(b)}
                  {b.published ? null : <Badge tone="grey">No publicado</Badge>}
                  {b.reservations?.enabled ? <Badge tone="blue">Reservas online</Badge> : null}
                  {b.services?.delivery ? <Badge tone="violet">Reparto</Badge> : null}
                </div>
                <ReadinessList codes={b.readiness?.ordering ?? []} />
                <div className="row-between">
                  <span className="muted small">{b.contact?.phone ?? 'Sin teléfono'}</span>
                  <PauseControl branch={b} onChanged={reload} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {creating ? <CreateModal onClose={() => setCreating(false)} onCreated={reload} /> : null}
    </>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useFeedback();
  const router = useRouter();
  const [name, setName] = useState('La Toscana ');
  const [slug, setSlug] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const s = slug || slugify(name.replace(/^la toscana\s*/i, ''));
    if (!name.trim() || !line1.trim() || !city.trim() || !/^[a-z0-9-]{2,40}$/.test(s)) return setError('Completa nombre, dirección y ciudad.');
    setBusy(true);
    try {
      const r = await api<{ branch: AdminBranch }>('/api/v1/admin/branches', {
        method: 'POST',
        body: { slug: s, name: name.trim(), address: { line1: line1.trim(), city: city.trim(), postcode: postcode.trim() || undefined } },
      });
      toast('Restaurante creado (sin publicar). Completa horario y contacto antes de activarlo.');
      onCreated();
      router.push(`/restaurants/${r.branch.id}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo restaurante"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()}>
            Crear
          </Button>
        </>
      }
    >
      <div className="stack">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        <TextField
          label="Identificador (URL)"
          value={slug}
          placeholder={slugify(name.replace(/^la toscana\s*/i, ''))}
          onChange={(e) => setSlug(slugify(e.target.value))}
          hint="Aparece en la web: /restaurantes/identificador"
        />
        <TextField label="Dirección" value={line1} onChange={(e) => setLine1(e.target.value)} required />
        <div className="grid-2">
          <TextField label="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} required />
          <TextField label="Código postal" value={postcode} inputMode="numeric" maxLength={5} onChange={(e) => setPostcode(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
