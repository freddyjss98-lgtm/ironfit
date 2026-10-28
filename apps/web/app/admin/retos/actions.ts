"use server";

// Retos y moderación de la comunidad de la app. Las reglas (solo staff escribe
// retos y oculta publicaciones) viven en el RLS de
// 20261028020418_activities_challenges_community.sql; aquí se valida el
// formulario, se avisa por push y se revalida.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push/expo";
import { todayInEcuador } from "@ironfit/shared/date";
import { revalidatePath } from "next/cache";
import type { ActionData } from "@ironfit/shared/result";

export type ChallengeInput = {
  title: string;
  description: string;
  sport: string;
  goalType: "distance" | "time" | "free";
  /** km para distancia, minutos para tiempo. */
  goalValue: number | null;
  startsOn: string;
  endsOn: string;
  notify: boolean;
};

const SPORTS = ["any", "run", "walk", "bike", "swim", "hike", "other"];

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: staff } = await supabase.rpc("is_staff");
  if (!staff) throw new Error("No tienes permiso para esta acción");
  return { supabase, user };
}

/** Avisa a todos los socios con membresía activa que tengan la app. */
async function pushToActiveMembers(title: string, body: string) {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("memberships")
      .select("members!inner(user_id, deleted_at)")
      .eq("status", "active")
      .gte("end_date", todayInEcuador())
      .is("members.deleted_at", null)
      .not("members.user_id", "is", null);
    const ids = new Set(
      (data ?? []).map((r) => (r.members as unknown as { user_id: string }).user_id)
    );
    await sendPushToUsers([...ids], { title, body, data: { screen: "comunidad" } });
  } catch (err) {
    console.error("[retos] push", err);
  }
}

export async function createChallenge(input: ChallengeInput): Promise<ActionData<null>> {
  try {
    const { supabase } = await requireStaff();
    const title = input.title.trim();
    if (title.length < 3) return { ok: false, error: "Escribe un título (mínimo 3 letras)." };
    if (!SPORTS.includes(input.sport)) return { ok: false, error: "Deporte no válido." };
    if (!input.startsOn || !input.endsOn) return { ok: false, error: "Elige las fechas del reto." };
    if (input.endsOn < input.startsOn) return { ok: false, error: "La fecha de cierre es antes del inicio." };
    if (input.goalType !== "free" && !(input.goalValue && input.goalValue > 0)) {
      return { ok: false, error: input.goalType === "distance" ? "Escribe los km de la meta." : "Escribe los minutos de la meta." };
    }

    const { error } = await supabase.from("challenges").insert({
      title,
      description: input.description.trim() || null,
      sport: input.sport,
      goal_type: input.goalType,
      goal_distance_m: input.goalType === "distance" ? Math.round(input.goalValue! * 1000) : null,
      goal_seconds: input.goalType === "time" ? Math.round(input.goalValue! * 60) : null,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    });
    if (error) return { ok: false, error: error.message };

    if (input.notify) await pushToActiveMembers("🏆 Nuevo reto Iron Fit", title);
    revalidatePath("/admin/retos");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado" };
  }
}

export async function deleteChallenge(id: string): Promise<ActionData<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("challenges").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/retos");
  return { ok: true, data: null };
}

/** Oculta (o vuelve a mostrar) una publicación y cierra sus reportes. */
export async function setPostHidden(postId: string, hidden: boolean): Promise<ActionData<null>> {
  try {
    const { supabase, user } = await requireStaff();
    const { error } = await supabase
      .from("community_posts")
      .update({ hidden_at: hidden ? new Date().toISOString() : null, hidden_by: hidden ? user.id : null })
      .eq("id", postId);
    if (error) return { ok: false, error: error.message };
    if (hidden) await resolveReports(supabase, postId, user.id);
    revalidatePath("/admin/retos");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado" };
  }
}

/** La publicación está bien: se cierran los reportes sin ocultarla. */
export async function dismissReports(postId: string): Promise<ActionData<null>> {
  try {
    const { supabase, user } = await requireStaff();
    const error = await resolveReports(supabase, postId, user.id);
    if (error) return { ok: false, error };
    revalidatePath("/admin/retos");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado" };
  }
}

async function resolveReports(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  userId: string
): Promise<string | null> {
  const { error } = await supabase
    .from("post_reports")
    .update({ resolved_at: new Date().toISOString(), resolved_by: userId })
    .eq("post_id", postId)
    .is("resolved_at", null);
  return error?.message ?? null;
}
