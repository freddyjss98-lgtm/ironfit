import { createClient } from "@/lib/supabase/server";
import CoachesClient from "./CoachesClient";

export default async function CoachesPage() {
  const supabase = await createClient();

  const [coachesRes, schedulesRes, membersRes, coachProfilesRes] = await Promise.all([
    supabase
      .from("coaches")
      .select("id, full_name, phone, email, specialty, active")
      .order("active", { ascending: false })
      .order("full_name"),
    supabase
      .from("class_schedules")
      .select("id, coach_id, name, day_of_week, start_time")
      .eq("active", true),
    supabase
      .from("members")
      .select("id, full_name, phone, email, user_id")
      .is("deleted_at", null)
      .not("user_id", "is", null)
      .order("full_name"),
    supabase
      .from("profiles")
      .select("id")
      .eq("role", "coach"),
  ]);

  // Class count and names per coach
  const classCountMap: Record<string, number> = {};
  const classNamesMap: Record<string, string[]> = {};
  for (const s of schedulesRes.data ?? []) {
    if (!s.coach_id) continue;
    classCountMap[s.coach_id] = (classCountMap[s.coach_id] ?? 0) + 1;
    if (!classNamesMap[s.coach_id]) classNamesMap[s.coach_id] = [];
    classNamesMap[s.coach_id].push(s.name);
  }

  const coaches = (coachesRes.data ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    phone: c.phone as string | null,
    email: c.email as string | null,
    specialty: c.specialty as string | null,
    active: c.active as boolean,
    class_count: classCountMap[c.id] ?? 0,
    class_names: classNamesMap[c.id] ?? [],
  }));

  const existingCoachIds = new Set((coachProfilesRes.data ?? []).map((p) => p.id));

  const eligibleMembers = (membersRes.data ?? [])
    .filter((m) => !existingCoachIds.has(m.user_id as string))
    .map((m) => ({
      id: m.id,
      full_name: m.full_name as string,
      phone: m.phone as string | null,
      email: m.email as string | null,
      user_id: m.user_id as string,
    }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Coaches</h2>
        <p className="text-fg/40 text-sm mt-0.5">
          {coaches.filter((c) => c.active).length} activos · {coaches.length} total
        </p>
      </div>
      <CoachesClient coaches={coaches} eligibleMembers={eligibleMembers} />
    </div>
  );
}
