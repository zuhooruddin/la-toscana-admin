'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { useLang, useT } from '@/lib/i18n';
import { Spinner } from '../ui/kit';
import { ChangePassword } from './ChangePassword';
import { Shell } from './Shell';

const PUBLIC = ['/login'];

/** Every route except /login needs a staff session; a forced password change blocks everything else. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, me } = useAuth();
  const { lang } = useLang();
  const t = useT();
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const isPublic = PUBLIC.includes(pathname);

  useEffect(() => {
    if (status === 'anonymous' && !isPublic) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    if (status === 'ready' && isPublic) router.replace('/');
  }, [status, isPublic, pathname, router]);

  if (isPublic) return status === 'ready' ? <Spinner /> : <Fragment key={lang}>{children}</Fragment>;
  if (status !== 'ready' || !me) return <Spinner label={t('Comprobando sesión…', 'Checking session…')} />;
  if (me.mustChangePassword) return <ChangePassword forced />;
  return <Shell key={lang}>{children}</Shell>;
}
