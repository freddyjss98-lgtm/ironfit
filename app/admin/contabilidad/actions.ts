"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isExpenseCategory } from "./categories";

// Normaliza "2026-06" o "2026-06-15" → "2026-06-01"
function monthKey(input: string): string {
  return input.slice(0, 7) + "-01";
}

/** Recalcula la foto del mes desde las ventas reales + socios nuevos. */
async function computeSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  month: string
) {
  const start = month; // 2026-06-01
  const startDate = new Date(start + "T00:00:00Z");
  const nextMonth = new Date(startDate);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const end = nextMonth.toISOString().slice(0, 10); // exclusivo

  const [{ data: daily }, { count: newMembers }] = await Promise.all([
    supabase
      .from("vw_daily_sales")
      .select(
        "total_amount, total_discount, transfer_amount, cash_amount, card_amount, cxc_amount, sale_count"
      )
      .gte("sale_date", start)
      .lt("sale_date", end),
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lt("created_at", end),
  ]);

  const rows = daily ?? [];
  const sum = (k: string) =>
    rows.reduce((s, r) => s + (Number((r as Record<string, unknown>)[k]) || 0), 0);

  // unique_members del mes (socios distintos con ventas)
  const { data: saleMembers } = await supabase
    .from("sales")
    .select("member_id")
    .gte("sale_date", start)
    .lt("sale_date", end)
    .not("member_id", "is", null);
  const uniqueMembers = new Set((saleMembers ?? []).map((s) => s.member_id)).size;

  // Gastos del mes (para congelar la utilidad al cerrar)
  const { data: expenseRows } = await supabase
    .from("expenses")
    .select("amount")
    .gte("expense_date", start)
    .lt("expense_date", end);
  const totalExpenses = (expenseRows ?? []).reduce(
    (s, e) => s + (Number(e.amount) || 0),
    0
  );

  return {
    month,
    total_amount: sum("total_amount"),
    total_discount: sum("total_discount"),
    transfer_amount: sum("transfer_amount"),
    cash_amount: sum("cash_amount"),
    card_amount: sum("card_amount"),
    cxc_amount: sum("cxc_amount"),
    sale_count: rows.reduce((s, r) => s + (Number(r.sale_count) || 0), 0),
    unique_members: uniqueMembers,
    new_members: newMembers ?? 0,
    total_expenses: totalExpenses,
  };
}

