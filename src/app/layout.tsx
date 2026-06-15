import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { Providers } from './providers';
import { ThemeScript } from '@/components/theme/ThemeScript';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { PaletteProvider } from '@/components/theme/PaletteProvider';
import './globals.css';

// IBM Plex Sans — neutral institutional grotesque (display + body). Engineering
// pedigree, not the geometric-humanist "AI startup" look. Max weight is 700;
// any `font-extrabold` (800) callsites fall back to 700, which reads cleaner.
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plex-sans',
  weight: ['400', '500', '600', '700'],
});

// IBM Plex Mono — every numeric cell / price / log. True trading-terminal mono.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plex-mono',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Blackridge',
    template: '%s · Blackridge',
  },
  description:
    'Systematic trading and hedging for digital assets. Research-built strategies, validated before deployment, executed on your own exchange account.',
  applicationName: 'Blackridge',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <PaletteProvider>
            <Providers>{children}</Providers>
          </PaletteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
