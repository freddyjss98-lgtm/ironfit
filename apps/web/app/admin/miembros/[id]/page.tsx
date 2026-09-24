import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import MemberDetailClient from "./MemberDetailClient";
import EntrenamientoClient, { type WorkoutSession, type Routine } from "@/app/portal/progreso/EntrenamientoClient";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!member) notFound();

  // Rol del staff que mira la ficha (para ocultar info sensible a coaches)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const role: "admin" | "coach" = me?.role === "coach" ? "coach" : "admin";

  const [
    { data: memberships },
    { data: attendances },
    { data: progress },
    { data: sales },
    { data: stats },
    { data: memberProfile },
    { data: exercises },
    { data: workoutSessions },
    { data: routinesData },
    { data: plans },
  ] = await Promise.all([
    supabase
      .from("vw_memberships_status")
      .select("id, plan_id, start_date, end_date, paid_amount, status, effective_status, days_until_expiry, cancellation_reason, membership_plans(name, color, duration_days)")
      .eq("member_id", id)
      .order("end_date", { ascending: false }),

    supabase
      .from("attendances")
      .select("id, checked_in_at, checked_in_date")
      .eq("member_id", id)
      .order("checked_in_at", { ascending: false })
      .limit(60),

    supabase
      .from("member_progress")
      .select("*")
      .eq("member_id", id)
      .order("measured_at", { ascending: false }),

    supabase
      .from("sales")
      .select("id, sale_date, total, payment_method, bank_reference, notes")
      .eq("member_id", id)
      .is("voided_at", null)
      .order("sale_date", { ascending: false })
      .limit(30),

    supabase
      .from("vw_attendance_stats")
      .select("*")
      .eq("member_id", id)
      .maybeSingle(),

    member.user_id
      ? supabase.from("profiles").select("role").eq("id", member.user_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),

    // Globales + los propios de ESTE socio (no mostrar los personales de otros).
    supabase
      .from("exercises")
      .select("id, name, muscle_group, is_global")
      .or(`is_global.eq.true,member_id.eq.${id}`)
      .order("name"),

    supabase
      .from("workout_sessions")
      .select("id, session_date, notes, workout_sets(exercise_id, set_number, weight_kg, reps)")
      .eq("member_id", id)
      .order("session_date", { ascending: false }),

    supabase
      .from("routines")
      .select("id, name, notes, routine_exercises(exercise_id, position, target_sets, target_reps)")
      .eq("member_id", id)
      .order("created_at", { ascending: false }),

    supabase
      .from("membership_plans")
      .select("id, name, price, duration_days, color")
      .order("price", { ascending: true }),
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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/miembros"
          className="text-fg/40 hover:text-fg text-sm transition-colors"
        >
          ← Miembros
        </Link>
      </div>

      <MemberDetailClient
        memberRole={(memberProfile?.role as string | null | undefined) ?? null}
        member={member}
        plans={(plans ?? []).map((p) => ({
          id: p.id as string,
          name: p.name as string,
          price: Number(p.price) || 0,
          duration_days: p.duration_days as number,
          color: (p.color as string) ?? "#999",
        }))}
        memberships={(memberships ?? []).map((m) => {
          const plan = m.membership_plans as unknown as {
            name?: string;
            color?: string;
            duration_days?: number;
          } | null;
          return {
            id: m.id,
            member_id: id,
            full_name: member.full_name,
            phone: member.phone,
            plan_id: m.plan_id,
            plan_name: plan?.name ?? "—",
            plan_color: plan?.color ?? "#999",
            plan_duration_days: plan?.duration_days ?? 30,
            start_date: m.start_date,
            end_date: m.end_date,
            paid_amount: Number(m.paid_amount) || 0,
            status: m.status,
            effective_status: m.effective_status,
            days_until_expiry: m.days_until_expiry,
            cancellation_reason: m.cancellation_reason ?? null,
          };
        })}
        attendances={attendances ?? []}
        progress={progress ?? []}
        sales={sales ?? []}
        stats={stats ?? null}
        role={role}
      />

      {/* Entrenamiento (log de fuerza) — el coach puede ver y registrar por el socio */}
      <div className="space-y-3 pt-2">
        <h2 className="font-display text-xl uppercase tracking-tight">Entrenamiento</h2>
        <EntrenamientoClient
          memberId={id}
          canEdit={true}
          exercises={exercises ?? []}
          sessions={workoutSessionRows}
          routines={routineRows}
        />
      </div>
    </div>
  );
}
