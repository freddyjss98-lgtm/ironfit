"use client";

import Link from "next/link";
import { signOut } from "../login/actions";

type Props = {
  title: string;
  onMenuClick: () => void;
};

export default function Topbar({ title, onMenuClick }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-line h-14 md:h-16 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={onMenuClick}
          className="md:hidden flex flex-col gap-1.5 justify-center items-center w-9 h-9 border border-line-2 hover:border-accent"
        >
          <span className="block w-4 h-px bg-fg" />
          <span className="block w-4 h-px bg-fg" />
          <span className="block w-4 h-px bg-fg" />
        </button>
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
