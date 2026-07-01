import { createClient } from "@/lib/supabase/server";
import { todayInEcuador } from "@/lib/date";
import ContabilidadClient, { type MonthRow, type Expense, type Recurring } from "./ContabilidadClient";

export const metadata = {
  title: "Contabilidad · Iron Fit Club",
};

type LiveAgg = Omit<
  MonthRow,
  "month" | "monthIdx" | "isClosed" | "isCurrent" | "notes" | "deltaPct" | "net_profit"
>;

export default async function ContabilidadPage() {
  const supabase = await createClient();

  const today = todayInEcuador(); // "2026-06-30"
  const year = today.slice(0, 4);
  const yearStart = `${year}-01-01`;
  const currentMonthIdx = parseInt(today.slice(5, 7), 10); // 1..12

  const [
    { data: dailyRows },
    { data: newMemberRows },
    { data: closes },
    { data: expenseRows },
    { data: recurringRows },
  ] =
    await Promise.all([
      supabase
        .from("vw_daily_sales")
        .select(
          "sale_date, total_amount, total_discount, transfer_amount, cash_amount, card_amount, cxc_amount, sale_count"
        )
        .gte("sale_date", yearStart)
        .lte("sale_date", today),
      supabase
        .from("members")
        .select("id, created_at")
        .gte("created_at", yearStart),
      supabase
        .from("monthly_close")
        .select("*")
        .gte("month", yearStart),
      supabase
        .from("expenses")
        .select("id, expense_date, category, amount, description")
        .gte("expense_date", yearStart)
        .order("expense_date", { ascending: false }),
      supabase
        .from("recurring_expenses")
        .select("id, category, amount, description, active")
        .order("category"),
    ]);

  // Agregar ventas por mes (índice 1..12)
  const live: Record<number, LiveAgg> = {};
  for (let m = 1; m <= currentMonthIdx; m++) {
    live[m] = {
      total_amount: 0, total_discount: 0, transfer_amount: 0,
      cash_amount: 0, card_amount: 0, cxc_amount: 0,
      sale_count: 0, unique_members: 0, new_members: 0, total_expenses: 0,
    };
  }

  for (const r of dailyRows ?? []) {
    const m = parseInt((r.sale_date as string).slice(5, 7), 10);
    if (!live[m]) continue;
    live[m].total_amount += Number(r.total_amount) || 0;
    live[m].total_discount += Number(r.total_discount) || 0;
    live[m].transfer_amount += Number(r.transfer_amount) || 0;
    live[m].cash_amount += Number(r.cash_amount) || 0;
    live[m].card_amount += Number(r.card_amount) || 0;
    live[m].cxc_amount += Number(r.cxc_amount) || 0;
    live[m].sale_count += Number(r.sale_count) || 0;
  }

  // Socios nuevos por mes
  for (const mem of newMemberRows ?? []) {
    const m = parseInt((mem.created_at as string).slice(5, 7), 10);
    if (live[m]) live[m].new_members += 1;
  }

  // Gastos por mes (en vivo) + lista para gestionar
  const expenses: Expense[] = (expenseRows ?? []).map((e) => ({
    id: e.id as string,
    expense_date: e.expense_date as string,
    category: e.category as string,
    amount: Number(e.amount) || 0,
    description: (e.description ?? null) as string | null,
  }));
  for (const e of expenses) {
    const m = parseInt(e.expense_date.slice(5, 7), 10);
    if (live[m]) live[m].total_expenses += e.amount;
  }

  const closeByMonth = new Map<string, MonthRow & { is_closed: boolean }>(
    (closes ?? []).map((c) => [c.month as string, c])
  );

  const rows: MonthRow[] = [];
  let prevTotal: number | null = null;

  for (let m = 1; m <= currentMonthIdx; m++) {
    const monthKey = `${year}-${String(m).padStart(2, "0")}-01`;
    const closeRow = closeByMonth.get(monthKey);
    const isClosed = !!closeRow?.is_closed;

    const base: LiveAgg = isClosed
      ? {
          total_amount: Number(closeRow.total_amount),
          total_discount: Number(closeRow.total_discount),
          transfer_amount: Number(closeRow.transfer_amount),
          cash_amount: Number(closeRow.cash_amount),
          card_amount: Number(closeRow.card_amount),
          cxc_amount: Number(closeRow.cxc_amount),
          sale_count: Number(closeRow.sale_count),
          unique_members: Number(closeRow.unique_members),
          new_members: Number(closeRow.new_members),
          total_expenses: Number(closeRow.total_expenses),
        }
      : live[m];

    const deltaPct =
      prevTotal !== null && prevTotal > 0
        ? ((base.total_amount - prevTotal) / prevTotal) * 100
        : null;

    rows.push({
      monthIdx: m,
      month: monthKey,
      isClosed,
      isCurrent: m === currentMonthIdx,
      notes: closeRow?.notes ?? null,
      deltaPct,
      net_profit: base.total_amount - base.total_expenses,
      ...base,
    });

    prevTotal = base.total_amount;
  }

  rows.reverse(); // mes más reciente primero

  const recurring: Recurring[] = (recurringRows ?? []).map((r) => ({
    id: r.id as string,
    category: r.category as string,
    amount: Number(r.amount) || 0,
    description: (r.description ?? null) as string | null,
    active: !!r.active,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Contabilidad</h2>
        <p className="text-fg/40 text-sm mt-0.5">
          Estado de resultados mes a mes de {year} — ingresos, gastos y utilidad
        </p>
      </div>

      <ContabilidadClient
        rows={rows}
        expenses={expenses}
        recurring={recurring}
        year={year}
        today={today}
      />
    </div>
  );
}
