"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import Icon from "./Icon";

export type NavItem = {
  href: string;
  label: string;
  icon: string; // nombre de ícono (ver Icon.tsx)
  match?: string[];
};

function matches(pathname: string, it: NavItem, roots: string[]) {
  if (it.match) return it.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
  if (roots.includes(it.href)) return pathname === it.href; // raíz: solo exacto
  return pathname === it.href || pathname.startsWith(it.href + "/");
}

/**
 * Navegación móvil compartida (portal y admin):
 *  • Botón "☰ Menú" en el header → despliega un acordeón con TODAS las secciones.
 *  • Barra inferior fija con las secciones principales + "Más" (mismo acordeón).
 * Todo se oculta en escritorio (md+), donde cada shell usa su propia navegación.
 */
export default function MobileNav({
  allItems,
  bottomItems,
  roots = [],
  footer,
}: {
  allItems: NavItem[];
  bottomItems: NavItem[];
  roots?: string[]; // hrefs que solo activan en coincidencia exacta (ej. "/admin", "/portal")
  footer?: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (it: NavItem) => matches(pathname, it, roots);

  const cols = bottomItems.length + 1;

  return (
    <>
      {/* ── Disparador en el header (estático, fácil de encontrar) ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="md:hidden inline-flex items-center gap-1.5 text-sm font-semibold text-fg/80 border border-line hover:border-accent hover:text-fg px-3 py-1.5 rounded-lg transition-colors"
      >
        <span aria-hidden className="text-base leading-none">☰</span>
        <span>Menú</span>
      </button>

      {/* ── Acordeón desplegado desde arriba ── */}
      {open && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute top-0 inset-x-0 bg-bg-2 border-b border-line rounded-b-2xl shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-14 border-b border-line">
              <span className="font-display text-lg uppercase tracking-tight">Menú</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="text-fg/50 hover:text-fg text-2xl leading-none w-9 h-9 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <nav className="p-2">
              {allItems.map((it) => {
                const active = isActive(it);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                      active ? "bg-accent/10 text-accent" : "text-fg/70 hover:bg-white/5 hover:text-fg"
                    }`}
                  >
                    <Icon name={it.icon} className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-medium flex-1">{it.label}</span>
                    <span aria-hidden className={active ? "text-accent" : "text-fg/20"}>›</span>
                  </Link>
                );
              })}
            </nav>

            {footer && <div className="px-4 py-3 border-t border-line">{footer}</div>}
          </div>
        </div>
      )}

      {/* ── Barra inferior fija ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg/95 backdrop-blur border-t border-line grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {bottomItems.map((it) => {
          const active = isActive(it);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-accent" : "text-fg/45 hover:text-fg/80"
              }`}
            >
              <Icon name={it.icon} className="w-[22px] h-[22px]" />
              <span className="truncate max-w-full px-0.5">{it.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-fg/45 hover:text-fg/80 transition-colors"
        >
          <span aria-hidden className="text-lg leading-none">☰</span>
          <span>Más</span>
        </button>
      </nav>
    </>
  );
}
