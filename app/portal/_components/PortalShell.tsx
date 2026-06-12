"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { portalSignOut } from "../login/actions";

const NAV = [
  { href: "/portal", label: "Mi membresía" },
  { href: "/portal/progreso", label: "Progreso" },
  { href: "/portal/clases", label: "Entrenamiento" },
  { href: "/portal/tienda", label: "Tienda" },
  { href: "/portal/renovar", label: "Renovar" },
  { href: "/portal/perfil", label: "Perfil" },
];

interface PortalShellProps {
  children: React.ReactNode;
  isAdmin?: boolean;
}

export default function PortalShell({ children, isAdmin = false }: PortalShellProps) {
  const pathname = usePathname();

  if (pathname === "/portal/login") return <>{children}</>;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-line">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/portal">
            <Image
              src="/logo/logo-horizontal.png"
              alt="Iron Fit"
              width={191}
              height={30}
              className="h-7 w-auto"
            />
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  pathname === n.href
                    ? "bg-accent text-white"
                    : "text-fg/50 hover:text-fg"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Admin switcher pill — visible only if user has admin role */}
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold bg-accent/10 hover:bg-accent text-accent hover:text-white border border-accent/40 px-3 py-1.5 rounded-lg transition-all"
                title="Ir al panel de administración"
              >
                <span>⚙</span>
                <span>Panel Admin</span>
              </Link>
            )}

            <form action={portalSignOut}>
              <button
                type="submit"
                className="text-xs text-fg/40 hover:text-fg border border-line px-3 py-1.5 rounded transition-colors"
              >
                Salir
              </button>
            </form>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex border-t border-line overflow-x-auto">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex-1 text-center py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                pathname === n.href
                  ? "text-accent border-b-2 border-accent"
                  : "text-fg/40"
              }`}
            >
              {n.label}
            </Link>
          ))}
          {/* Admin tab in mobile — only if admin */}
          {isAdmin && (
            <Link
              href="/admin"
              className="flex-1 text-center py-2.5 text-xs font-medium whitespace-nowrap text-accent border-b-2 border-transparent hover:border-accent transition-colors"
            >
              ⚙ Admin
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
