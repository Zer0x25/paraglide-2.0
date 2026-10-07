import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { QueryProvider } from '@/components/QueryProvider';
import { AppShell } from '@/components/AppShell';

import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Parapente School MVP',
  description: 'Sistema de agendamiento de vuelos',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ParapenteCRM',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = (await cookies()).get('theme')?.value;
  const dark = theme === 'dark';
  return (
    <html lang="es" className={`h-full antialiased ${dark ? 'dark' : ''}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]+)/);if(m&&m[1]==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-full flex`}>
        <QueryProvider>
          <ThemeProvider>
          <AppShell>
            <Toaster position="top-right" richColors />
            {children}
          </AppShell>
        </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
