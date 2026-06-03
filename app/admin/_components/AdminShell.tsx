"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const titles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/asistencia": "Asistencia",
  "/admin/miembros": "Miembros",
  "/admin/membresias": "Membresías",
  "/admin/recordatorios": "Recordatorios",
  "/admin/planes": "Planes",
  "/admin/ventas": "Ventas",
  "/admin/clases": "Clases",
  "/admin/tienda": "Tienda",
};

export default function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/admin/login") return <>{children}</>;

  // Find longest matching prefix (handles dynamic routes like /admin/miembros/[id])
  const title =
    Object.entries(titles)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([path]) => pathname === path || pathname.startsWith(path + "/"))?.[1] ?? "Admin";

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} onMenuClick={() => setOpen(true)} />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
