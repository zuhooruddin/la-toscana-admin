'use client';

import { useMemo, useState } from 'react';
import { useFeedback } from '@/components/ui/feedback';
import { Alert, Badge, Button, Card, Empty, PageHeader, SearchInput, Spinner, Tabs } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { errorText } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

type Lang = 'es' | 'en';

/** Editable website/app texts (notices, hero copy…). English falls back to Spanish until translated. */
export default function TranslationsPage() {
  const { toast } = useFeedback();
  const [lang, setLang] = useState<Lang>('es');
  const [q, setQ] = useState('');
  const r = useResource<{ strings: Record<string, string>; fallbackKeys: string[] }>(`/api/v1/admin/translations?lang=${lang}`);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const keys = useMemo(
    () =>
      Object.keys(r.data?.strings ?? {})
        .sort()
        .filter((k) => !q || `${k} ${r.data!.strings[k]}`.toLowerCase().includes(q.toLowerCase())),
    [r.data, q],
  );
  const dirty = Object.keys(edits).length;

  async function save() {
    setBusy(true);
    try {
      await api('/api/v1/admin/translations', { method: 'PUT', body: { lang, strings: edits } });
      toast(`${dirty} textos guardados`);
      setEdits({});
      r.reload();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Textos de la web y las apps" subtitle="Avisos y mensajes editables. Los nombres y precios de la carta se editan en Productos." />
      <Tabs
        value={lang}
        onChange={(v) => (setLang(v), setEdits({}))}
        tabs={[
          { value: 'es', label: 'Español' },
          { value: 'en', label: 'English' },
        ]}
      />
      {r.error ? <Alert tone="danger">{errorText(r.error)}</Alert> : null}
      <Card padded={false}>
        <div className="filters" style={{ padding: '14px 14px 0' }}>
          <SearchInput value={q} onChange={setQ} placeholder="Buscar texto…" />
          <span className="spacer" style={{ flex: 1 }} />
          <Button variant="primary" icon="check" disabled={!dirty} loading={busy} onClick={() => void save()}>
            Guardar {dirty ? `(${dirty})` : ''}
          </Button>
        </div>
        {r.loading ? (
          <Spinner />
        ) : keys.length === 0 ? (
          <Empty icon="translate" title="Sin textos" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Clave</th>
                  <th>Texto</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const fallback = lang === 'en' && r.data!.fallbackKeys.includes(k) && edits[k] === undefined;
                  return (
                    <tr key={k}>
                      <td className="mono small">
                        {k}
                        {fallback ? (
                          <div>
                            <Badge tone="amber">Sin traducir (usa el español)</Badge>
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <textarea
                          className="input"
                          aria-label={k}
                          rows={Math.min(6, Math.max(1, Math.ceil((edits[k] ?? r.data!.strings[k] ?? '').length / 90)))}
                          value={edits[k] ?? (fallback ? '' : r.data!.strings[k])}
                          placeholder={fallback ? r.data!.strings[k] : undefined}
                          maxLength={4000}
                          onChange={(e) => setEdits((x) => ({ ...x, [k]: e.target.value }))}
                          style={{ minHeight: 38 }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
