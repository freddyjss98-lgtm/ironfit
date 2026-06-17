import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas del panel a las que SÍ puede entrar un coach. El resto se le bloquea.
const COACH_ALLOWED = [
  "/admin/asistencia",
  "/admin/clases",
  "/admin/reservas",
  "/admin/planificaciones",
  "/admin/miembros",
  "/admin/eventos",
  "/admin/cuenta",
];

function coachCanAccess(pathname: string): boolean {
  return COACH_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Login único: el viejo /admin/login ya no existe → al login del portal
  if (pathname === "/admin/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/portal/login";
    return NextResponse.redirect(url);
  }

  // Rol del staff: 'admin' | 'coach' | null (sin fila en profiles = socio)
  let roleCache: string | null | undefined;
  async function getRole(): Promise<string | null> {
    if (roleCache !== undefined) return roleCache;
    if (!user) {
      roleCache = null;
      return null;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const r: string | null = (profile?.role as string | undefined) ?? null;
    roleCache = r;
    return r;
  }

  // ── ADMIN: requiere sesión + rol staff (admin o coach) ─────────────────────
  if (pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    const role = await getRole();
    if (role !== "admin" && role !== "coach") {
      // Socio autenticado → su portal
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      url.search = "";
      return NextResponse.redirect(url);
    }
    // Coach: solo sus secciones; el resto → Asistencia
    if (role === "coach" && !coachCanAccess(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/asistencia";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // ── PORTAL: requiere sesión ────────────────────────────────────────────────
  if (
    pathname.startsWith("/portal") &&
    pathname !== "/portal/login" &&
    pathname !== "/portal/register"
  ) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    // Acceso creado por el admin con contraseña temporal → obligar a cambiarla
    // antes de usar cualquier otra pantalla del portal.
    const mustChange = user.user_metadata?.must_change_password === true;
    if (mustChange && pathname !== "/portal/cambiar-clave") {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/cambiar-clave";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Ya logueado en el login → enrutar por rol
  if (pathname === "/portal/login" && user) {
    const role = await getRole();
    const url = request.nextUrl.clone();
    url.pathname =
      role === "admin" ? "/admin" : role === "coach" ? "/admin/asistencia" : "/portal";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
