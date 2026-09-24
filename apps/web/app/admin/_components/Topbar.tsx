"use client";

import Link from "next/link";
import { signOut } from "../login/actions";
import MobileNav, { type NavItem } from "@/app/_components/MobileNav";

type Props = {
  title: string;
  mobileAll: NavItem[];
  mobileBottom: NavItem[];
};

export default function Topbar({ title, mobileAll, mobileBottom }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-line h-14 md:h-16 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-3">
        {/* Navegación móvil: acordeón + barra inferior (oculto en escritorio) */}
        <MobileNav
          allItems={mobileAll}
          bottomItems={mobileBottom}
          roots={["/admin"]}
          footer={
            <div className="flex flex-col gap-2">
              <Link href="/portal" className="inline-flex items-center gap-2 text-sm text-fg/60 hover:text-fg transition-colors">
                Vista usuario
              </Link>
              <form action={signOut}>
                <button type="submit" className="text-sm text-fg/50 hover:text-fg transition-colors">
                  Cerrar sesión
                </button>
              </form>
            </div>
          }
        />
        <h1 className="font-display text-xl md:text-2xl uppercase tracking-tight">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Switch to member portal view */}
        <Link
          href="/portal"
          title="Ver como usuario"
          className="inline-flex items-center gap-1.5 text-xs text-fg/50 hover:text-fg border border-line hover:border-line-2 px-3 py-1.5 rounded transition-colors"
        >
          {/* person icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          <span className="hidden sm:inline">Vista usuario</span>
        </Link>

        <form action={signOut}>
          <button
            type="submit"
            className="text-xs text-fg/40 hover:text-fg/80 transition-colors border border-line px-3 py-1.5 rounded"
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
