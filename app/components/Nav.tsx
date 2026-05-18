import Image from "next/image";
import { nav, site } from "../content";

export default function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-bg/70 border-b border-line">
      <div className="container-x flex items-center justify-between h-16 sm:h-20">
        <a
          href="#top"
          aria-label={site.brand}
          className="flex items-center"
        >
          <Image
            src="/logo/logo-horizontal.png"
            alt={site.brand}
            width={400}
            height={100}
            priority
            className="h-8 sm:h-10 w-auto"
          />
        </a>

        <nav className="hidden md:flex items-center gap-7">
          {nav.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="t-mono-label text-fg-dim hover:text-fg transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <a
          href={nav.cta.href}
          className="t-mono-label dot-pulse border border-line-2 px-4 py-2 hover:border-accent hover:text-accent transition-colors"
          data-cursor-label="Reserva"
        >
          {nav.cta.label}
        </a>
      </div>
    </header>
  );
}
