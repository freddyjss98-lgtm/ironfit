import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPortalMember } from "@/lib/portal/get-member";
import PortalProgresoClient from "./PortalProgresoClient";

function ecuadorToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
}

export default async function PortalProgresoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { member, isPreview } = await getPortalMember(supabase, user.id);
  if (!member) redirect("/portal");

  const today = ecuadorToday();

  const [
    { data: progress },
    { data: attendances },
    { data: attStats },
    { data: activeMembership },
  ] = await Promise.all([
    supabase
      .from("member_progress")
      .select(
        "id, measured_at, weight, body_fat, muscle_mass, chest_cm, waist_cm, hips_cm, arm_cm, leg_cm, notes, photo_url, created_by"
      )
      .eq("member_id", member.id)
      .order("measured_at", { ascending: false }),

    supabase
      .from("attendances")
      .select("id, checked_in_at, checked_in_date")
      .eq("member_id", member.id)
      .order("checked_in_at", { ascending: false })
      .limit(90),

    supabase
      .from("vw_attendance_stats")
      .select("total_visits, visits_this_month, visits_last_7_days")
      .eq("member_id", member.id)
      .maybeSingle(),

    supabase
      .from("memberships")
      .select("id")
      .eq("member_id", member.id)
      .eq("status", "active")
      .gte("end_date", today)
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = (progress ?? []).map((p) => ({
    id: p.id,
    measured_at: p.measured_at,
    weight: p.weight,
    body_fat: p.body_fat,
    muscle_mass: p.muscle_mass,
    chest_cm: p.chest_cm,
    waist_cm: p.waist_cm,
    hips_cm: p.hips_cm,
    arm_cm: p.arm_cm,
    leg_cm: p.leg_cm,
    notes: p.notes,
    photo_url: p.photo_url,
    is_own: p.created_by === user.id,
  }));

  const att = attendances ?? [];
  const attendedDates = Array.from(new Set(att.map((a) => a.checked_in_date)));

  return (
    <PortalProgresoClient
      heightCm={member.height_cm}
      targetWeight={member.target_weight}
      isPreview={isPreview}
      memberName={member.full_name}
      progress={rows}
      hasActiveMembership={Boolean(activeMembership)}
      checkedInToday={attendedDates.includes(today)}
      today={today}
      attendanceStats={{
        total: attStats?.total_visits ?? 0,
        thisMonth: attStats?.visits_this_month ?? 0,
        last7: attStats?.visits_last_7_days ?? 0,
      }}
      attendedDates={attendedDates}
      attendanceHistory={att.slice(0, 60)}
    />
  );
}
