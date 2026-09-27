import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Atelier — website builder AI",
    template: "%s · Atelier",
  },
  description:
    "Descrivi l'attività, ottieni un sito completo: pagine, testi, SEO e pagine legali. Editor visuale ed export statico autosufficiente. Local-first: funziona anche senza chiavi API.",
  applicationName: "Atelier",
  keywords: ["website builder", "AI", "sito web", "statico", "SEO", "local-first"],
  authors: [{ name: "Atelier" }],
  // La vetrina si indicizza; le pagine interne dichiarano `noindex` per conto loro.
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "it_IT",
    url: siteUrl,
    siteName: "Atelier",
    title: "Atelier — website builder AI",
    description:
      "Un prompt, un sito completo e pubblicabile. Funziona senza chiavi API, l'anteprima è identica all'export.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Atelier — website builder AI",
    description: "Un prompt, un sito completo e pubblicabile: editor visuale ed export statico autosufficiente.",
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0d12",
  colorScheme: "dark" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
