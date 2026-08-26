import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { site } from "@/app/content";
import { getPortalMember } from "@/lib/portal/get-member";
import { computeAttendanceStats, type AttendanceStats } from "@/lib/portal/stats";
import PreviewBanner from "./_components/PreviewBanner";
import ProgressRing from "./_components/ProgressRing";
import Icon from "@/app/_components/Icon";

// ── Types ────────────────────────────────────────────────────────────────────
type MembershipRow = {
  id: string;
  start_date: string;
  end_date: string;
  effective_status: string;
  days_until_expiry: number;
  membership_plans: { name: string; duration_days: number; color: string; is_exclusive: boolean } | null;
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
  });
}

// =============================================================================
// Page
// =============================================================================
export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { member, isPreview } = await getPortalMember(supabase, user.id);

  // No member & not admin → contact screen
  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
        <p className="text-fg/40 text-sm">Tu cuenta no está vinculada a ningún atleta.</p>
        <p className="text-fg/30 text-xs">Contacta al gym para que activen tu acceso.</p>
        <a
          href={`https://wa.me/${site.whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          Contactar por WhatsApp
        </a>
      </div>
    );
  }

  // Fetch membership + attendance in parallel
  const [membershipRes, checkInsRes] = await Promise.all([
    supabase
      .from("vw_memberships_status")
      .select(
        "id, start_date, end_date, effective_status, days_until_expiry, membership_plans(name, duration_days, color, is_exclusive)"
      )
      .eq("member_id", member.id)
      .in("status", ["active", "frozen", "expired"]) // cancelled/suspended: no
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("attendances")
      .select("checked_in_date, checked_in_at")
      .eq("member_id", member.id)
      .order("checked_in_at", { ascending: false })
      .limit(400),
  ]);

  const membership = membershipRes.data as MembershipRow | null;
  const stats = computeAttendanceStats(checkInsRes.data ?? []);

  const firstName = member.full_name.split(" ")[0];

  return (
    <div className="space-y-6">
      {isPreview && <PreviewBanner memberName={member.full_name} />}

      {/* ── Greeting + streak ────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-fg/40 text-sm">{greeting()},</p>
          <h1 className="font-display text-3xl sm:text-4xl uppercase tracking-tight leading-none">
            {firstName}
          </h1>
        </div>
        <StreakFlame streak={stats.currentStreak} />
      </div>

      {/* ── Weekly goal + membership ─────────────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-4">
        <WeeklyGoalCard stats={stats} />
        <MembershipCard membership={membership} />
      </div>

      {/* ── Quick stats row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Racha actual" value={stats.currentStreak} unit="días" accent />
        <StatTile label="Mejor racha" value={stats.bestStreak} unit="días" />
        <StatTile label="Este mes" value={stats.visitsThisMonth} unit="visitas" />
        <StatTile label="Total" value={stats.totalVisits} unit="visitas" />
      </div>

      {/* ── Achievements ─────────────────────────────────────────────────── */}
      <AchievementsStrip stats={stats} />

      {/* ── 30-day activity ──────────────────────────────────────────────── */}
      <ActivityHeatmap stats={stats} />

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-fg/35 text-xs uppercase tracking-widest mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(membership?.effective_status !== "active" || (membership?.days_until_expiry ?? 99) <= 14) && (
            <QuickAction href="/portal/renovar" icon="refresh" label="Renovar" highlight />
          )}
          <QuickAction href="/portal/clases" icon="activity" label="Entrenamiento" />
          <QuickAction href="/portal/progreso" icon="chart" label="Progreso y asistencia" />
          <QuickAction href="/portal/renovar" icon="receipt" label="Pagos y renovación" />
          <QuickAction href="/portal/tienda" icon="bag" label="Tienda" />
        </div>
      </div>

      {/* ── Birthday ─────────────────────────────────────────────────────── */}
      {member.birthday && isBirthdayToday(member.birthday) && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-5 py-4 text-center">
          <p className="text-accent font-semibold">¡Feliz cumpleaños, {firstName}! 🎂</p>
          <p className="text-fg/50 text-sm mt-1">El equipo Iron Fit te desea un excelente día.</p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Components
// =============================================================================
function greeting() {
  const h = new Date().toLocaleString("en-US", {
    timeZone: "America/Guayaquil",
    hour: "numeric",
    hour12: false,
  });
  const hour = parseInt(h, 10);
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function StreakFlame({ streak }: { streak: number }) {
  const active = streak > 0;
  return (
    <div
      className={`flex items-center gap-2 px-3.5 py-2 rounded-full border ${
        active
          ? "bg-accent/15 border-accent/40 text-accent"
          : "bg-white/5 border-line text-fg/40"
      }`}
      title="Racha de días entrenando (los domingos no cuentan)"
    >
      <span className="text-lg leading-none">{active ? "🔥" : "💤"}</span>
      <div className="leading-none">
        <p className="font-display text-xl">{streak}</p>
        <p className="text-[10px] uppercase tracking-wider opacity-70 -mt-0.5">racha</p>
      </div>
    </div>
  );
}

function WeeklyGoalCard({ stats }: { stats: AttendanceStats }) {
  const { visitsThisWeek, weeklyGoal, weekStreak } = stats;
  const reached = visitsThisWeek >= weeklyGoal;
  const remaining = Math.max(0, weeklyGoal - visitsThisWeek);

  return (
    <div className="lg:col-span-3 bg-white/5 border border-line rounded-2xl p-6 flex items-center gap-6">
      <ProgressRing value={visitsThisWeek} max={weeklyGoal}>
        <span className="font-display text-3xl leading-none">{visitsThisWeek}</span>
        <span className="text-fg/40 text-xs">de {weeklyGoal}</span>
      </ProgressRing>

      <div className="min-w-0">
        <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">Meta semanal</p>
        <p className="font-display text-2xl uppercase tracking-tight leading-tight">
          {reached ? "¡Meta cumplida! 🎉" : `Faltan ${remaining}`}
        </p>
        <p className="text-fg/50 text-sm mt-1">
          {reached
            ? "Excelente semana, sigue así."
            : `${remaining} entreno${remaining !== 1 ? "s" : ""} más para tu objetivo.`}
        </p>
        {weekStreak > 0 && (
          <div className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold bg-accent/10 text-accent px-2.5 py-1 rounded-full">
            🔥 {weekStreak} semana{weekStreak !== 1 ? "s" : ""} en meta
          </div>
        )}
      </div>
    </div>
  );
}

function MembershipCard({ membership }: { membership: MembershipRow | null }) {
  const plan = membership?.membership_plans ?? null;
  const status = membership?.effective_status ?? "no_membership";
  const daysLeft = membership?.days_until_expiry ?? 0;
  const isActive = status === "active";
  const urgency = daysLeft <= 7 ? "red" : daysLeft <= 14 ? "amber" : "green";

  return (
    <div
      className="lg:col-span-2 relative rounded-2xl p-5 overflow-hidden border border-white/10 flex flex-col justify-between"
      style={{
        background: plan?.color
          ? `linear-gradient(135deg, ${plan.color}22 0%, #0a0a0a 70%)`
          : "rgba(255,255,255,0.04)",
      }}
    >
      {plan?.color && (
        <div
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ background: plan.color }}
        />
      )}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <p className="text-fg/40 text-[10px] uppercase tracking-widest mb-1">Membresía</p>
          <p className="text-lg font-bold leading-tight">{plan?.name ?? "Sin plan"}</p>
          {plan?.is_exclusive && (
            <div className="mt-2 flex flex-col gap-1">
              <span className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-400/25 to-yellow-500/10">
                <span aria-hidden className="text-amber-300 text-sm leading-none">★</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200">
                  Plan exclusivo
                </span>
              </span>
              <span className="text-amber-200/60 text-[11px] leading-tight">
                Reservado solo para ti — gracias por tu fidelidad
              </span>
            </div>
          )}
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
            isActive
              ? urgency === "red"
                ? "bg-red-500/20 text-red-400"
                : urgency === "amber"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-emerald-500/20 text-emerald-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {isActive ? "Activa" : status === "expired" ? "Vencida" : "Sin plan"}
        </span>
      </div>

      {membership ? (
        <div className="relative z-10 mt-4">
          {isActive && (
            <div className="flex items-baseline gap-2">
              <span
                className={`font-display text-4xl ${
                  urgency === "red"
                    ? "text-red-400"
                    : urgency === "amber"
                      ? "text-amber-400"
                      : "text-emerald-400"
                }`}
              >
                {daysLeft}
              </span>
              <span className="text-fg/50 text-sm">días restantes</span>
            </div>
          )}
          <p className="text-fg/40 text-xs mt-1">
            {fmtDate(membership.start_date)} → {fmtDate(membership.end_date)}
          </p>
          {plan && isActive && (
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-3">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(100, (daysLeft / plan.duration_days) * 100))}%`,
                  background: plan.color,
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <Link
          href="/portal/renovar"
          className="relative z-10 mt-4 inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          Activar membresía →
        </Link>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white/5 border border-line rounded-xl p-4">
      <p className="text-fg/40 text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <p className={`font-display text-3xl leading-none ${accent ? "text-accent" : ""}`}>
        {value}
      </p>
      <p className="text-fg/30 text-xs mt-1">{unit}</p>
    </div>
  );
}

function AchievementsStrip({ stats }: { stats: AttendanceStats }) {
  const unlocked = stats.achievements.filter((a) => a.unlocked).length;
  return (
    <div className="bg-white/5 border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-fg/50 text-xs uppercase tracking-widest">Logros</h2>
        <span className="text-fg/30 text-xs">
          {unlocked}/{stats.achievements.length} desbloqueados
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {stats.achievements.map((a) => (
          <div
            key={a.id}
            title={a.description}
            className={`shrink-0 w-24 rounded-xl border p-3 text-center transition-all ${
              a.unlocked
                ? "bg-accent/10 border-accent/30"
                : "bg-white/[0.02] border-line grayscale opacity-50"
            }`}
          >
            <div className="text-2xl mb-1">{a.emoji}</div>
            <p className="text-[11px] font-semibold leading-tight">{a.title}</p>
            {!a.unlocked && a.progress > 0 && (
              <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-accent/60 rounded-full"
                  style={{ width: `${Math.round(a.progress * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityHeatmap({ stats }: { stats: AttendanceStats }) {
  const visitedCount = stats.last30.filter((d) => d.visited).length;
  return (
    <div className="bg-white/5 border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-fg/50 text-xs uppercase tracking-widest">Últimos 30 días</h2>
        <span className="text-fg/30 text-xs">{visitedCount} días entrenados</span>
      </div>
      <div className="grid grid-cols-15 gap-1.5">
        {stats.last30.map((d) => (
          <div
            key={d.date}
            title={`${d.date}${d.visited ? " · Asististe" : ""}`}
            className={`aspect-square rounded-sm ${
              d.visited ? "bg-accent" : "bg-white/5 border border-line/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  highlight,
}: {
  href: string;
  icon: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 py-3.5 px-4 rounded-xl border text-sm font-medium transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
        highlight
          ? "bg-accent hover:bg-accent/80 text-white border-accent shadow-lg shadow-accent/20"
          : "bg-white/5 hover:bg-white/10 border-line text-fg"
      }`}
    >
      <span
        className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${
          highlight ? "bg-white/15 text-white" : "bg-white/5 group-hover:bg-white/10 text-fg/70"
        }`}
      >
        <Icon name={icon} className="w-5 h-5" />
      </span>
      {label}
    </Link>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function isBirthdayToday(birthday: string): boolean {
  const today = new Date();
  const b = new Date(birthday + "T00:00:00");
  return b.getMonth() === today.getMonth() && b.getDate() === today.getDate();
}
