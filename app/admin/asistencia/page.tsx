import { createClient } from "@/lib/supabase/server";
import AsistenciaClient from "./AsistenciaClient";

export const dynamic = "force-dynamic";

export default async function AsistenciaPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: today }] = await Promise.all([
    supabase
      .from("vw_members_with_active_membership")
      .select("id, full_name, phone, status, membership_status, current_end_date")
      .eq("status", "active")
      .order("full_name"),

    supabase
      .from("vw_attendance_today")
      .select("*"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Asistencia</h2>
        <p className="text-fg/40 text-sm mt-0.5">
          Registra entradas al gym en tiempo real
        </p>
      </div>

      <AsistenciaClient
        members={members ?? []}
        todayAttendances={(today ?? []) as any}
      />
    </div>
  );
}
