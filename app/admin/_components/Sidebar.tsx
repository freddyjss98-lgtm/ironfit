"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { ADMIN_NAV } from "./nav";

type Props = {
  role?: "admin" | "coach";
};

export default function Sidebar({ role = "admin" }: Props) {
  const pathname = usePathname();
  const visibleLinks = role === "coach" ? ADMIN_NAV.filter((l) => l.coach) : ADMIN_NAV;

  return (
    <>
      {/* Escritorio: sidebar fijo. En móvil se usa MobileNav (acordeón + barra inferior). */}
      <aside
        className="hidden md:flex sticky top-0 left-0 z-40 h-screen w-64 shrink-0
          bg-bg-2 border-r border-line flex-col"
      >
        <div className="px-6 py-5 border-b border-line">
          <Link href="/admin" className="flex items-center gap-3">
            <Image
              src="/logo/icon-square.png"
              alt="Iron Fit"
              width={36}
              height={36}
              className="rounded-sm"
            />
            <div>
              <div className="t-mono-label text-fg-mute leading-none">Iron Fit</div>
              <div className="font-display text-xl text-fg leading-none mt-1">
                {role === "coach" ? "Coach" : "Admin"}
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {visibleLinks.map((link) => {
            const isActive = link.match
              ? link.match.some((m) => pathname === m || pathname.startsWith(m + "/"))
              : link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-6 py-3 t-mono-label transition-colors
                  ${isActive
                    ? "bg-accent/10 text-accent border-l-2 border-accent"
                    : "text-fg-dim hover:text-fg hover:bg-bg/40"
                  }`}
              >
                <span className="text-base w-5 text-center" aria-hidden>
                  {link.glyph}
                </span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t border-line">
          <Link
            href="/"
            className="t-mono-label text-fg-mute hover:text-accent transition-colors"
          >
            ← Ver landing
          </Link>
        </div>
      </aside>
    </>
  );
}
