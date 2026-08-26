"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createSale, createCounterSale } from "./actions";
import { todayInEcuador } from "@/lib/date";
import { fmtMoney } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";

// ── Types ──────────────────────────────────────────────────────────────────────

type Sale = {
  id: string;
  sale_date: string;
  total: number;
  discount: number;
  payment_method: string;
  bank_reference: string | null;
  notes: string | null;
  member_name: string | null;
  /** Anulada: sigue en la lista (auditoría) pero no cuenta en ningún total. */
  voided: boolean;
  void_reason: string | null;
};

type TodaySummary = {
  transfer_total: number;
  transfer_discount: number;
  cxc_total: number;
  cxc_discount: number;
};

type MonthlySummary = {
  transfer_total: number;
  transfer_discount: number;
  cxc_total: number;
  cxc_discount: number;
  cash_total: number;
  card_total: number;
};

type Member = { id: string; full_name: string };
type Product = { id: string; name: string; price: number; stock: number };
type Plan = { id: string; name: string; price: number; duration_days: number };

type LineItem = {
  key: string;
  kind: "product" | "plan";
  refId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  durationDays?: number;
};

type Props = {
  sales: Sale[];
  today: TodaySummary;
  monthly: MonthlySummary;
  members: Member[];
  products: Product[];
  plans: Plan[];
};

// ── Constants ──────────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
  cxc: "Cuentas x Cobrar",
  other: "Otro",
};

const METHOD_COLORS: Record<string, string> = {
  transfer: "bg-blue-600 text-white",
  cash: "bg-emerald-600 text-white",
  card: "bg-purple-600 text-white",
  cxc: "bg-red-600 text-white",
  other: "bg-white/15 text-fg/70",
};

const MONTH_NAMES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = fmtMoney;

