'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { Spinner } from '../ui/kit';
import { ChangePassword } from './ChangePassword';
import { Shell } from './Shell';

const PUBLIC = ['/login'];

/** Every route except /login needs a staff session; a forced password change blocks everything else. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, me } = useAuth();
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const isPublic = PUBLIC.includes(pathname);

  useEffect(() => {
    if (status === 'anonymous' && !isPublic) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    if (status === 'ready' && isPublic) router.replace('/');
  }, [status, isPublic, pathname, router]);

  if (isPublic) return status === 'ready' ? <Spinner /> : <>{children}</>;
  if (status !== 'ready' || !me) return <Spinner label="Comprobando sesión…" />;
  if (me.mustChangePassword) return <ChangePassword forced />;
  return <Shell>{children}</Shell>;
}
