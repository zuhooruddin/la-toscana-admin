'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ImageInput, LocInput } from '@/components/forms';
import { useFeedback } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/Icon';
import { Alert, Badge, Button, Card, PageHeader, Spinner, TextField, Toggle } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { config } from '@/lib/config';
import { errorText, formatDateTime } from '@/lib/format';
import type { Loc } from '@/lib/types';
import { useResource } from '@/lib/use-resource';

type Block = { type: string; data: Record<string, unknown> };
interface Version {
  title?: Loc;
  blocks?: Block[];
  seo?: { title?: Loc; description?: Loc; noindex?: boolean };
}
interface PageDoc {
  _id: string;
  slug: string;
  kind: 'page' | 'legal';
  status: 'draft' | 'published';
  legalReviewPending?: boolean;
  publishedAt?: string;
  draft?: Version;
}

const EDITABLE: Record<string, string> = { richText: 'Texto', notice: 'Aviso destacado', cta: 'Botón de llamada a la acción', image: 'Imagen' };
const FIXED: Record<string, string> = {
  hero: 'Portada (automática)',
  menuHighlights: 'Platos destacados (automático)',
  locations: 'Restaurantes (automático)',
};
const asLoc = (v: unknown): Loc => (v && typeof v === 'object' ? (v as Loc) : typeof v === 'string' ? { es: v } : { es: '' });

export default function PageEditor() {
  const { id } = useParams<{ id: string }>();
  const r = useResource<{ page: PageDoc }>(`/api/v1/admin/pages/${id}`);
  if (r.error) return <Alert tone="danger">{errorText(r.error)}</Alert>;
  if (!r.data) return <Spinner />;
  return <Editor key={r.data.page._id} page={r.data.page} reload={r.reload} />;
}

