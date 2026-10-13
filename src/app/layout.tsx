import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import './globals.css';
import { AuthGate } from '@/components/shell/AuthGate';
import { FeedbackProvider } from '@/components/ui/feedback';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { LANG_COOKIE, type Lang } from '@/lib/i18n-config';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Panel de gestión · La Toscana', template: '%s · La Toscana Admin' },
  description: 'Panel de gestión de La Toscana Pizzeria',
  robots: { index: false, follow: false },
  other: { google: 'notranslate' },
};
export const viewport: Viewport = { themeColor: '#1c1917' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang: Lang = (await cookies()).get(LANG_COOKIE)?.value === 'en' ? 'en' : 'es';
  return (
    <html lang={lang} translate="no" className={manrope.variable}>
      <body>
        <I18nProvider initial={lang}>
          <AuthProvider>
            <FeedbackProvider>
              <AuthGate>{children}</AuthGate>
            </FeedbackProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
