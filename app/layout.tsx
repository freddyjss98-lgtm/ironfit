import type { Metadata, Viewport } from "next";
import {
  Anton,
  Barlow_Condensed,
  Space_Grotesk,
  Space_Mono,
} from "next/font/google";
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
  title: "Iron Fit Club — Entrenamiento funcional en Loja, Ecuador",
  description:
    "Centro de acondicionamiento físico funcional en Loja. Entrenamientos dinámicos, seguros y adaptados para todos los niveles. Agenda tu clase de prueba.",
  openGraph: {
    title: "Iron Fit Club",
    description: "Enfócate en tu progreso, no en tus limitaciones.",
    url: "https://ironfitclub.ec",
    siteName: "Iron Fit Club",
    locale: "es_EC",
    type: "website",
  },
};

export const viewport: Viewport = {
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
        {children}
        <div className="grain" aria-hidden />
      </body>
    </html>
  );
}
