"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const links = [
  { href: "/admin", label: "Dashboard", icon: "▣" },
  { href: "/admin/miembros", label: "Miembros", icon: "◉" },
  { href: "/admin/membresias", label: "Membresías", icon: "◈" },
  { href: "/admin/planes", label: "Planes", icon: "◇" },
  { href: "/admin/ventas", label: "Ventas", icon: "$" },
  { href: "/admin/clases", label: "Clases", icon: "◌" },
  { href: "/admin/tienda", label: "Tienda", icon: "▤" },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function Sidebar({ open, onClose }: Props) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/60 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 shrink-0
          bg-bg-2 border-r border-line flex flex-col
          transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="px-6 py-5 border-b border-line">
          <Link
            href="/admin"
            className="flex items-center gap-3"
            onClick={onClose}
          >
            <Image
              src="/logo/icon-square.png"
              alt="Iron Fit"
              width={36}
              height={36}
              className="rounded-sm"
            />
            <div>
              <div className="t-mono-label text-fg-mute leading-none">Iron Fit</div>
              <div className="font-display text-xl text-fg leading-none mt-1">Admin</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {links.map((link) => {
            const isActive =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-6 py-3 t-mono-label transition-colors
                  ${isActive
                    ? "bg-accent/10 text-accent border-l-2 border-accent"
                    : "text-fg-dim hover:text-fg hover:bg-bg/40"
                  }`}
              >
                <span className="text-base w-5 text-center" aria-hidden>
                  {link.icon}
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
