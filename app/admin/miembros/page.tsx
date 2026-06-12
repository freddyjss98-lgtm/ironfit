import { createClient } from "@/lib/supabase/server";
import MembersClient from "./MembersClient";

export default async function MiembrosPage() {
  const supabase = await createClient();

  const [{ data: members, error: membersError }, { data: plans }, { data: archived }] =
    await Promise.all([
      supabase
        .from("vw_members_with_active_membership")
        .select(
          "id, full_name, phone, email, birthday, photo_url, gender, emergency_contact_name, emergency_contact_phone, notes, status, created_at, current_plan_name, current_plan_color, current_start_date, current_end_date, membership_status, days_until_expiry, user_id"
        )
        .order("full_name"),

      supabase
        .from("membership_plans")
        .select("id, name, price, duration_days, color")
        .eq("active", true)
        .order("sort_order"),

      supabase
        .from("members")
        .select("id, full_name, phone, photo_url, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
    ]);

  if (membersError) {
    console.error("[MiembrosPage] Query error:", membersError);
    throw new Error(`Error al cargar miembros: ${membersError.message}`);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Miembros</h2>
        <p className="text-fg/40 text-sm mt-0.5">{members?.length ?? 0} registrados</p>
      </div>

      <MembersClient
        members={members ?? []}
        plans={plans ?? []}
        archived={archived ?? []}
      />
    </div>
  );
}
