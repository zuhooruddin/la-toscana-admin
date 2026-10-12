import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';
import { AuthGate } from '@/components/shell/AuthGate';
import { FeedbackProvider } from '@/components/ui/feedback';
import { AuthProvider } from '@/lib/auth';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Panel de gestión · La Toscana', template: '%s · La Toscana Admin' },
  description: 'Panel de gestión de La Toscana Pizzeria',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: '#1c1917' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={manrope.variable}>
      <body>
        <AuthProvider>
          <FeedbackProvider>
            <AuthGate>{children}</AuthGate>
          </FeedbackProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
