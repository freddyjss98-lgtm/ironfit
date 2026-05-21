"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const titles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/miembros": "Miembros",
  "/admin/membresias": "Membresías",
  "/admin/planes": "Planes",
  "/admin/ventas": "Ventas",
  "/admin/clases": "Clases",
  "/admin/tienda": "Tienda",
};

export default function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const title = titles[pathname] ?? "Admin";

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
