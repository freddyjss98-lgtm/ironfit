import Link from "next/link";
import type { ReactNode } from "react";
import { site } from "../content";

// Marco de las páginas legales (privacidad, eliminar cuenta): las enlazan las
// fichas de Google Play y App Store, así que son públicas y de lectura simple.
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <div className="container-x max-w-3xl py-14 md:py-20">
        <Link href="/" className="t-mono-label text-fg-dim hover:text-accent">
          ← {site.brand}
        </Link>
        <h1 className="font-display text-4xl md:text-5xl uppercase tracking-tight mt-6">{title}</h1>
        <p className="t-mono-label text-fg-mute mt-2">Última actualización: {updated}</p>
        <div className="legal mt-10 space-y-6 text-[15px] leading-relaxed text-fg/80 [&_h2]:font-display [&_h2]:text-xl [&_h2]:uppercase [&_h2]:tracking-tight [&_h2]:text-fg [&_h2]:mt-10 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-accent [&_a]:underline [&_strong]:text-fg">
          {children}
        </div>
        <p className="mt-14 pt-6 border-t border-line t-mono-label text-fg-mute">
          {site.brand} · {site.address}
        </p>
      </div>
    </main>
  );
}
