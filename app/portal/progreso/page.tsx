import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPortalMember } from "@/lib/portal/get-member";
import PortalProgresoClient from "./PortalProgresoClient";
import ProgresoTabs from "./ProgresoTabs";
import EntrenamientoClient, { type WorkoutSession, type Routine } from "./EntrenamientoClient";

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
    { data: exercises },
    { data: workoutSessions },
    { data: routinesData },
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

    // Globales + los propios de este socio (un staff con cuenta de socio vería
    // los ejercicios personales de todos si no se filtra aquí).
    supabase
      .from("exercises")
      .select("id, name, muscle_group, is_global")
      .or(`is_global.eq.true,member_id.eq.${member.id}`)
      .order("name"),

    supabase
      .from("workout_sessions")
      .select("id, session_date, notes, workout_sets(exercise_id, set_number, weight_kg, reps)")
      .eq("member_id", member.id)
      .order("session_date", { ascending: false }),

    supabase
      .from("routines")
      .select("id, name, notes, routine_exercises(exercise_id, position, target_sets, target_reps)")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false }),
  ]);

  const routineRows: Routine[] = (routinesData ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    notes: (r.notes ?? null) as string | null,
    exercises: ((r.routine_exercises ?? []) as { exercise_id: string; position: number; target_sets: number | null; target_reps: number | null }[])
      .map((re) => ({
        exercise_id: re.exercise_id,
        position: re.position,
        target_sets: re.target_sets,
        target_reps: re.target_reps,
      })),
  }));

  const workoutSessionRows: WorkoutSession[] = (workoutSessions ?? []).map((s) => ({
    id: s.id as string,
    session_date: s.session_date as string,
    notes: (s.notes ?? null) as string | null,
    sets: ((s.workout_sets ?? []) as { exercise_id: string; set_number: number; weight_kg: number; reps: number }[])
      .map((x) => ({
        exercise_id: x.exercise_id,
        set_number: x.set_number,
        weight_kg: Number(x.weight_kg) || 0,
        reps: Number(x.reps) || 0,
      })),
  }));

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
    <ProgresoTabs
      cuerpo={
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
      }
      entreno={
        <EntrenamientoClient
          memberId={null}
          canEdit={true}
          exercises={exercises ?? []}
          sessions={workoutSessionRows}
          routines={routineRows}
        />
      }
    />
  );
}
