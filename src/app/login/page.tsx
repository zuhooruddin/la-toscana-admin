'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Alert, Button, TextField } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth';
import { errorText } from '@/lib/format';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) return setError('Introduce tu correo y contraseña.');
    setBusy(true);
    try {
      await login(email.trim(), password);
      const next = params.get('next');
      // Only same-app relative paths: never redirect to another origin.
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="brand">
          <span className="logo" aria-hidden="true">
            LT
          </span>
          <div>
            <h1>Panel de gestión</h1>
            <p className="muted small">La Toscana Pizzeria</p>
          </div>
        </div>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <TextField
          label="Correo electrónico"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <TextField label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" variant="primary" loading={busy}>
          Entrar
        </Button>
        <p className="muted small">Acceso solo para el equipo de La Toscana. Las cuentas las crea el propietario o un encargado.</p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
