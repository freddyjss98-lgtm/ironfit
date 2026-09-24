import { createClient } from "@/lib/supabase/server";

/**
 * Server Component — Hero section auth CTA.
 *
 * • No session      → "Iniciar sesión" + "Registrarse"
 * • Admin           → "Ir al panel admin →"
 * • Member          → "Ir a mi portal →"
 */
export default async function HeroAuthCTA() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    /* ── Not logged in ─────────────────────────────────────────────────────── */
    if (!user) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/portal/login"
            className="t-mono-label inline-flex items-center gap-2 border border-line-2 px-6 py-4 hover:border-accent hover:text-accent transition-colors text-fg-dim"
          >
            Iniciar sesión
          </a>
          <a
            href="/portal/register"
            className="t-mono-label inline-flex items-center gap-2 bg-surface border border-line-2 px-6 py-4 hover:border-fg hover:text-fg transition-colors text-fg-dim"
          >
            Registrarse
          </a>
        </div>
      );
    }

    /* ── Check admin ───────────────────────────────────────────────────────── */
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      return (
        <a
          href="/admin"
          className="t-mono-label inline-flex items-center gap-2 border border-accent text-accent px-6 py-4 hover:bg-accent hover:text-bg transition-colors font-semibold"
        >
          Ir al panel admin
          <span aria-hidden>→</span>
        </a>
      );
    }

    /* ── Check member ──────────────────────────────────────────────────────── */
    const { data: member } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (member) {
      return (
        <a
          href="/portal"
          className="t-mono-label inline-flex items-center gap-2 border border-line-2 px-6 py-4 hover:border-accent hover:text-accent transition-colors text-fg-dim"
        >
          Ir a mi portal
          <span aria-hidden>→</span>
        </a>
      );
    }

    /* ── Fallback ──────────────────────────────────────────────────────────── */
    return (
      <a
        href="/portal"
        className="t-mono-label inline-flex items-center gap-2 border border-line-2 px-6 py-4 hover:border-accent hover:text-accent transition-colors text-fg-dim"
      >
        Mi cuenta
        <span aria-hidden>→</span>
      </a>
    );
  } catch {
    return null;
  }
}
