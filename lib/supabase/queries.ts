import { createClient } from "./server";
import { todayInEcuador, addDays } from "@/lib/date";

export async function getDashboardStats() {
  const supabase = await createClient();

  const today = todayInEcuador();
  const startOfMonth = today.slice(0, 7) + "-01";
  const thirtyDaysAgo = addDays(today, -29);
  const currentYear = new Date().getFullYear();

  const [
    activeMembers,
    expiringRows,
    todaySales,
    monthSales,
    todayAttendance,
    newMembersMonth,
    dailySales30,
    yearlySalesRaw,
    saleItemsRaw,
    activeMshpsRaw,
    expiredMshpsRaw,
    currentActiveMshpsRaw,
    activeMembersDetailRaw,
    attendanceStatsRaw,
    pendingRenewalsRaw,
    newMembersRaw,
  ] = await Promise.all([
    supabase
      .from("vw_members_with_active_membership")
      .select("id", { count: "exact", head: true })
      .eq("membership_status", "active"),

    supabase
      .from("vw_expiring_soon")
      .select("membership_id, full_name, phone, plan_name, end_date, days_left")
      .order("days_left"),

    supabase
      .from("vw_daily_sales")
      .select("total_amount, sale_count")
      .eq("sale_date", today)
      .maybeSingle(),

    supabase
      .from("vw_monthly_sales")
      .select("total_amount, sale_count, unique_members")
      .eq("month", startOfMonth)
      .maybeSingle(),

    supabase
      .from("attendances")
      .select("id", { count: "exact", head: true })
      .eq("checked_in_date", today),

    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfMonth),

    supabase
      .from("vw_daily_sales")
      .select("sale_date, total_amount")
      .gte("sale_date", thirtyDaysAgo)
      .order("sale_date"),

    supabase
      .from("vw_monthly_sales")
      .select("month, total_amount")
      .gte("month", `${currentYear}-01-01`)
      .order("month"),

    // All sale_items (small dataset for a gym)
    supabase
      .from("sale_items")
      .select("description, item_type, quantity, unit_price"),

    // Active memberships with plan details (for MRR + distribution)
    supabase
      .from("memberships")
      .select("paid_amount, membership_plans(name, color, duration_days, price)")
      .eq("status", "active")
      .gte("end_date", today),

    // Memberships that expired naturally in last 30 days (for churn)
    supabase
      .from("memberships")
      .select("member_id")
      .eq("status", "active")
      .gte("end_date", thirtyDaysAgo)
      .lt("end_date", today),

    // Currently active member IDs (for churn denominator)
    supabase
      .from("memberships")
      .select("member_id")
      .eq("status", "active")
      .gte("end_date", today),

    // Active members detail (for at-risk / inactivity detection)
    supabase
      .from("vw_members_with_active_membership")
      .select("id, full_name, phone, current_plan_name, current_end_date, days_until_expiry, created_at")
      .eq("membership_status", "active"),

    // Last visit per member
    supabase.from("vw_attendance_stats").select("member_id, last_visit"),

    // Solicitudes de renovación pendientes (notificación del dashboard)
    supabase
      .from("renewal_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),

    // Socios auto-registrados pendientes de revisar (notificación del dashboard)
    supabase
      .from("members")
      .select("id, full_name, phone, created_at")
      .is("reviewed_at", null)
      .order("created_at", { ascending: false }),
  ]);

  // ── Top 5 items by revenue ────────────────────────────────────────────────
  type TopItem = { description: string; item_type: string; revenue: number; units: number };
  const itemMap: Record<string, TopItem> = {};
  for (const item of saleItemsRaw.data ?? []) {
    const key = (item.description as string) ?? "Sin descripción";
    if (!itemMap[key]) {
      itemMap[key] = { description: key, item_type: (item.item_type as string) ?? "other", revenue: 0, units: 0 };
    }
    itemMap[key].revenue += ((item.quantity as number) ?? 1) * ((item.unit_price as number) ?? 0);
    itemMap[key].units += (item.quantity as number) ?? 1;
  }
  const topItems = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // ── Membership distribution ───────────────────────────────────────────────
  type DistribItem = { name: string; color: string; count: number };
  const distribMap: Record<string, DistribItem> = {};
  for (const m of activeMshpsRaw.data ?? []) {
    const plan = m.membership_plans as unknown as { name: string; color: string | null; duration_days: number; price: number } | null;
    if (!plan) continue;
    if (!distribMap[plan.name]) {
      distribMap[plan.name] = { name: plan.name, color: plan.color ?? "#888", count: 0 };
    }
    distribMap[plan.name].count++;
  }
  const membershipDistrib = Object.values(distribMap).sort((a, b) => b.count - a.count);

  // ── MRR: sum of (plan.price / duration_days * 30) for each active membership
  let mrr = 0;
  for (const m of activeMshpsRaw.data ?? []) {
    const plan = m.membership_plans as unknown as { duration_days: number; price: number } | null;
    if (!plan || !plan.duration_days) continue;
    mrr += (plan.price / plan.duration_days) * 30;
  }

  // ── Churn rate (last 30 days) ─────────────────────────────────────────────
  const activeSet = new Set(
    (currentActiveMshpsRaw.data ?? []).map((r: { member_id: string }) => r.member_id)
  );
  const uniqueChurned = new Set(
    (expiredMshpsRaw.data ?? [])
      .filter((r: { member_id: string }) => !activeSet.has(r.member_id))
      .map((r: { member_id: string }) => r.member_id)
  ).size;
  const totalBase = (activeMembers.count ?? 0) + uniqueChurned;
  const churnRate = totalBase > 0 ? (uniqueChurned / totalBase) * 100 : 0;

  // ── Ticket promedio ───────────────────────────────────────────────────────
  const ticketPromedio =
    (monthSales.data?.sale_count ?? 0) > 0
      ? (monthSales.data?.total_amount ?? 0) / (monthSales.data?.sale_count ?? 1)
      : 0;

  // ── Socios en riesgo (churn silencioso) ───────────────────────────────────
  // Miembros con membresía activa que llevan ≥10 días sin asistir.
  const AT_RISK_DAYS = 10;
  const lastVisitMap = new Map<string, string>();
  for (const r of (attendanceStatsRaw.data ?? []) as { member_id: string; last_visit: string | null }[]) {
    if (r.last_visit) lastVisitMap.set(r.member_id, r.last_visit);
  }
  const todayMs = new Date(today + "T00:00:00").getTime();
  const dayDiff = (from: string) =>
    Math.round((todayMs - new Date(from + "T00:00:00").getTime()) / 86_400_000);

  type AtRiskMember = {
    id: string;
    full_name: string;
    phone: string;
    plan_name: string | null;
    days_since_visit: number | null; // null = nunca asistió
    days_until_expiry: number | null;
  };

  const atRiskMembers: AtRiskMember[] = [];
  for (const m of (activeMembersDetailRaw.data ?? []) as {
    id: string;
    full_name: string;
    phone: string;
    current_plan_name: string | null;
    days_until_expiry: number | null;
    created_at: string;
  }[]) {
    const last = lastVisitMap.get(m.id);
    const daysSince = last ? dayDiff(last) : null;
    // Nunca asistió → solo en riesgo si lleva ≥AT_RISK_DAYS inscrito
    const memberAgeDays = dayDiff(m.created_at.slice(0, 10));
    const isAtRisk =
      (daysSince !== null && daysSince >= AT_RISK_DAYS) ||
      (daysSince === null && memberAgeDays >= AT_RISK_DAYS);
    if (isAtRisk) {
      atRiskMembers.push({
        id: m.id,
        full_name: m.full_name,
        phone: m.phone,
        plan_name: m.current_plan_name,
        days_since_visit: daysSince,
        days_until_expiry: m.days_until_expiry,
      });
    }
  }
  // Más urgente primero (los que llevan más sin venir, nunca-asistió al final)
  atRiskMembers.sort((a, b) => (b.days_since_visit ?? 9999) - (a.days_since_visit ?? 9999));

  // ── Fill all 12 months of the year ───────────────────────────────────────
  const yearlyMap = Object.fromEntries(
    (yearlySalesRaw.data ?? []).map((d) => [d.month as string, d.total_amount as number])
  );
  const yearlySales = Array.from({ length: 12 }, (_, i) => {
    const month = `${currentYear}-${String(i + 1).padStart(2, "0")}-01`;
    return { month, total: yearlyMap[month] ?? 0 };
  });

  return {
    activeMembersCount: activeMembers.count ?? 0,
    expiringSoon: expiringRows.data ?? [],
    todayTotal: todaySales.data?.total_amount ?? 0,
    todaySales: todaySales.data?.sale_count ?? 0,
    monthTotal: monthSales.data?.total_amount ?? 0,
    monthSales: monthSales.data?.sale_count ?? 0,
    todayCheckIns: todayAttendance.count ?? 0,
    newMembersThisMonth: newMembersMonth.count ?? 0,
    ticketPromedio,
    mrr: Math.round(mrr * 100) / 100,
    churnRate: Math.round(churnRate * 100) / 100,
    expiring7Days: (expiringRows.data ?? []).filter((r) => r.days_left <= 7).length,
    dailySales30: (dailySales30.data ?? []).map((d) => ({
      date: d.sale_date as string,
      total: d.total_amount as number,
    })),
    yearlySales,
    topItems,
    membershipDistrib,
    atRiskMembers,
    atRiskCount: atRiskMembers.length,
    pendingRenewals: pendingRenewalsRaw.count ?? 0,
    newMembers: (newMembersRaw.data ?? []).map((m) => ({
      id: m.id as string,
      full_name: m.full_name as string,
      phone: (m.phone ?? "") as string,
      created_at: m.created_at as string,
    })),
    newMembersCount: (newMembersRaw.data ?? []).length,
  };
}

export type ExpiringRow = {
  membership_id: string;
  full_name: string;
  phone: string;
  plan_name: string;
  end_date: string;
  days_left: number;
};