function Editor({ page, reload }: { page: PageDoc; reload: () => void }) {
  const { can } = useAuth();
  const { toast, confirm } = useFeedback();
  const [v, setV] = useState<Version>({ title: page.draft?.title ?? { es: '' }, blocks: page.draft?.blocks ?? [], seo: page.draft?.seo ?? {} });
  const [legalPending, setLegalPending] = useState(Boolean(page.legalReviewPending));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const write = can('content:write');
  const blocks = v.blocks ?? [];
  const setBlock = (i: number, data: Record<string, unknown>) =>
    setV({ ...v, blocks: blocks.map((b, j) => (j === i ? { ...b, data: { ...b.data, ...data } } : b)) });
  const move = (i: number, d: -1 | 1) => {
    const next = [...blocks];
    const [b] = next.splice(i, 1);
    next.splice(i + d, 0, b!);
    setV({ ...v, blocks: next });
  };

  async function run(kind: 'save' | 'publish' | 'unpublish') {
    setBusy(kind);
    setError(null);
    try {
      if (kind !== 'unpublish')
        await api(`/api/v1/admin/pages/${page._id}`, {
          method: 'PATCH',
          body: { draft: v, ...(page.kind === 'legal' ? { legalReviewPending: legalPending } : {}) },
        });
      if (kind === 'publish') {
        if (
          page.kind === 'legal' &&
          legalPending &&
          !(await confirm({
            title: 'Publicar texto legal',
            message: 'Está marcado como «revisión legal pendiente»: la web mostrará un aviso. ¿Publicar igualmente?',
            confirmLabel: 'Publicar',
          }))
        )
          return;
        await api(`/api/v1/admin/pages/${page._id}/publish`, { method: 'POST', body: {} });
      }
      if (kind === 'unpublish') await api(`/api/v1/admin/pages/${page._id}/unpublish`, { method: 'POST', body: {} });
      toast(kind === 'save' ? 'Borrador guardado' : kind === 'publish' ? 'Página publicada' : 'Página retirada de la web');
      reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const url = `${config.websiteUrl}/${page.slug === 'home' ? '' : page.slug}`;
  return (
    <>
      <PageHeader
        back={
          <Link href="/content/pages" className="back-link">
            <Icon name="left" size={15} /> Páginas
          </Link>
        }
        title={v.title?.es || page.slug}
        subtitle={
          <span className="row" style={{ gap: 8 }}>
            {page.status === 'published' ? <Badge tone="green">Publicada {formatDateTime(page.publishedAt)}</Badge> : <Badge tone="grey">Borrador</Badge>}
            <a href={url} target="_blank" rel="noopener noreferrer" className="small">
              Ver en la web ↗
            </a>
          </span>
        }
        actions={
          write ? (
            <>
              {page.status === 'published' ? (
                <Button variant="ghost" loading={busy === 'unpublish'} onClick={() => void run('unpublish')}>
                  Retirar
                </Button>
              ) : null}
              <Button loading={busy === 'save'} onClick={() => void run('save')}>
                Guardar borrador
              </Button>
              <Button variant="primary" loading={busy === 'publish'} onClick={() => void run('publish')}>
                Guardar y publicar
              </Button>
            </>
          ) : null
        }
      />
      {error ? (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}
      <fieldset disabled={!write} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', alignItems: 'start' }}>
          <div className="stack">
            <Card title="Contenido">
              <div className="stack">
                <LocInput label="Título" value={v.title} onChange={(title) => setV({ ...v, title })} required maxLength={120} />
                {blocks.map((b, i) => (
                  <div key={i} className="card" style={{ background: 'var(--surface-2)' }}>
                    <div className="row-between" style={{ marginBottom: 10 }}>
                      <strong>{EDITABLE[b.type] ?? FIXED[b.type] ?? b.type}</strong>
                      <span className="row">
                        <button type="button" className="icon-btn" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                          ↑
                        </button>
                        <button type="button" className="icon-btn" aria-label="Bajar" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}>
                          ↓
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Quitar bloque"
                          onClick={() => setV({ ...v, blocks: blocks.filter((_, j) => j !== i) })}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </span>
                    </div>
                    {b.type === 'richText' ? (
                      <LocInput
                        label="Texto (HTML sencillo: <p>, <h2>, <ul>, <a>, <strong>…)"
                        value={asLoc(b.data.html)}
                        onChange={(html) => setBlock(i, { html })}
                        multiline
                        maxLength={20000}
                      />
                    ) : b.type === 'notice' ? (
                      <LocInput label="Aviso" value={asLoc(b.data.text)} onChange={(text) => setBlock(i, { text })} multiline maxLength={600} />
                    ) : b.type === 'cta' ? (
                      <div className="stack">
                        <LocInput
                          label="Texto del botón"
                          value={asLoc(b.data.label ?? b.data.title)}
                          onChange={(label) => setBlock(i, { label })}
                          maxLength={80}
                        />
                        <TextField
                          label="Enlace"
                          value={String(b.data.href ?? '')}
                          placeholder="/carta"
                          onChange={(e) => setBlock(i, { href: e.target.value })}
                        />
                      </div>
                    ) : b.type === 'image' ? (
                      <div className="stack">
                        <ImageInput label="Imagen" value={(b.data.url as string) ?? null} onChange={(url) => setBlock(i, { url })} purpose="page" />
                        <LocInput label="Texto alternativo" value={asLoc(b.data.alt)} onChange={(alt) => setBlock(i, { alt })} maxLength={200} />
                        <LocInput label="Pie de foto" value={asLoc(b.data.caption)} onChange={(caption) => setBlock(i, { caption })} maxLength={200} />
                      </div>
                    ) : (
                      <p className="muted small">Este bloque se genera automáticamente con los datos de la carta y los restaurantes.</p>
                    )}
                  </div>
                ))}
                {write ? (
                  <div className="row">
                    {Object.entries(EDITABLE).map(([type, label]) => (
                      <Button key={type} size="sm" icon="plus" onClick={() => setV({ ...v, blocks: [...blocks, { type, data: {} }] })}>
                        {label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
          <div className="stack">
            <Card title="Buscadores">
              <div className="stack">
                <LocInput label="Título SEO" value={v.seo?.title} onChange={(title) => setV({ ...v, seo: { ...v.seo, title } })} maxLength={70} />
                <LocInput
                  label="Descripción SEO"
                  value={v.seo?.description}
                  onChange={(description) => setV({ ...v, seo: { ...v.seo, description } })}
                  multiline
                  maxLength={170}
                />
                <Toggle label="Ocultar a los buscadores" checked={Boolean(v.seo?.noindex)} onChange={(noindex) => setV({ ...v, seo: { ...v.seo, noindex } })} />
              </div>
            </Card>
            {page.kind === 'legal' ? (
              <Card title="Revisión legal">
                <Toggle
                  label="Revisión legal pendiente"
                  hint="La web muestra un aviso mientras esté marcado. Desmárcalo cuando un abogado lo haya revisado."
                  checked={legalPending}
                  onChange={setLegalPending}
                />
              </Card>
            ) : null}
          </div>
        </div>
      </fieldset>
    </>
  );
}
