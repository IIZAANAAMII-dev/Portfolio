import type { Metadata, Viewport } from 'next';
import { Big_Shoulders, DM_Mono, Fraunces } from 'next/font/google';
import { site } from '@/data/site';
import './globals.css';

/*
 * Typographie : trois voix, comme sur un port breton (rôles et réglages dans globals.css,
 * section « Typographie »).
 *  - Big Shoulders, l'affichage : capitales étroites et grasses, celles des immatriculations
 *    peintes sur les coques et de la signalétique des quais (nom, îles, grands titres).
 *  - Fraunces, le récit : un serif chaleureux à tailles optiques, dont l'italique tient la
 *    voix du carnet (accroches, notes, invitations) et le romain le texte des pages.
 *  - DM Mono, les instruments : étiquettes, boutons, coordonnées, pourcentages, horaires.
 *
 * Sous-ensemble « latin » préchargé : il couvre tout le français (accents, œ, guillemets,
 * apostrophe typographique). Les autres sous-ensembles (latin-ext…) restent servis à la
 * demande par unicode-range, sans préchargement inutile.
 */
const display = Big_Shoulders({
  variable: '--font-big-shoulders',
  subsets: ['latin'],
  // Axe de taille optique : la coupe « Display », plus serrée, s'applique d'elle-même en grand.
  axes: ['opsz'],
  display: 'swap',
});

const serif = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  display: 'swap',
});

const mono = DM_Mono({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
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
  // Plein écran sous l'encoche et la barre d'accueil des iPhone : sans cela, tous les
  // `env(safe-area-inset-*)` de l'interface valent zéro.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${display.variable} ${serif.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
