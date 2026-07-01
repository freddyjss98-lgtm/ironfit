"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  closeMonth, reopenMonth,
  createExpense, updateExpense, deleteExpense,
  getMonthSales, type MonthSale,
  createRecurring, deleteRecurring, applyRecurring,
} from "./actions";
import { EXPENSE_CATEGORIES, CATEGORY_LABELS } from "./categories";

// ── Types ──────────────────────────────────────────────────────────────────────

export type MonthRow = {
  monthIdx: number;
  month: string;
  isClosed: boolean;
  isCurrent: boolean;
  notes: string | null;
  deltaPct: number | null;
  total_amount: number;
  total_discount: number;
  transfer_amount: number;
  cash_amount: number;
  card_amount: number;
  cxc_amount: number;
  sale_count: number;
  unique_members: number;
  new_members: number;
  total_expenses: number;
  net_profit: number;
};

export type Expense = {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  description: string | null;
};

export type Recurring = {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  active: boolean;
};

type Props = {
  rows: MonthRow[];
  expenses: Expense[];
  recurring: Recurring[];
  year: string;
  today: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTH_ABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const METHOD_LABELS: Record<string, string> = {
  transfer: "Transferencia", cash: "Efectivo", card: "Tarjeta", cxc: "Cuentas x Cobrar", other: "Otro",
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}
function catLabel(c: string) {
  return CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c;
}
function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${MONTH_ABBR[parseInt(m) - 1].toLowerCase()} ${y}`;
}
function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const inputCls =
  "bg-white/5 border border-line rounded-lg px-3 py-2 text-sm text-fg outline-none focus:border-accent transition-colors";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wider text-fg/40">{label}</span>
      <span className="text-sm font-semibold text-fg/90">{value}</span>
    </div>
  );
}
function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-fg/30">—</span>;
  const up = pct >= 0;
  const cls = up ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ── Gráfico anual (ingresos / gastos) ────────────────────────────────────────────

function AnnualChart({ rows }: { rows: MonthRow[] }) {
  const chrono = useMemo(() => [...rows].sort((a, b) => a.monthIdx - b.monthIdx), [rows]);
  const max = Math.max(1, ...chrono.map((r) => Math.max(r.total_amount, r.total_expenses)));

  return (
    <div className="bg-white/5 border border-line rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base uppercase tracking-tight text-fg/70">Ingresos vs. Gastos</h3>
        <div className="flex items-center gap-3 text-[11px] text-fg/50">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Ingresos</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Gastos</span>
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-36">
        {chrono.map((r) => (
          <div key={r.month} className="flex-1 flex flex-col items-center justify-end gap-1 group">
            <div
              className="w-full flex items-end justify-center gap-0.5 h-full"
              title={`${MONTH_NAMES[r.monthIdx - 1]} · Ingresos ${fmt(r.total_amount)} · Gastos ${fmt(r.total_expenses)} · Utilidad ${fmt(r.net_profit)}`}
            >
              <div
                className="w-1/2 max-w-[14px] bg-green-500/80 rounded-t group-hover:bg-green-400 transition-colors"
                style={{ height: `${(r.total_amount / max) * 100}%` }}
              />
              <div
                className="w-1/2 max-w-[14px] bg-red-500/80 rounded-t group-hover:bg-red-400 transition-colors"
                style={{ height: `${(r.total_expenses / max) * 100}%` }}
              />
            </div>
            <span className={`text-[10px] ${r.isCurrent ? "text-accent font-bold" : "text-fg/40"}`}>
              {MONTH_ABBR[r.monthIdx - 1]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Formulario de gasto ───────────────────────────────────────────────────────────

function ExpenseForm({ initial, defaultDate, onClose }: { initial: Expense | null; defaultDate: string; onClose: () => void }) {
  const [date, setDate] = useState(initial?.expense_date ?? defaultDate);
  const [category, setCategory] = useState(initial?.category ?? "arriendo");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [pending, startTransition] = useTransition();

  function submit() {
    const fd = new FormData();
    fd.set("expense_date", date);
    fd.set("category", category);
    fd.set("amount", amount);
    fd.set("description", description);
    startTransition(async () => {
      try {
        if (initial) { await updateExpense(initial.id, fd); toast.success("Gasto actualizado"); }
        else { await createExpense(fd); toast.success("Gasto registrado"); }
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar. Intenta de nuevo.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-bg-2 border border-line rounded-2xl max-w-md w-full p-6 space-y-4">
        <h3 className="font-display text-xl uppercase tracking-tight">{initial ? "Editar gasto" : "Registrar gasto"}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-fg/40">Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-fg/40">Monto (USD)</label>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-fg/40">Categoría</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} className="bg-bg-2">{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-fg/40">Descripción (opcional)</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. Pago de arriendo local" className={inputCls} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} disabled={pending} className="px-4 py-2 text-sm font-semibold text-fg/60 hover:text-fg transition-colors disabled:opacity-50">Cancelar</button>
          <button onClick={submit} disabled={pending} className="px-5 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50">
            {pending ? "Guardando…" : initial ? "Guardar" : "Registrar gasto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gestor de gastos fijos ────────────────────────────────────────────────────────

function RecurringManager({ recurring, onClose }: { recurring: Recurring[]; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState("arriendo");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  function add() {
    const fd = new FormData();
    fd.set("category", category);
    fd.set("amount", amount);
    fd.set("description", description);
    startTransition(async () => {
      try {
        await createRecurring(fd);
        setAmount(""); setDescription("");
        toast.success("Gasto fijo agregado");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo agregar.");
      }
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      try { await deleteRecurring(id); toast.success("Gasto fijo eliminado"); }
      catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo eliminar."); }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-bg-2 border border-line rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl uppercase tracking-tight">Gastos fijos</h3>
          <button onClick={onClose} className="text-fg/40 hover:text-fg text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-fg/50">
          Defínelos una vez (arriendo, sueldos…). Luego, en el detalle de cada mes, aplícalos con un clic.
        </p>

        {/* Lista */}
        <div className="space-y-1.5">
          {recurring.length === 0 && <p className="text-sm text-fg/30">Aún no hay gastos fijos.</p>}
          {recurring.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-semibold">{catLabel(r.category)}</span>
                {r.description && <span className="text-fg/40 text-xs"> · {r.description}</span>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-semibold text-red-400">{fmt(r.amount)}</span>
                <button onClick={() => remove(r.id)} disabled={pending}
                  className="text-xs text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-50">Eliminar</button>
              </div>
            </div>
          ))}
        </div>

        {/* Agregar */}
        <div className="border-t border-line pt-3 space-y-2">
          <p className="text-xs font-semibold text-fg/50 uppercase tracking-wider">Agregar gasto fijo</p>
          <div className="grid grid-cols-2 gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} className="bg-bg-2">{CATEGORY_LABELS[c]}</option>)}
            </select>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="Monto" className={inputCls} />
          </div>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (opcional)" className={inputCls + " w-full"} />
          <div className="flex justify-end">
            <button onClick={add} disabled={pending || !amount}
              className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50">
              {pending ? "Guardando…" : "Agregar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal de detalle del mes ──────────────────────────────────────────────────────

function MonthDetailModal({
  row, monthExpenses, hasRecurring, year, onClose,
  onAddExpense, onEditExpense, onDeleteExpense, onApplyRecurring,
}: {
  row: MonthRow;
  monthExpenses: Expense[];
  hasRecurring: boolean;
  year: string;
  onClose: () => void;
  onAddExpense: () => void;
  onEditExpense: (e: Expense) => void;
  onDeleteExpense: (e: Expense) => void;
  onApplyRecurring: () => void;
}) {
  const [sales, setSales] = useState<MonthSale[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ingresos" | "gastos">("ingresos");

  useEffect(() => {
    let alive = true;
    getMonthSales(row.month)
      .then((s) => { if (alive) setSales(s); })
      .catch(() => { if (alive) setSales([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [row.month]);

  function exportMonth() {
    const rows: (string | number)[][] = [];
    rows.push(["INGRESOS"]);
    rows.push(["Fecha", "Cliente", "Monto", "Descuento", "Método"]);
    for (const s of sales ?? [])
      rows.push([s.sale_date, s.member_name ?? "", s.total.toFixed(2), s.discount.toFixed(2), METHOD_LABELS[s.payment_method] ?? s.payment_method]);
    rows.push([]);
    rows.push(["GASTOS"]);
    rows.push(["Fecha", "Categoría", "Monto", "Descripción"]);
    for (const e of monthExpenses)
      rows.push([e.expense_date, catLabel(e.category), e.amount.toFixed(2), e.description ?? ""]);
    rows.push([]);
    rows.push(["Ingresos", row.total_amount.toFixed(2)]);
    rows.push(["Gastos", row.total_expenses.toFixed(2)]);
    rows.push(["Utilidad", row.net_profit.toFixed(2)]);
    downloadCSV(`contabilidad-${row.month.slice(0, 7)}.csv`, ["Detalle"], rows);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-bg-2 border border-line rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[88vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-xl uppercase tracking-tight">
              {MONTH_NAMES[row.monthIdx - 1]} {year}
            </h3>
            <p className="text-xs text-fg/40">
              Ingresos {fmt(row.total_amount)} · Gastos {fmt(row.total_expenses)} ·{" "}
              <span className={row.net_profit >= 0 ? "text-green-400" : "text-red-400"}>Utilidad {fmt(row.net_profit)}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-fg/40 hover:text-fg text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-line">
          {(["ingresos", "gastos"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                tab === t ? "border-accent text-fg" : "border-transparent text-fg/40 hover:text-fg/70"}`}>
              {t === "ingresos" ? "Ingresos" : "Gastos"}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={exportMonth} className="text-xs font-semibold text-accent hover:underline self-center">Exportar CSV</button>
        </div>

        {/* Ingresos */}
        {tab === "ingresos" && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Transfer." value={fmt(row.transfer_amount)} />
              <Stat label="Efectivo" value={fmt(row.cash_amount)} />
              <Stat label="Tarjeta" value={fmt(row.card_amount)} />
              <Stat label="CxC" value={fmt(row.cxc_amount)} />
            </div>
            {loading && <p className="text-sm text-fg/40">Cargando ventas…</p>}
            {!loading && (sales?.length ?? 0) === 0 && <p className="text-sm text-fg/30">Sin ventas este mes.</p>}
            {!loading && (sales?.length ?? 0) > 0 && (
              <div className="divide-y divide-line border border-line rounded-lg overflow-hidden">
                {sales!.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm bg-white/5">
                    <div className="min-w-0">
                      <span className="text-fg/40 text-xs">{fmtDate(s.sale_date)} · </span>
                      <span className="font-medium">{s.member_name ?? "Cliente ocasional"}</span>
                      <span className="text-fg/40 text-xs"> · {METHOD_LABELS[s.payment_method] ?? s.payment_method}</span>
                    </div>
                    <span className="font-semibold shrink-0">{fmt(s.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Gastos */}
        {tab === "gastos" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 justify-end">
              {hasRecurring && !row.isClosed && (
                <button onClick={onApplyRecurring}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-line hover:border-accent hover:text-accent transition-colors">
                  Aplicar gastos fijos
                </button>
              )}
              {!row.isClosed && (
                <button onClick={onAddExpense}
                  className="text-xs font-bold px-3 py-1.5 bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors">
                  + Agregar gasto
                </button>
              )}
            </div>
            {monthExpenses.length === 0 && <p className="text-sm text-fg/30">Sin gastos este mes.</p>}
            <div className="space-y-1.5">
              {monthExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 text-sm bg-white/5 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <span className="font-semibold">{catLabel(e.category)}</span>
                    <span className="text-fg/40 text-xs"> · {fmtDate(e.expense_date)}</span>
                    {e.description && <p className="text-xs text-fg/50 truncate">{e.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-red-400">{fmt(e.amount)}</span>
                    {!row.isClosed && (
                      <>
                        <button onClick={() => onEditExpense(e)} className="text-xs text-fg/40 hover:text-fg transition-colors">Editar</button>
                        <button onClick={() => onDeleteExpense(e)} className="text-xs text-red-400/70 hover:text-red-400 transition-colors">Eliminar</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {row.isClosed && <p className="text-xs text-fg/40 pt-1">Mes cerrado: reábrelo para modificar sus gastos.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────────

export default function ContabilidadClient({ rows, expenses, recurring, year, today }: Props) {
  const [pending, startTransition] = useTransition();
  const [selectedIdx, setSelectedIdx] = useState(rows[0]?.monthIdx ?? 1);
  const [confirm, setConfirm] = useState<{ row: MonthRow; action: "close" | "reopen" } | null>(null);
  const [expModal, setExpModal] = useState<{ initial: Expense | null; defaultDate: string } | null>(null);
  const [delExpense, setDelExpense] = useState<Expense | null>(null);
  const [detailRow, setDetailRow] = useState<MonthRow | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);

  const yearTotals = useMemo(() =>
    rows.reduce((acc, r) => {
      acc.income += r.total_amount; acc.expenses += r.total_expenses; acc.net += r.net_profit; return acc;
    }, { income: 0, expenses: 0, net: 0 }), [rows]);

  const expensesByMonth = useMemo(() => {
    const map = new Map<number, Expense[]>();
    for (const e of expenses) {
      const m = parseInt(e.expense_date.slice(5, 7), 10);
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(e);
    }
    return map;
  }, [expenses]);

  const selected = rows.find((r) => r.monthIdx === selectedIdx) ?? rows[0];
  const selectedExpenses = selected ? expensesByMonth.get(selected.monthIdx) ?? [] : [];
  // Mantener el modal de detalle sincronizado con datos frescos tras revalidar
  const detailFresh = detailRow ? rows.find((r) => r.monthIdx === detailRow.monthIdx) ?? detailRow : null;
  const detailExpenses = detailFresh ? expensesByMonth.get(detailFresh.monthIdx) ?? [] : [];
  const hasRecurring = recurring.some((r) => r.active);

  function handleConfirm() {
    if (!confirm) return;
    const { row, action } = confirm;
    const label = MONTH_NAMES[row.monthIdx - 1];
    startTransition(async () => {
      try {
        if (action === "close") { await closeMonth(row.month); toast.success(`${label} cerrado. La utilidad quedó congelada.`); }
        else { await reopenMonth(row.month); toast.success(`${label} reabierto.`); }
        setConfirm(null);
      } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo completar."); }
    });
  }
  function handleDeleteExpense() {
    if (!delExpense) return;
    startTransition(async () => {
      try { await deleteExpense(delExpense.id); toast.success("Gasto eliminado"); setDelExpense(null); }
      catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo eliminar."); }
    });
  }
  function handleApplyRecurring(month: string) {
    startTransition(async () => {
      try {
        const n = await applyRecurring(month);
        toast.success(n > 0 ? `${n} gasto${n === 1 ? "" : "s"} fijo${n === 1 ? "" : "s"} aplicado${n === 1 ? "" : "s"}` : "Los gastos fijos ya estaban aplicados");
      } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo aplicar."); }
    });
  }
  function exportYear() {
    const chrono = [...rows].sort((a, b) => a.monthIdx - b.monthIdx);
    downloadCSV(
      `contabilidad-${year}.csv`,
      ["Mes", "Ingresos", "Gastos", "Utilidad", "Ventas", "Socios nuevos", "Estado"],
      chrono.map((r) => [
        MONTH_NAMES[r.monthIdx - 1], r.total_amount.toFixed(2), r.total_expenses.toFixed(2),
        r.net_profit.toFixed(2), r.sale_count, r.new_members, r.isClosed ? "Cerrado" : "Abierto",
      ])
    );
  }

  return (
    <>
      {/* ── Resumen P&L del año ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <span className="text-[11px] uppercase tracking-wider text-fg/40">Ingresos {year}</span>
          <p className="font-display text-xl md:text-2xl mt-1 text-green-400">{fmt(yearTotals.income)}</p>
        </div>
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <span className="text-[11px] uppercase tracking-wider text-fg/40">Gastos {year}</span>
          <p className="font-display text-xl md:text-2xl mt-1 text-red-400">{fmt(yearTotals.expenses)}</p>
        </div>
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <span className="text-[11px] uppercase tracking-wider text-fg/40">Utilidad {year}</span>
          <p className={`font-display text-xl md:text-2xl mt-1 ${yearTotals.net >= 0 ? "text-fg" : "text-red-400"}`}>{fmt(yearTotals.net)}</p>
        </div>
      </div>

      {/* ── Gráfico ─────────────────────────────────────────────────────── */}
      {rows.length > 0 && <AnnualChart rows={rows} />}

      {/* ── Toolbar: filtro de mes + acciones ───────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-fg/40">Ver mes</label>
          <select value={selectedIdx} onChange={(e) => setSelectedIdx(Number(e.target.value))} className={inputCls + " min-w-[160px]"}>
            {rows.map((r) => (
              <option key={r.month} value={r.monthIdx} className="bg-bg-2">
                {MONTH_NAMES[r.monthIdx - 1]} {year}{r.isCurrent ? " (en curso)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setRecurringOpen(true)}
            className="px-4 py-2.5 border border-line hover:border-accent hover:text-accent text-sm font-semibold rounded-lg transition-colors">
            Gastos fijos
          </button>
          <button onClick={exportYear}
            className="px-4 py-2.5 border border-line hover:border-accent hover:text-accent text-sm font-semibold rounded-lg transition-colors">
            Exportar año
          </button>
          <button onClick={() => setExpModal({ initial: null, defaultDate: today })}
            className="px-5 py-2.5 bg-accent hover:bg-accent/80 text-white text-sm font-bold rounded-lg transition-colors">
            + Registrar gasto
          </button>
        </div>
      </div>

      {/* ── Tarjeta del mes seleccionado ────────────────────────────────── */}
      {selected && (
        <div className={`border rounded-xl overflow-hidden ${selected.isCurrent ? "border-accent/40" : "border-line"}`}>
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white/5">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-display text-lg uppercase tracking-tight">{MONTH_NAMES[selected.monthIdx - 1]} {year}</h4>
              {selected.isCurrent && <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-accent">En curso</span>}
              {selected.isClosed
                ? <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">Cerrado</span>
                : <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">Abierto</span>}
            </div>
            <DeltaBadge pct={selected.deltaPct} />
          </div>

          <div className="px-4 py-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-fg/40">Ingresos</span>
                <p className="font-display text-xl text-green-400">{fmt(selected.total_amount)}</p>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-fg/40">Gastos</span>
                <p className="font-display text-xl text-red-400">{fmt(selected.total_expenses)}</p>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-fg/40">Utilidad</span>
                <p className={`font-display text-xl ${selected.net_profit >= 0 ? "text-fg" : "text-red-400"}`}>{fmt(selected.net_profit)}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1 border-t border-line">
              <Stat label="Transfer." value={fmt(selected.transfer_amount)} />
              <Stat label="Efectivo" value={fmt(selected.cash_amount)} />
              <Stat label="Tarjeta" value={fmt(selected.card_amount)} />
              <Stat label="CxC" value={fmt(selected.cxc_amount)} />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-line">
              <Stat label="Ventas" value={selected.sale_count} />
              <Stat label="Gastos reg." value={selectedExpenses.length} />
              <Stat label="Socios nuevos" value={selected.new_members} />
            </div>

            {selected.notes && <p className="text-xs text-fg/50 italic">“{selected.notes}”</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => setDetailRow(selected)}
                className="px-4 py-2 border border-line hover:border-accent hover:text-accent text-xs font-bold rounded-lg transition-colors">
                Ver detalle
              </button>
              {selected.isClosed
                ? <button onClick={() => setConfirm({ row: selected, action: "reopen" })}
                    className="px-4 py-2 text-xs font-semibold text-fg/50 hover:text-fg transition-colors">Reabrir mes</button>
                : <button onClick={() => setConfirm({ row: selected, action: "close" })}
                    className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-xs font-bold rounded-lg transition-colors">Cerrar mes</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── Modales ─────────────────────────────────────────────────────── */}
      {detailFresh && (
        <MonthDetailModal
          key={detailFresh.month}
          row={detailFresh}
          monthExpenses={detailExpenses}
          hasRecurring={hasRecurring}
          year={year}
          onClose={() => setDetailRow(null)}
          onAddExpense={() => setExpModal({ initial: null, defaultDate: `${detailFresh.month.slice(0, 7)}-01` })}
          onEditExpense={(e) => setExpModal({ initial: e, defaultDate: e.expense_date })}
          onDeleteExpense={(e) => setDelExpense(e)}
          onApplyRecurring={() => handleApplyRecurring(detailFresh.month)}
        />
      )}

      {recurringOpen && <RecurringManager recurring={recurring} onClose={() => setRecurringOpen(false)} />}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-bg-2 border border-line rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-xl uppercase tracking-tight">{confirm.action === "close" ? "Cerrar mes" : "Reabrir mes"}</h3>
            <p className="text-sm text-fg/60">
              {confirm.action === "close" ? (
                <>Vas a congelar <strong>{MONTH_NAMES[confirm.row.monthIdx - 1]} {year}</strong>. Ingresos, gastos y utilidad quedarán guardados y no se podrán modificar hasta reabrirlo.</>
              ) : (
                <>Vas a reabrir <strong>{MONTH_NAMES[confirm.row.monthIdx - 1]} {year}</strong>. Volverá a calcularse en vivo.</>
              )}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirm(null)} disabled={pending} className="px-4 py-2 text-sm font-semibold text-fg/60 hover:text-fg transition-colors disabled:opacity-50">Cancelar</button>
              <button onClick={handleConfirm} disabled={pending} className="px-5 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50">
                {pending ? "Guardando…" : confirm.action === "close" ? "Cerrar mes" : "Reabrir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {delExpense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-bg-2 border border-line rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-xl uppercase tracking-tight">Eliminar gasto</h3>
            <p className="text-sm text-fg/60">
              Vas a eliminar el gasto de <strong>{fmt(delExpense.amount)}</strong> ({catLabel(delExpense.category)} · {fmtDate(delExpense.expense_date)}). No se puede deshacer.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setDelExpense(null)} disabled={pending} className="px-4 py-2 text-sm font-semibold text-fg/60 hover:text-fg transition-colors disabled:opacity-50">Cancelar</button>
              <button onClick={handleDeleteExpense} disabled={pending} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50">
                {pending ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {expModal && (
        <ExpenseForm initial={expModal.initial} defaultDate={expModal.defaultDate} onClose={() => setExpModal(null)} />
      )}
    </>
  );
}
