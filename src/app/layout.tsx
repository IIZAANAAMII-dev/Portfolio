import type { Metadata, Viewport } from 'next';
import { Caveat, Inter } from 'next/font/google';
import { site } from '@/data/site';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const caveat = Caveat({
  variable: '--font-caveat',
  subsets: ['latin'],
  weight: ['500'],
  display: 'swap',
});

const description = `${site.role} à ${site.location}. Portfolio interactif : un petit archipel où chaque île est une partie de mon travail.`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.role}`,
    template: `%s — ${site.name}`,
  },
  description,
  keywords: ['développeur full stack', 'React', 'Next.js', 'Three.js', 'Marseille', 'portfolio'],
  authors: [{ name: site.name }],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: site.url,
    title: `${site.name} — ${site.role}`,
    description,
    siteName: site.name,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} — ${site.role}`,
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#08121c',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className={`${inter.variable} ${caveat.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
