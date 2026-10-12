'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { slugify } from '@/components/forms';
import { useFeedback } from '@/components/ui/feedback';
import { Alert, Badge, Button, Card, Empty, Modal, PageHeader, SelectField, Spinner, TextField } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText, formatDateTime } from '@/lib/format';
import type { Loc } from '@/lib/types';
import { useResource } from '@/lib/use-resource';

interface PageRow {
  _id: string;
  slug: string;
  kind: 'page' | 'legal';
  status: 'draft' | 'published';
  publishedAt?: string;
  updatedAt?: string;
  legalReviewPending?: boolean;
  draft?: { title?: Loc };
}

export default function PagesListPage() {
  const { can } = useAuth();
  const router = useRouter();
  const { toast } = useFeedback();
  const r = useResource<{ items: PageRow[] }>('/api/v1/admin/pages');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'page' | 'legal'>('page');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await api<{ page: { _id: string } }>('/api/v1/admin/pages', {
        method: 'POST',
        body: { slug: slugify(title), kind, draft: { title: { es: title.trim() }, blocks: [], seo: {} } },
      });
      toast('Página creada como borrador');
      router.push(`/content/pages/${res.page._id}`);
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Páginas"
        subtitle="Textos legales y páginas informativas de la web. Se editan en borrador y se publican cuando estén listas."
        actions={
          can('content:write') ? (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Nueva página
            </Button>
          ) : null
        }
      />
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      <Card padded={false}>
        {r.loading ? (
          <Spinner />
        ) : (r.data?.items ?? []).length === 0 ? (
          <Empty icon="file" title="Sin páginas" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Página</th>
                  <th>Dirección</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Actualizada</th>
                </tr>
              </thead>
              <tbody>
                {r.data!.items.map((p) => (
                  <tr key={p._id} className="clickable" onClick={() => router.push(`/content/pages/${p._id}`)}>
                    <td>
                      <Link href={`/content/pages/${p._id}`} onClick={(e) => e.stopPropagation()}>
                        <strong>{p.draft?.title?.es ?? p.slug}</strong>
                      </Link>
                    </td>
                    <td className="mono small">/{p.slug === 'home' ? '' : p.slug}</td>
                    <td>{p.kind === 'legal' ? 'Legal' : 'Página'}</td>
                    <td>
                      {p.status === 'published' ? <Badge tone="green">Publicada</Badge> : <Badge tone="grey">Borrador</Badge>}
                      {p.legalReviewPending ? (
                        <>
                          {' '}
                          <Badge tone="amber">Revisión legal pendiente</Badge>
                        </>
                      ) : null}
                    </td>
                    <td className="small mono">{formatDateTime(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nueva página"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={busy} disabled={title.trim().length < 2} onClick={() => void create()}>
              Crear
            </Button>
          </>
        }
      >
        <div className="stack">
          <TextField label="Título" value={title} onChange={(e) => setTitle(e.target.value)} hint={title ? `Dirección: /${slugify(title)}` : undefined} />
          <SelectField label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as 'page' | 'legal')}>
            <option value="page">Página informativa</option>
            <option value="legal">Texto legal</option>
          </SelectField>
        </div>
      </Modal>
    </>
  );
}
