'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/lib/format';
import { useFeedback } from '../ui/feedback';
import { Alert, Button, TextField } from '../ui/kit';

const policy = (pw: string) => pw.length >= 10 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

/** Password change. `forced` = first login with a temporary password (the API blocks everything else until done). */
export function ChangePassword({ forced = false, onDone }: { forced?: boolean; onDone?: () => void }) {
  const { changePassword, logout, me } = useAuth();
  const { toast } = useFeedback();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const nextError = touched && !policy(next) ? 'Mínimo 10 caracteres, con letras y números.' : null;
  const repeatError = touched && next !== repeat ? 'Las contraseñas no coinciden.' : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!policy(next) || next !== repeat || !current) return;
    setBusy(true);
    try {
      await changePassword(current, next);
      toast('Contraseña actualizada');
      setCurrent('');
      setNext('');
      setRepeat('');
      setTouched(false);
      onDone?.();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form className="stack" onSubmit={submit} noValidate>
      {forced ? (
        <Alert tone="warning" title="Cambia tu contraseña temporal">
          Por seguridad, debes elegir una contraseña nueva antes de usar el panel.
        </Alert>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <TextField
        label="Contraseña actual"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        required
      />
      <TextField
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        hint="Mínimo 10 caracteres, con letras y números."
        error={nextError}
        required
      />
      <TextField
        label="Repite la nueva contraseña"
        type="password"
        autoComplete="new-password"
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
        error={repeatError}
        required
      />
      <Button type="submit" variant="primary" loading={busy}>
        Guardar contraseña
      </Button>
      {forced ? (
        <Button variant="ghost" onClick={() => void logout()}>
          Cerrar sesión
        </Button>
      ) : null}
    </form>
  );

  if (!forced) return form;
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            LT
          </span>
          <div>
            <h1>Nueva contraseña</h1>
            <p className="muted small">{me?.email}</p>
          </div>
        </div>
        {form}
      </div>
    </main>
  );
}
