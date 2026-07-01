"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { portalSignOut } from "../login/actions";
import MobileNav, { type NavItem } from "@/app/_components/MobileNav";

const NAV = [
  { href: "/portal", label: "Mi membresía" },
  { href: "/portal/progreso", label: "Progreso" },
  { href: "/portal/clases", label: "Entrenamiento" },
  { href: "/portal/tienda", label: "Tienda" },
  { href: "/portal/renovar", label: "Renovar" },
  { href: "/portal/perfil", label: "Perfil" },
];

// Navegación móvil (íconos de línea sutiles)
const MOBILE_ALL: NavItem[] = [
  { href: "/portal", label: "Mi membresía", icon: "card" },
  { href: "/portal/progreso", label: "Progreso", icon: "chart" },
  { href: "/portal/clases", label: "Entrenamiento", icon: "activity" },
  { href: "/portal/tienda", label: "Tienda", icon: "bag" },
  { href: "/portal/renovar", label: "Renovar", icon: "refresh" },
  { href: "/portal/perfil", label: "Perfil", icon: "user" },
];
const MOBILE_BOTTOM: NavItem[] = [
  { href: "/portal", label: "Membresía", icon: "card" },
  { href: "/portal/progreso", label: "Progreso", icon: "chart" },
  { href: "/portal/clases", label: "Entrenar", icon: "activity" },
  { href: "/portal/perfil", label: "Perfil", icon: "user" },
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

          <nav className="hidden md:flex items-center gap-1">
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
                className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold bg-accent/10 hover:bg-accent text-accent hover:text-white border border-accent/40 px-3 py-1.5 rounded-lg transition-all"
                title="Ir al panel de administración"
              >
                <span>⚙</span>
                <span>Panel Admin</span>
              </Link>
            )}

            <form action={portalSignOut} className="hidden md:block">
              <button
                type="submit"
                className="text-xs text-fg/40 hover:text-fg border border-line px-3 py-1.5 rounded transition-colors"
              >
                Salir
              </button>
            </form>

            {/* Navegación móvil: acordeón arriba + barra inferior */}
            <MobileNav
              allItems={MOBILE_ALL}
              bottomItems={MOBILE_BOTTOM}
              roots={["/portal"]}
              footer={
                <div className="flex flex-col gap-2">
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent/80 transition-colors"
                    >
                      Panel de administración
                    </Link>
                  )}
                  <form action={portalSignOut}>
                    <button
                      type="submit"
                      className="text-sm text-fg/50 hover:text-fg transition-colors"
                    >
                      Cerrar sesión
                    </button>
                  </form>
                </div>
              }
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  );
}
