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
import { useT } from '@/lib/i18n';

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
  const t = useT();
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
      toast(t('Página creada como borrador', 'Page created as a draft'));
      router.push(`/content/pages/${res.page._id}`);
    } catch (e) {
      toast(errorText(e), 'error');
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('Páginas', 'Pages')}
        subtitle={t(
          'Textos legales y páginas informativas de la web. Se editan en borrador y se publican cuando estén listas.',
          'Legal texts and informational pages of the website. They are edited as drafts and published when ready.',
        )}
        actions={
          can('content:write') ? (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              {t('Nueva página', 'New page')}
            </Button>
          ) : null
        }
      />
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      <Card padded={false}>
        {r.loading ? (
          <Spinner />
        ) : (r.data?.items ?? []).length === 0 ? (
          <Empty icon="file" title={t('Sin páginas', 'No pages')} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Página', 'Page')}</th>
                  <th>{t('Dirección', 'Address')}</th>
                  <th>{t('Tipo', 'Type')}</th>
                  <th>{t('Estado', 'Status')}</th>
                  <th>{t('Actualizada', 'Updated')}</th>
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
                    <td>{p.kind === 'legal' ? t('Legal', 'Legal') : t('Página', 'Page')}</td>
                    <td>
                      {p.status === 'published' ? (
                        <Badge tone="green">{t('Publicada', 'Published')}</Badge>
                      ) : (
                        <Badge tone="grey">{t('Borrador', 'Draft')}</Badge>
                      )}
                      {p.legalReviewPending ? (
                        <>
                          {' '}
                          <Badge tone="amber">{t('Revisión legal pendiente', 'Legal review pending')}</Badge>
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
        title={t('Nueva página', 'New page')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t('Cancelar', 'Cancel')}
            </Button>
            <Button variant="primary" loading={busy} disabled={title.trim().length < 2} onClick={() => void create()}>
              {t('Crear', 'Create')}
            </Button>
          </>
        }
      >
        <div className="stack">
          <TextField
            label={t('Título', 'Title')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            hint={title ? `${t('Dirección', 'Address')}: /${slugify(title)}` : undefined}
          />
          <SelectField label={t('Tipo', 'Type')} value={kind} onChange={(e) => setKind(e.target.value as 'page' | 'legal')}>
            <option value="page">{t('Página informativa', 'Informational page')}</option>
            <option value="legal">{t('Texto legal', 'Legal text')}</option>
          </SelectField>
        </div>
      </Modal>
    </>
  );
}