/** Cierra (congela) un mes para contabilidad. */
export async function closeMonth(month: string, notes?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const key = monthKey(month);
  const snapshot = await computeSnapshot(supabase, key);

  const { error } = await supabase.from("monthly_close").upsert(
    {
      ...snapshot,
      is_closed: true,
      notes: notes?.trim() || null,
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    },
    { onConflict: "month" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/admin/contabilidad");
}

/** Reabre un mes cerrado (vuelve a calcularse en vivo). */
export async function reopenMonth(month: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const key = monthKey(month);
  const { error } = await supabase
    .from("monthly_close")
    .update({ is_closed: false })
    .eq("month", key);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/contabilidad");
}

// ── Gastos ───────────────────────────────────────────────────────────────────

function parseExpense(formData: FormData) {
  const expense_date = String(formData.get("expense_date") ?? "").slice(0, 10);
  const category = String(formData.get("category") ?? "");
  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();

  if (!expense_date) throw new Error("Falta la fecha del gasto");
  if (!isExpenseCategory(category)) throw new Error("Categoría inválida");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("El monto debe ser mayor a 0");

  return {
    expense_date,
    category,
    amount: Math.round(amount * 100) / 100,
    description: description || null,
  };
}

/** Verifica que el mes del gasto no esté cerrado (contabilidad congelada). */
async function assertMonthOpen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  date: string
) {
  const key = monthKey(date);
  const { data } = await supabase
    .from("monthly_close")
    .select("is_closed")
    .eq("month", key)
    .maybeSingle();
  if (data?.is_closed) {
    throw new Error("Ese mes ya está cerrado. Reábrelo para modificar sus gastos.");
  }
}

export async function createExpense(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const values = parseExpense(formData);
  await assertMonthOpen(supabase, values.expense_date);

  const { error } = await supabase
    .from("expenses")
    .insert({ ...values, created_by: user.id });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/contabilidad");
}

export async function updateExpense(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const values = parseExpense(formData);
  await assertMonthOpen(supabase, values.expense_date);

  const { error } = await supabase.from("expenses").update(values).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/contabilidad");
}

export async function deleteExpense(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // Bloquear borrado si el gasto cae en un mes cerrado
  const { data: existing } = await supabase
    .from("expenses")
    .select("expense_date")
    .eq("id", id)
    .maybeSingle();
  if (existing?.expense_date) {
    await assertMonthOpen(supabase, existing.expense_date as string);
  }

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/contabilidad");
}

// ── Detalle de ingresos del mes ──────────────────────────────────────────────

function monthBounds(month: string): [string, string] {
  const start = monthKey(month);
  const d = new Date(start + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  return [start, d.toISOString().slice(0, 10)];
}

export type MonthSale = {
  id: string;
  sale_date: string;
  total: number;
  discount: number;
  payment_method: string;
  member_name: string | null;
  notes: string | null;
};

/** Ventas individuales de un mes (para el detalle de ingresos). */
export async function getMonthSales(month: string): Promise<MonthSale[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const [start, end] = monthBounds(month);
  const { data, error } = await supabase
    .from("sales")
    .select("id, sale_date, total, discount, payment_method, notes, members(full_name)")
    .gte("sale_date", start)
    .lt("sale_date", end)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((s) => ({
    id: s.id as string,
    sale_date: s.sale_date as string,
    total: Number(s.total) || 0,
    discount: Number(s.discount) || 0,
    payment_method: s.payment_method as string,
    member_name:
      (Array.isArray(s.members) ? s.members[0]?.full_name : (s.members as { full_name?: string } | null)?.full_name) ??
      null,
    notes: (s.notes ?? null) as string | null,
  }));
}

// ── Gastos fijos (recurrentes) ────────────────────────────────────────────────

function parseRecurring(formData: FormData) {
  const category = String(formData.get("category") ?? "");
  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();

  if (!isExpenseCategory(category)) throw new Error("Categoría inválida");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("El monto debe ser mayor a 0");

  return { category, amount: Math.round(amount * 100) / 100, description: description || null };
}

export async function createRecurring(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("recurring_expenses")
    .insert({ ...parseRecurring(formData), created_by: user.id });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/contabilidad");
}

export async function updateRecurring(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("recurring_expenses")
    .update(parseRecurring(formData))
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/contabilidad");
}

export async function deleteRecurring(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/contabilidad");
}

/**
 * Aplica los gastos fijos activos a un mes: inserta en `expenses` los que aún
 * no existan (mismo mes + categoría + monto). Idempotente. Devuelve cuántos creó.
 */
export async function applyRecurring(month: string): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  await assertMonthOpen(supabase, month);
  const [start, end] = monthBounds(month);

  const [{ data: templates }, { data: existing }] = await Promise.all([
    supabase.from("recurring_expenses").select("category, amount, description").eq("active", true),
    supabase.from("expenses").select("category, amount").gte("expense_date", start).lt("expense_date", end),
  ]);

  const already = new Set(
    (existing ?? []).map((e) => `${e.category}|${Number(e.amount).toFixed(2)}`)
  );

  const toInsert = (templates ?? [])
    .filter((t) => !already.has(`${t.category}|${Number(t.amount).toFixed(2)}`))
    .map((t) => ({
      expense_date: start,
      category: t.category,
      amount: t.amount,
      description: t.description,
      created_by: user.id,
    }));

  if (toInsert.length === 0) return 0;

  const { error } = await supabase.from("expenses").insert(toInsert);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/contabilidad");
  return toInsert.length;
}
