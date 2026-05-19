import type { Metadata, Viewport } from "next";
import {
  Anton,
  Barlow_Condensed,
  Space_Grotesk,
  Space_Mono,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { site } from "./content";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default:
      "Iron Fit Club — Entrenamiento funcional en Loja, Ecuador",
    template: "%s · Iron Fit Club",
  },
  description:
    "Centro de acondicionamiento físico funcional en Loja, Ecuador. Frente a la Facultad de Salud Humana de la UNL. Funcional, musculación, clases grupales. Agenda tu clase de prueba por WhatsApp.",
  keywords: [
    "gimnasio Loja",
    "gym Loja Ecuador",
    "entrenamiento funcional Loja",
    "Iron Fit Club",
    "Iron Fit Loja",
    "clases funcionales Loja",
    "musculación Loja",
    "fitness Loja",
    "acondicionamiento físico Loja",
    "crossfit Loja",
    "entrenador personal Loja",
  ],
  authors: [{ name: "Iron Fit Club" }],
  creator: "Iron Fit Club",
  publisher: "Iron Fit Club",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Iron Fit Club — Entrenamiento funcional en Loja",
    description:
      "Enfócate en tu progreso, no en tus limitaciones. Disciplina, constancia y comunidad.",
    url: site.url,
    siteName: site.brand,
    locale: "es_EC",
    type: "website",
    images: [
      {
        url: "/img/hero.jpg",
        width: 1080,
        height: 1920,
        alt: "Atleta entrenando en Iron Fit Club, Loja",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Iron Fit Club",
    description: "Enfócate en tu progreso, no en tus limitaciones.",
    images: ["/img/hero.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HealthClub",
  name: site.brand,
  description:
    "Centro de acondicionamiento físico funcional. Disciplina, constancia y comunidad.",
  url: site.url,
  telephone: site.whatsappDisplay,
  image: `${site.url}/img/hero.jpg`,
  logo: `${site.url}/logo/logo-horizontal.png`,
  foundingDate: site.foundedISO,
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Manuel Monteros & Antonio Peña Celi",
    addressLocality: "Loja",
    addressRegion: "Loja",
    addressCountry: "EC",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: site.coords.lat,
    longitude: site.coords.lng,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "05:00",
      closes: "10:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "16:00",
      closes: "21:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Saturday",
      opens: "08:00",
      closes: "10:00",
    },
  ],
  sameAs: [site.instagramUrl, site.facebookUrl],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${anton.variable} ${barlowCondensed.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}
    >
      <body className="bg-bg text-fg font-body">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <div className="grain" aria-hidden />
        <Analytics />
      </body>
    </html>
  );
}
