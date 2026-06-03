"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { nav, site } from "../content";

export default function Nav({ authButton }: { authButton?: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-bg/70 border-b border-line">
        <div className="container-x flex items-center justify-between gap-3 h-14 sm:h-20">
          <a
            href="#top"
            aria-label={site.brand}
            className="flex items-center shrink-0"
            onClick={() => setOpen(false)}
          >
            <Image
              src="/logo/logo-horizontal.png"
              alt={site.brand}
              width={400}
              height={100}
              priority
              className="h-7 sm:h-10 w-auto"
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

          <div className="flex items-center gap-2">
            {authButton}
            <a
              href={nav.cta.href}
              className="t-mono-label dot-pulse border border-line-2 px-3 py-1.5 sm:px-4 sm:py-2 hover:border-accent hover:text-accent transition-colors"
              data-cursor-label="Reserva"
            >
              <span className="sm:hidden">Reserva</span>
              <span className="hidden sm:inline">{nav.cta.label}</span>
            </a>

            <button
              type="button"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="md:hidden flex flex-col gap-1.5 justify-center items-center w-10 h-10 border border-line-2 hover:border-accent transition-colors"
            >
              <span
                className={`block w-5 h-px bg-fg transition-transform ${open ? "translate-y-[6px] rotate-45" : ""}`}
              />
              <span
                className={`block w-5 h-px bg-fg transition-opacity ${open ? "opacity-0" : ""}`}
              />
              <span
                className={`block w-5 h-px bg-fg transition-transform ${open ? "-translate-y-[6px] -rotate-45" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      <div
        className={`md:hidden fixed inset-0 z-40 bg-bg/95 backdrop-blur-md transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <div className="container-x pt-24 pb-12 h-full flex flex-col">
          <nav className="flex flex-col gap-1 mt-6">
            {nav.links.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="font-display uppercase text-4xl border-b border-line py-5 hover:text-accent transition-colors"
                style={{
                  transitionDelay: open ? `${i * 60}ms` : "0ms",
                  transform: open ? "translateX(0)" : "translateX(-20px)",
                  opacity: open ? 1 : 0,
                  transitionProperty: "transform, opacity, color",
                  transitionDuration: "400ms",
                }}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {authButton && (
            <div className="mt-8 pt-6 border-t border-line">
              <p className="t-mono-label text-fg-mute mb-3">Tu acceso</p>
              <div onClick={() => setOpen(false)}>{authButton}</div>
            </div>
          )}

          <div className="mt-auto pt-10 border-t border-line">
            <p className="t-mono-label text-fg-mute mb-3">Contacto directo</p>
            <a
              href={`https://wa.me/${site.whatsappNumber}`}
              target="_blank"
              rel="noopener"
              className="block font-condensed text-2xl text-accent hover:text-fg transition-colors"
            >
              {site.whatsappDisplay}
            </a>
            <a
              href={site.instagramUrl}
              target="_blank"
              rel="noopener"
              className="block t-mono-label text-fg-dim hover:text-accent mt-3"
            >
              {site.instagramHandle}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