/** "2026-05-22" → "22 may 2026" */
function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${MONTH_NAMES[parseInt(m) - 1].slice(0, 3)} ${y}`;
}

function exportSales(rows: Sale[], filename: string) {
  downloadCSV(
    filename,
    ["Fecha", "Cliente", "Monto", "Descuento", "Forma de Pago", "Referencia", "Notas"],
    rows.map((s) => [
      s.sale_date,
      s.member_name ?? "",
      s.total.toFixed(2),
      s.discount.toFixed(2),
      METHOD_LABELS[s.payment_method] ?? s.payment_method,
      s.bank_reference ?? "",
      s.notes ?? "",
    ])
  );
}

// ── Summary panel ──────────────────────────────────────────────────────────────

function SummaryPanel({
  label,
  total,
  discount,
  color,
}: {
  label: string;
  total: number;
  discount: number;
  color: "blue" | "red";
}) {
  const headerCls =
    color === "blue"
      ? "bg-blue-600 text-white"
      : "bg-red-600 text-white";

  return (
    <div className="border border-line rounded-xl overflow-hidden flex-1 min-w-[220px]">
      <div className={`${headerCls} px-4 py-2 text-center text-sm font-semibold`}>
        {label}
      </div>
      <div className="bg-white/5 divide-y divide-line">
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-fg/60">Total:</span>
          <span className="font-semibold">{fmt(total)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-fg/60">Descuento:</span>
          <span className="font-semibold">{fmt(discount)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Quick sale form (Generar Venta) ────────────────────────────────────────────

function GenerarVentaForm({
  members,
  products,
  plans,
  onClose,
}: {
  members: Member[];
  products: Product[];
  plans: Plan[];
  onClose: () => void;
}) {
  const [memberId, setMemberId] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [manualTotal, setManualTotal] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const itemsTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const total = items.length > 0 ? itemsTotal : parseFloat(manualTotal) || 0;
  const hasPlan = items.some((i) => i.kind === "plan");

  function addProduct() {
    if (!products.length) return;
    const p = products[0];
    setItems((prev) => [
      ...prev,
      { key: crypto.randomUUID(), kind: "product", refId: p.id, name: p.name, unitPrice: p.price, quantity: 1 },
    ]);
  }

  function addPlan() {
    if (!plans.length) return;
    const p = plans[0];
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        kind: "plan",
        refId: p.id,
        name: p.name,
        unitPrice: p.price,
        quantity: 1,
        durationDays: p.duration_days,
      },
    ]);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function changeProduct(key: string, productId: string) {
    const p = products.find((p) => p.id === productId);
    if (!p) return;
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, refId: p.id, name: p.name, unitPrice: p.price } : i))
    );
  }

  function changePlan(key: string, planId: string) {
    const p = plans.find((p) => p.id === planId);
    if (!p) return;
    setItems((prev) =>
      prev.map((i) =>
        i.key === key
          ? { ...i, refId: p.id, name: p.name, unitPrice: p.price, durationDays: p.duration_days }
          : i
      )
    );
  }

  function changeQty(key: string, qty: number) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, qty) } : i)));
  }

  function handleSubmit() {
    if (total <= 0) { setError("Ingresa un monto o agrega productos/membresías"); return; }
    if (hasPlan && !memberId) { setError("Selecciona un cliente para vender una membresía"); return; }
    setError(null);

    startTransition(async () => {
      try {
        if (items.length > 0) {
          const res = await createCounterSale({
            memberId: memberId || null,
            paymentMethod,
            bankReference: bankReference || null,
            notes: notes || null,
            items: items.map((i) => ({
              type: i.kind,
              refId: i.refId,
              name: i.name,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              durationDays: i.durationDays,
            })),
          });
          if (res?.membershipStartsAt) {
            const d = new Date(res.membershipStartsAt + "T00:00:00").toLocaleDateString("es-EC", {
              day: "numeric",
              month: "long",
            });
            toast.success(`Venta registrada — ${fmt(total)}`);
            toast.info(`La membresía inicia el ${d} (al vencer la actual, no pierde días)`);
            onClose();
            return;
          }
        } else {
          const fd = new FormData();
          fd.set("description", notes || "Venta manual");
          fd.set("total", String(total));
          fd.set("sale_date", todayInEcuador());
          fd.set("payment_method", paymentMethod);
          if (bankReference) fd.set("bank_reference", bankReference);
          if (memberId) fd.set("member_id", memberId);
          if (notes) fd.set("notes", notes);
          await createSale(fd);
        }
        toast.success(`Venta registrada — ${fmt(total)}`);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al registrar");
      }
    });
  }

  const inputCls =
    "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Cliente */}
      <div className="flex flex-col gap-1.5">
        <label className="text-fg/50 text-xs uppercase tracking-wider">Cliente *</label>
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className={inputCls}>
          <option value="">Sin cliente asociado</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>
      </div>

      {/* Productos y membresías */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-fg/50 text-xs uppercase tracking-wider">Productos y membresías</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addProduct}
              disabled={!products.length}
              className="text-xs text-accent border border-accent/30 hover:border-accent px-2.5 py-1 rounded transition-colors disabled:opacity-30"
            >
              + Producto
            </button>
            <button
              type="button"
              onClick={addPlan}
              disabled={!plans.length}
              className="text-xs text-accent border border-accent/30 hover:border-accent px-2.5 py-1 rounded transition-colors disabled:opacity-30"
            >
              + Membresía
            </button>
          </div>
        </div>
        {items.length === 0 && (
          <p className="text-fg/30 text-xs text-center py-3 border border-dashed border-line rounded-lg">
            Sin ítems — o ingresa monto manual abajo
          </p>
        )}
        {items.map((item) => (
          <div key={item.key} className="flex gap-2 items-center">
            {item.kind === "product" ? (
              <>
                <select
                  value={item.refId}
                  onChange={(e) => changeProduct(item.key, e.target.value)}
                  className={`${inputCls} flex-1`}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — ${p.price}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => changeQty(item.key, parseInt(e.target.value) || 1)}
                  className="w-14 bg-white/5 border border-white/15 text-fg rounded-lg px-2 py-2 text-sm text-center outline-none focus:border-accent"
                />
              </>
            ) : (
              <>
                <select
                  value={item.refId}
                  onChange={(e) => changePlan(item.key, e.target.value)}
                  className={`${inputCls} flex-1`}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ${p.price} ({p.duration_days}d)
                    </option>
                  ))}
                </select>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider bg-accent/15 text-accent px-2 py-1.5 rounded">
                  Membresía
                </span>
              </>
            )}
            <span className="text-sm text-fg/60 w-16 text-right tabular-nums shrink-0">
              {fmt(item.quantity * item.unitPrice)}
            </span>
            <button onClick={() => removeItem(item.key)} className="text-fg/30 hover:text-red-400 text-xl">×</button>
          </div>
        ))}
        {hasPlan && !memberId && (
          <p className="text-amber-400 text-xs">
            ⚠ Selecciona un cliente arriba para vender una membresía.
          </p>
        )}
      </div>

      {/* Monto manual (si no hay items) */}
      {items.length === 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-fg/50 text-xs uppercase tracking-wider">Monto (USD) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={manualTotal}
            onChange={(e) => setManualTotal(e.target.value)}
            className={inputCls}
            placeholder="0.00"
          />
        </div>
      )}

      {/* Forma de pago + Referencia */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-fg/50 text-xs uppercase tracking-wider">Forma de Pago</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
            <option value="transfer">Transferencia</option>
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="cxc">Cuentas x Cobrar</option>
            <option value="other">Otro</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-fg/50 text-xs uppercase tracking-wider">Referencia</label>
          <input
            value={bankReference}
            onChange={(e) => setBankReference(e.target.value)}
            className={inputCls}
            placeholder="Nº comprobante"
          />
        </div>
      </div>

      {/* Notas */}
      <div className="flex flex-col gap-1.5">
        <label className="text-fg/50 text-xs uppercase tracking-wider">Notas</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Opcional" />
      </div>

      {/* Total preview */}
      {total > 0 && (
        <div className="flex justify-between items-center bg-accent/10 border border-accent/20 rounded-lg px-4 py-2">
          <span className="text-sm text-fg/60">Total a registrar</span>
          <span className="font-display text-lg font-bold text-accent">{fmt(total)}</span>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 text-sm border border-line text-fg/60 hover:text-fg rounded-lg transition-colors"
        >
          CANCELAR
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || total <= 0}
          className="px-5 py-2 text-sm font-bold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? "Registrando..." : "COMPLETAR VENTA"}
        </button>
      </div>
    </div>
  );
}

// ── Sale detail modal ──────────────────────────────────────────────────────────

function DetallesModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="divide-y divide-line">
        {[
          ["Fecha", fmtDate(sale.sale_date)],
          ["Cliente", sale.member_name ?? "—"],
          ["Monto", fmt(sale.total)],
          ["Descuento", fmt(sale.discount)],
          ["Forma de Pago", METHOD_LABELS[sale.payment_method] ?? sale.payment_method],
          ["Referencia", sale.bank_reference ?? "—"],
          ["Notas", sale.notes ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex items-start justify-between py-3 text-sm">
            <span className="text-fg/50">{label}</span>
            <span className="font-medium text-right max-w-[60%]">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-5 py-2 text-sm border border-line text-fg/60 hover:text-fg rounded-lg transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function VentasClient({ sales, today, monthly, members, products, plans }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);

  // Filters
  const [clientFilter, setClientFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  const currentMonthIdx = parseInt(todayInEcuador().slice(5, 7), 10) - 1;
  const currentMonthName =
    MONTH_NAMES[currentMonthIdx].charAt(0).toUpperCase() +
    MONTH_NAMES[currentMonthIdx].slice(1);

  // Apply filters
  const filtered = sales.filter((s) => {
    if (clientFilter && !(s.member_name ?? "").toLowerCase().includes(clientFilter.toLowerCase()))
      return false;
    if (methodFilter !== "all" && s.payment_method !== methodFilter) return false;
    if (fromDate && s.sale_date < fromDate) return false;
    if (toDate && s.sale_date > toDate) return false;
    return true;
  });

  const total = filtered.length;
  const pageCount = Math.ceil(total / rowsPerPage) || 1;
  const currentPage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);

  function clearFilters() {
    setClientFilter("");
    setMethodFilter("all");
    setFromDate("");
    setToDate("");
    setPage(0);
  }

  const hasFilters = clientFilter || methodFilter !== "all" || fromDate || toDate;

  return (
    <>
      {/* ── Generar Venta button ────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 bg-accent hover:bg-accent/80 text-white text-sm font-bold rounded-lg transition-colors"
        >
          Generar Venta
        </button>
      </div>

      {/* ── Resumen del Día ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="font-display text-base uppercase tracking-tight text-fg/70">
          Resumen del Día
        </h3>
        <div className="flex flex-wrap gap-4">
          <SummaryPanel
            label="Transferencias"
            total={today.transfer_total}
            discount={today.transfer_discount}
            color="blue"
          />
          {today.cxc_total > 0 && (
            <SummaryPanel
              label="Cuentas x Cobrar"
              total={today.cxc_total}
              discount={today.cxc_discount}
              color="red"
            />
          )}
        </div>
      </div>

      {/* ── Resumen Mensual ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="font-display text-base uppercase tracking-tight text-fg/70">
          Resumen Mensual — {currentMonthName}
        </h3>
        <div className="flex flex-wrap gap-4">
          <SummaryPanel
            label="Transferencias"
            total={monthly.transfer_total}
            discount={monthly.transfer_discount}
            color="blue"
          />
          <SummaryPanel
            label="Cuentas x Cobrar"
            total={monthly.cxc_total}
            discount={monthly.cxc_discount}
            color="red"
          />
        </div>
        {monthly.card_total > 0 && (
          <button className="text-sm text-accent hover:underline mt-1">
            Ver Pagos con Tarjeta de Crédito ({fmt(monthly.card_total)})
          </button>
        )}
      </div>

      {/* ── Lista de Ventas ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="font-display text-base uppercase tracking-tight text-fg/70">
          Lista de Ventas
        </h3>

        {/* Filtros de Búsqueda */}
        <div className="bg-white/5 border border-line rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-fg/50 uppercase tracking-wider">Filtros de Búsqueda</p>
          <div className="flex flex-wrap gap-3 items-end">
            {/* Cliente */}
            <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <label className="text-xs text-fg/40">Cliente</label>
              <input
                value={clientFilter}
                onChange={(e) => { setClientFilter(e.target.value); setPage(0); }}
                placeholder="Nombre del cliente..."
                className="bg-white/5 border border-line text-fg text-sm rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-fg/30 w-full"
              />
            </div>

            {/* Forma de Pago */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-fg/40">Forma de Pago</label>
              <select
                value={methodFilter}
                onChange={(e) => { setMethodFilter(e.target.value); setPage(0); }}
                className="bg-white/5 border border-line text-fg text-sm rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors"
              >
                <option value="all">Todas</option>
                <option value="transfer">Transferencia</option>
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="cxc">Cuentas x Cobrar</option>
                <option value="other">Otro</option>
              </select>
            </div>

            {/* Desde */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-fg/40">Desde</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
                className="bg-white/5 border border-line text-fg text-sm rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Hasta */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-fg/40">Hasta</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(0); }}
                className="bg-white/5 border border-line text-fg text-sm rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Buttons */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 border border-line text-fg/60 hover:text-fg text-sm rounded-lg transition-colors flex items-center gap-1.5 self-end"
              >
                ✕ Limpiar
              </button>
            )}
            <button
              onClick={() => exportSales(filtered, "ventas.csv")}
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5 self-end"
            >
              ↓ Excel
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/5 border border-line rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-fg/40 text-sm text-center py-12">Sin ventas para los filtros seleccionados</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-fg/40 text-xs uppercase tracking-wider bg-white/[0.02]">
                      <th className="text-left px-4 py-3">Fecha</th>
                      <th className="text-left px-4 py-3">Cliente</th>
                      <th className="text-right px-4 py-3">Monto</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Forma de Pago</th>
                      <th className="text-right px-4 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-line/50 last:border-0 hover:bg-white/[0.03] transition-colors"
                      >
                        {/* Fecha */}
                        <td className="px-4 py-3 text-fg/60 text-sm whitespace-nowrap">
                          {fmtDate(s.sale_date)}
                        </td>

                        {/* Cliente */}
                        <td className="px-4 py-3">
                          <span className={`font-medium ${s.voided ? "text-fg/35 line-through" : "text-accent"}`}>
                            {s.member_name ?? "—"}
                          </span>
                          {s.voided && (
                            <span
                              title={s.void_reason ?? "Venta anulada"}
                              className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400"
                            >
                              Anulada
                            </span>
                          )}
                        </td>

                        {/* Monto */}
                        <td
                          className={`px-4 py-3 text-right font-semibold tabular-nums ${
                            s.voided ? "text-fg/35 line-through" : ""
                          }`}
                        >
                          {fmt(s.total)}
                        </td>

                        {/* Forma de Pago */}
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold ${
                              METHOD_COLORS[s.payment_method] ?? "bg-white/10 text-fg/50"
                            }`}
                          >
                            {METHOD_LABELS[s.payment_method] ?? s.payment_method}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setDetailSale(s)}
                            className="text-xs text-fg/50 hover:text-fg border border-line hover:border-fg/30 px-3 py-1 rounded transition-colors"
                          >
                            Detalles
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-line text-xs text-fg/50">
                <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                    className="bg-white/10 border border-line rounded px-2 py-0.5 text-fg text-xs outline-none focus:border-accent"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    {total === 0
                      ? "0"
                      : `${currentPage * rowsPerPage + 1}–${Math.min(
                          (currentPage + 1) * rowsPerPage,
                          total
                        )}`}{" "}
                    of {total}
                  </span>
                  <button
                    disabled={currentPage === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="w-6 h-6 flex items-center justify-center rounded border border-line disabled:opacity-30 hover:border-fg/40 hover:text-fg transition-colors"
                  >
                    ‹
                  </button>
                  <button
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="w-6 h-6 flex items-center justify-center rounded border border-line disabled:opacity-30 hover:border-fg/40 hover:text-fg transition-colors"
                  >
                    ›
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Generar Venta modal ─────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-line rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg uppercase tracking-tight">Generar Venta</h2>
              <button onClick={() => setShowForm(false)} className="text-fg/40 hover:text-fg text-xl leading-none">✕</button>
            </div>
            <GenerarVentaForm
              members={members}
              products={products}
              plans={plans}
              onClose={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {/* ── Detalles modal ──────────────────────────────────────────────── */}
      {detailSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-line rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg uppercase tracking-tight">Detalles de Venta</h2>
              <button onClick={() => setDetailSale(null)} className="text-fg/40 hover:text-fg text-xl leading-none">✕</button>
            </div>
            <DetallesModal sale={detailSale} onClose={() => setDetailSale(null)} />
          </div>
        </div>
      )}
    </>
  );
}
