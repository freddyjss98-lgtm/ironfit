import { createClient } from "@/lib/supabase/server";

/**
 * Server Component — renders the correct auth/dashboard button based on session.
 *
 * • No session          → "Acceder" → /portal/login
 * • Logged-in admin     → "Panel Admin" → /admin
 * • Logged-in member    → "Mi portal" → /portal
 * • Logged-in, unknown  → "Mi cuenta" → /portal
 */
export default async function NavAuthButton() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    /* ── Not logged in ─────────────────────────────────────────────────────── */
    if (!user) {
      return (
        <a
          href="/portal/login"
          className="t-mono-label border border-line-2 px-3 py-1.5 sm:px-4 sm:py-2 text-fg-dim hover:border-accent hover:text-accent transition-colors"
          data-cursor-label="Acceder"
        >
          Acceder
        </a>
      );
    }

    /* ── Check admin profile ───────────────────────────────────────────────── */
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      return (
        <a
          href="/admin"
          className="t-mono-label border border-accent px-3 py-1.5 sm:px-4 sm:py-2 text-accent hover:bg-accent hover:text-bg transition-colors"
          data-cursor-label="Admin"
        >
          Panel Admin
        </a>
      );
    }

    /* ── Check member with portal access ───────────────────────────────────── */
    const { data: member } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (member) {
      return (
        <a
          href="/portal"
          className="t-mono-label border border-line-2 px-3 py-1.5 sm:px-4 sm:py-2 text-fg-dim hover:border-accent hover:text-accent transition-colors"
          data-cursor-label="Portal"
        >
          Mi portal
        </a>
      );
    }

    /* ── Fallback: logged in but no known role ─────────────────────────────── */
    return (
      <a
        href="/portal"
        className="t-mono-label border border-line-2 px-3 py-1.5 sm:px-4 sm:py-2 text-fg-dim hover:border-accent hover:text-accent transition-colors"
        data-cursor-label="Cuenta"
      >
        Mi cuenta
      </a>
    );
  } catch {
    /* If Supabase is unreachable or env vars missing, render nothing */
    return null;
  }
}
