"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function portalSignIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string) || "";

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(
      `/portal/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`
    );
  }

  // ── Si el usuario es staff (tiene fila en profiles) → panel admin ─────────
  if (signInData.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", signInData.user.id)
      .maybeSingle();

    if (profile) {
      redirect("/admin");
    }
  }

  // ── Socio → portal (nunca lo enviamos a /admin aunque venga en `next`) ────
  redirect(next && !next.startsWith("/admin") ? next : "/portal");
}

export async function portalSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/portal/login");
}
