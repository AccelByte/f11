import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://football-11-play.damar-indra.chatgpt.site'),
  title: 'Football 11 — Build your season',
  description: 'Draft a complete football XI and see how it performs across a 38-match season.',
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Football 11',
    title: 'Football 11',
    description: 'Eleven choices. One full season.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Football 11 — Eleven choices. One full season.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Football 11',
    description: 'Eleven choices. One full season.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
