import { createClient } from "@/lib/supabase/server";
import VentasClient from "./VentasClient";

export default async function VentasPage() {
  const supabase = await createClient();

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const [{ data: salesRaw }, { data: dailyRows }, { data: members }, { data: products }] =
    await Promise.all([
      // All sales (client handles pagination + filtering)
      supabase
        .from("sales")
        .select("id, sale_date, total, discount, payment_method, bank_reference, notes, members(full_name)")
        .order("sale_date", { ascending: false })
        .order("created_at", { ascending: false }),

      // Daily view for current month (used for Resumen del Día + Resumen Mensual)
      supabase
        .from("vw_daily_sales")
        .select(
          "sale_date, sale_count, total_amount, total_discount, transfer_amount, transfer_discount, cash_amount, card_amount, cxc_amount, cxc_discount"
        )
        .gte("sale_date", firstOfMonth)
        .lte("sale_date", todayStr),

      supabase
        .from("members")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name"),

      supabase
        .from("products")
        .select("id, name, price, stock")
        .eq("active", true)
        .gt("stock", 0)
        .order("name"),
    ]);

  // Flatten sales
  const sales = (salesRaw ?? []).map((s: any) => ({
    id: s.id,
    sale_date: s.sale_date as string,
    total: s.total as number,
    discount: (s.discount ?? 0) as number,
    payment_method: s.payment_method as string,
    bank_reference: (s.bank_reference ?? null) as string | null,
    notes: (s.notes ?? null) as string | null,
    member_name: (s.members?.full_name ?? null) as string | null,
  }));

  // Today row
  const todayRow = (dailyRows ?? []).find((r) => r.sale_date === todayStr);

  // Monthly aggregates
  const rows = dailyRows ?? [];
  const monthly = {
    transfer_total: rows.reduce((s, r) => s + (Number(r.transfer_amount) || 0), 0),
    transfer_discount: rows.reduce((s, r) => s + (Number(r.transfer_discount) || 0), 0),
    cxc_total: rows.reduce((s, r) => s + (Number(r.cxc_amount) || 0), 0),
    cxc_discount: rows.reduce((s, r) => s + (Number(r.cxc_discount) || 0), 0),
    cash_total: rows.reduce((s, r) => s + (Number(r.cash_amount) || 0), 0),
    card_total: rows.reduce((s, r) => s + (Number(r.card_amount) || 0), 0),
  };

  const today = {
    transfer_total: Number(todayRow?.transfer_amount ?? 0),
    transfer_discount: Number(todayRow?.transfer_discount ?? 0),
    cxc_total: Number(todayRow?.cxc_amount ?? 0),
    cxc_discount: Number(todayRow?.cxc_discount ?? 0),
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Ventas</h2>
        <p className="text-fg/40 text-sm mt-0.5">
          {sales.length} registros totales
        </p>
      </div>

      <VentasClient
        sales={sales}
        today={today}
        monthly={monthly}
        members={members ?? []}
        products={products ?? []}
      />
    </div>
  );
}
