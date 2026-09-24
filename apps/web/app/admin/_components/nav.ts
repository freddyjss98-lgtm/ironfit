// Navegación del admin, compartida entre el Sidebar (escritorio) y MobileNav (móvil).

export type AdminLink = {
  href: string;
  label: string; // etiqueta completa (sidebar / acordeón)
  short: string; // etiqueta corta (barra inferior)
  glyph: string; // ícono geométrico (sidebar escritorio)
  icon: string; // nombre de ícono de línea (móvil, ver Icon.tsx)
  match?: string[];
  coach?: boolean; // visible también para el rol coach
};

export const ADMIN_NAV: AdminLink[] = [
  { href: "/admin", label: "Dashboard", short: "Inicio", glyph: "▣", icon: "home" },
  { href: "/admin/miembros", label: "Miembros", short: "Miembros", glyph: "◉", icon: "users", coach: true },
  { href: "/admin/asistencia", label: "Asistencia", short: "Asist.", glyph: "→", icon: "check", coach: true },
  {
    href: "/admin/clases",
    label: "Entrenamiento",
    short: "Entrenar",
    glyph: "◌",
    icon: "activity",
    match: ["/admin/clases", "/admin/reservas", "/admin/planificaciones"],
    coach: true,
  },
  {
    href: "/admin/membresias",
    label: "Membresías y pagos",
    short: "Pagos",
    glyph: "◈",
    icon: "card",
    match: ["/admin/membresias", "/admin/renovaciones", "/admin/ventas", "/admin/contabilidad"],
  },
  { href: "/admin/recordatorios", label: "Recordatorios", short: "Avisos", glyph: "◐", icon: "bell" },
  { href: "/admin/productos", label: "Productos", short: "Productos", glyph: "▦", icon: "box" },
  { href: "/admin/coaches", label: "Coaches", short: "Coaches", glyph: "◎", icon: "user" },
  { href: "/admin/eventos", label: "Eventos", short: "Eventos", glyph: "◆", icon: "calendar", coach: true },
  { href: "/admin/cuenta", label: "Mi cuenta", short: "Cuenta", glyph: "◍", icon: "gear", coach: true },
];

// Secciones que van en la barra inferior según el rol (máx 4 + "Más").
export const BOTTOM_HREFS_ADMIN = ["/admin", "/admin/miembros", "/admin/asistencia", "/admin/membresias"];
export const BOTTOM_HREFS_COACH = ["/admin/miembros", "/admin/asistencia", "/admin/clases", "/admin/eventos"];
