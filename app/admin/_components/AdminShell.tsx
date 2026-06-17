"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const titles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/asistencia": "Asistencia",
  "/admin/miembros": "Miembros",
  "/admin/membresias": "Membresías y pagos",
  "/admin/renovaciones": "Membresías y pagos",
  "/admin/ventas": "Membresías y pagos",
  "/admin/clases": "Entrenamiento",
  "/admin/reservas": "Entrenamiento",
  "/admin/planificaciones": "Entrenamiento",
  "/admin/recordatorios": "Recordatorios",
  "/admin/planes": "Planes",
  "/admin/productos": "Productos",
  "/admin/coaches": "Coaches",
  "/admin/eventos": "Eventos",
  "/admin/tienda": "Tienda",
  "/admin/cuenta": "Mi cuenta",
};

// Secciones unificadas: cada grupo se navega con pestañas (reutiliza las páginas existentes).
const SECTION_TABS: { match: string[]; tabs: { href: string; label: string }[] }[] = [
  {
    match: ["/admin/clases", "/admin/reservas", "/admin/planificaciones"],
    tabs: [
      { href: "/admin/clases", label: "Clases y planificación" },
      { href: "/admin/reservas", label: "Reservas" },
    ],
  },
  {
    match: ["/admin/membresias", "/admin/renovaciones", "/admin/ventas"],
    tabs: [
      { href: "/admin/membresias", label: "Membresías" },
      { href: "/admin/renovaciones", label: "Renovaciones" },
      { href: "/admin/ventas", label: "Ventas" },
    ],
  },
];

export default function AdminShell({
  children,
  role = "admin",
}: {
  children: ReactNode;
  role?: "admin" | "coach";
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/admin/login") return <>{children}</>;

  // Find longest matching prefix (handles dynamic routes like /admin/miembros/[id])
  const title =
    Object.entries(titles)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([path]) => pathname === path || pathname.startsWith(path + "/"))?.[1] ?? "Admin";

  const section = SECTION_TABS.find((s) =>
    s.match.some((m) => pathname === m || pathname.startsWith(m + "/"))
  );

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar open={open} onClose={() => setOpen(false)} role={role} />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} onMenuClick={() => setOpen(true)} />
        <main className="flex-1 p-4 md:p-8">
          {section && (
            <div className="flex gap-1 border-b border-line mb-6 overflow-x-auto">
              {section.tabs.map((t) => {
                const active = pathname === t.href || pathname.startsWith(t.href + "/");
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 whitespace-nowrap transition-colors ${
                      active
                        ? "border-accent text-fg"
                        : "border-transparent text-fg/40 hover:text-fg/70"
                    }`}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
