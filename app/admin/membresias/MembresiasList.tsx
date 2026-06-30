"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  renewMembership,
  cancelMembership,
  updateMembership,
  freezeMembership,
  resumeMembership,
} from "./actions";
import NewMembershipForm from "./NewMembershipForm";
import { todayInEcuador } from "@/lib/date";

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors";

// ── Types ──────────────────────────────────────────────────────────────────────

type Membership = {
  id: string;
  member_id: string;
  full_name: string;
  phone: string;
  plan_id: string;
  plan_name: string;
  plan_color: string;
  plan_duration_days: number;
  start_date: string;
  end_date: string;
  paid_amount: number;
  status: string;
  effective_status: string;
  days_until_expiry: number;
  cancellation_reason: string | null;
};

type Member = { id: string; full_name: string; phone: string };
type Plan = { id: string; name: string; price: number; duration_days: number; color: string };

type Props = {
  memberships: Membership[];
  members: Member[];
  plans: Plan[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("593")
    ? digits
    : digits.startsWith("0")
    ? "593" + digits.slice(1)
    : "593" + digits;
  return `https://wa.me/${normalized}`;
}

function downloadCSV(rows: Membership[], filename: string) {
  const headers = ["Nombre", "Teléfono", "Membresía", "Cupo (días)", "Fecha Fin", "Precio"];
  const lines = rows.map((r) =>
    [
      `"${r.full_name}"`,
      r.phone,
      `"${r.plan_name}"`,
      r.plan_duration_days,
      r.end_date,
      `$${r.paid_amount.toFixed(2)}`,
    ].join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// WhatsApp SVG icon
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── Modal: editar fechas de la membresía ───────────────────────────────────────

function EditMembershipModal({
  membership,
  onClose,
}: {
  membership: Membership;
  onClose: () => void;
}) {
  const [startDate, setStartDate] = useState(membership.start_date);
  const [endDate, setEndDate] = useState(membership.end_date);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await updateMembership(membership.id, startDate, endDate);
        toast.success("Fechas actualizadas");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al actualizar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-line rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg uppercase tracking-tight">Editar fechas</h2>
          <button onClick={onClose} className="text-fg/40 hover:text-fg text-xl leading-none">
            ✕
          </button>
        </div>
        <p className="text-fg/40 text-xs mb-5">
          {membership.full_name} · {membership.plan_name}
        </p>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-fg/50 text-xs uppercase tracking-wider">Fecha de inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-fg/50 text-xs uppercase tracking-wider">Fecha de fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-line">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Row component ──────────────────────────────────────────────────────────────

function MembresiaRow({
  m,
  onEdit,
  onCancel,
  onRenew,
}: {
  m: Membership;
  onEdit: (m: Membership) => void;
  onCancel: (m: Membership) => void;
  onRenew: (m: Membership) => void;
}) {
  const [freezePending, startFreeze] = useTransition();

  return (
    <tr className="border-b border-line/50 last:border-0 hover:bg-white/[0.03] transition-colors">
      {/* Nombre + WhatsApp */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <a
            href={waLink(m.phone)}
            target="_blank"
            rel="noreferrer"
            title={`WhatsApp: ${m.phone}`}
            className="shrink-0 w-6 h-6 rounded-full bg-[#25d366] flex items-center justify-center text-white hover:scale-110 transition-transform"
          >
            <WhatsAppIcon />
          </a>
          <div>
            <p className="font-medium text-fg leading-tight">{m.full_name}</p>
            <p className="text-fg/40 text-xs">{m.phone}</p>
          </div>
        </div>
      </td>

      {/* Membresía badge */}
      <td className="px-4 py-3">
        <span
          className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold text-white max-w-[130px] truncate"
          style={{ backgroundColor: m.plan_color || "#555" }}
          title={m.plan_name}
        >
          {m.plan_name}
        </span>
        {m.effective_status === "cancelled" && m.cancellation_reason && (
          <p className="text-fg/40 text-xs mt-1">Motivo: {m.cancellation_reason}</p>
        )}
      </td>

      {/* Cupo (duration_days del plan) */}
      <td className="px-4 py-3 text-fg/70 text-sm">{m.plan_duration_days}</td>

      {/* Fecha Fin */}
      <td className="px-4 py-3 text-fg/70 text-sm">
        {m.end_date}
        {m.effective_status === "active" && m.days_until_expiry <= 14 && (
          <p className={`text-xs ${m.days_until_expiry <= 5 ? "text-red-400" : "text-amber-400"}`}>
            {m.days_until_expiry}d restantes
          </p>
        )}
      </td>

      {/* Precio */}
      <td className="px-4 py-3 text-fg/70 text-sm">${m.paid_amount.toFixed(2)}</td>

      {/* Acciones */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={() => onEdit(m)}
            className="text-xs text-fg/50 hover:text-fg border border-line hover:border-fg/40 px-2.5 py-1 rounded transition-colors"
          >
            Editar
          </button>
          <button
            onClick={() => onRenew(m)}
            className="text-xs text-accent hover:text-accent/70 border border-accent/40 hover:border-accent px-2.5 py-1 rounded transition-colors whitespace-nowrap"
          >
            Renovar
          </button>
          {m.effective_status === "active" && (
            <button
              disabled={freezePending}
              onClick={() =>
                startFreeze(async () => {
                  try {
                    await freezeMembership(m.id);
                    toast.success("Membresía congelada");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Error al congelar");
                  }
                })
              }
              className="text-xs text-blue-400 hover:text-blue-300 border border-blue-400/40 hover:border-blue-400 px-2.5 py-1 rounded transition-colors disabled:opacity-40"
              title="Pausar la membresía (se reanuda extendiendo la fecha de fin)"
            >
              {freezePending ? "..." : "Congelar"}
            </button>
          )}
          {m.effective_status === "frozen" && (
            <button
              disabled={freezePending}
              onClick={() =>
                startFreeze(async () => {
                  try {
                    await resumeMembership(m.id);
                    toast.success("Membresía reanudada");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Error al reanudar");
                  }
                })
              }
              className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-400/40 hover:border-emerald-400 px-2.5 py-1 rounded transition-colors disabled:opacity-40"
            >
              {freezePending ? "..." : "Reanudar"}
            </button>
          )}
          {m.effective_status === "active" && (
            <button
              onClick={() => onCancel(m)}
              className="text-xs text-fg/30 hover:text-red-400 border border-line hover:border-red-400/40 px-2.5 py-1 rounded transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Section (Vencidas / Activas / Suspendidas) ─────────────────────────────────

function MembresiaSection({
  title,
  rows,
  csvFilename,
  onEdit,
  onCancel,
  onRenew,
}: {
  title: string;
  rows: Membership[];
  csvFilename: string;
  onEdit: (m: Membership) => void;
  onCancel: (m: Membership) => void;
  onRenew: (m: Membership) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filtered = rows.filter(
    (m) =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search) ||
      m.plan_name.toLowerCase().includes(search.toLowerCase())
  );

  const total = filtered.length;
  const pageCount = Math.ceil(total / rowsPerPage) || 1;
  const currentPage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);

  function handleSearch(v: string) {
    setSearch(v);
    setPage(0);
  }

  return (
    <div className="space-y-3">
      {/* Section title */}
      <h3 className="font-display text-base uppercase tracking-tight text-fg/80">{title}</h3>

      {/* Toolbar: search + total badge + excel */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="flex-1 w-full sm:max-w-sm">
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar membresía por nombre o apellido..."
            className="w-full bg-white/5 border border-line text-fg text-sm rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-fg/30"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <span className="px-3 py-2 bg-accent text-white text-xs font-bold rounded-lg">
            Total: {total}
          </span>
          <button
            onClick={() => downloadCSV(filtered, csvFilename)}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
          >
            ↓ EXCEL
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-line rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center space-y-1">
            <p className="text-fg/40 text-sm">No hay membresías que mostrar</p>
            {search && (
              <p className="text-fg/25 text-xs">Intenta ajustar los filtros de búsqueda</p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-fg/40 text-xs uppercase tracking-wider bg-white/[0.02]">
                    <th className="text-left px-4 py-3">Nombre</th>
                    <th className="text-left px-4 py-3">Membresía</th>
                    <th className="text-left px-4 py-3">Cupo</th>
                    <th className="text-left px-4 py-3">Fecha Fin</th>
                    <th className="text-left px-4 py-3">Precio</th>
                    <th className="text-right px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((m) => (
                    <MembresiaRow key={m.id} m={m} onEdit={onEdit} onCancel={onCancel} onRenew={onRenew} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-line text-xs text-fg/50">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                  className="bg-white/10 border border-line rounded px-2 py-0.5 text-fg text-xs outline-none focus:border-accent"
                >
                  <option value={10}>10</option>
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
                  de {total}
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
  );
}

// ── Modal: cancelar membresía con motivo ──────────────────────────────────────

const CANCEL_REASONS = [
  "Solicitud del socio",
  "Falta de pago",
  "Cambio de plan",
  "Creada por error",
  "Otro",
];

function CancelMembershipModal({
  membership,
  onClose,
}: {
  membership: Membership;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    const finalReason = reason === "Otro" ? note.trim() || "Otro" : reason;
    startTransition(async () => {
      try {
        await cancelMembership(membership.id, finalReason);
        toast.success("Membresía cancelada");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cancelar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-line rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div>
          <h2 className="font-display text-lg uppercase tracking-tight text-red-400">
            Cancelar membresía
          </h2>
          <p className="text-fg/50 text-sm mt-1">
            <span className="text-fg font-semibold">{membership.full_name}</span> ·{" "}
            {membership.plan_name} (vence {membership.end_date})
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-fg/50 text-xs uppercase tracking-wider">Motivo</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
            {CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {reason === "Otro" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-fg/50 text-xs uppercase tracking-wider">Detalle</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Escribe el motivo..."
              className={inputCls}
              autoFocus
            />
          </div>
        )}

        <p className="text-fg/40 text-xs">
          La membresía pasará a la lista de canceladas. No se elimina: conservas el historial.
        </p>

        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors"
          >
            No cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={pending}
            className="px-5 py-2 text-sm font-semibold bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {pending ? "Cancelando..." : "Sí, cancelar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: renovar con confirmación (fechas encadenadas + cobro) ───────────────

function dayAfterStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function fmtLong(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function RenewMembershipModal({
  membership,
  plans,
  onClose,
}: {
  membership: Membership;
  plans: Plan[];
  onClose: () => void;
}) {
  const plan = plans.find((p) => p.id === membership.plan_id);
  const defaultPrice = plan?.price ?? membership.paid_amount;
  const [amount, setAmount] = useState(String(defaultPrice));
  const [method, setMethod] = useState("cash");
  const [bankRef, setBankRef] = useState("");
  const [pending, startTransition] = useTransition();

  // Fechas calculadas (mismo criterio que el servidor): si está vigente,
  // arranca el día siguiente al vencimiento; si ya venció, hoy.
  const today = todayInEcuador();
  const newStart = membership.end_date >= today ? dayAfterStr(membership.end_date) : today;
  const newEnd = addDaysStr(newStart, membership.plan_duration_days);
  const stacked = newStart > today;

  function handleConfirm() {
    startTransition(async () => {
      try {
        await renewMembership(membership.id, {
          paidAmount: parseFloat(amount) || 0,
          paymentMethod: method,
          bankReference: method === "transfer" ? bankRef || null : null,
        });
        toast.success("Membresía renovada");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al renovar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-line rounded-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg uppercase tracking-tight">Renovar membresía</h2>
            <p className="text-fg/40 text-xs mt-0.5">
              {membership.full_name} · {membership.plan_name}
            </p>
          </div>
          <button onClick={onClose} className="text-fg/40 hover:text-fg text-xl leading-none">✕</button>
        </div>

        {/* Nuevo periodo */}
        <div className="rounded-xl border border-line bg-white/5 px-4 py-3">
          <p className="text-fg/40 text-xs uppercase tracking-wider">Nuevo periodo</p>
          <p className="text-sm mt-1">
            {fmtLong(newStart)} → {fmtLong(newEnd)}
          </p>
          {stacked && (
            <p className="text-emerald-400/80 text-xs mt-1">
              Inicia al vencer la actual — el socio no pierde los días restantes.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-fg/50 text-xs uppercase tracking-wider">Monto cobrado</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-fg/50 text-xs uppercase tracking-wider">Método</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
              <option value="cxc">Crédito (CxC)</option>
              <option value="other">Otro</option>
            </select>
          </div>
        </div>

        {method === "transfer" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-fg/50 text-xs uppercase tracking-wider">Referencia (opcional)</label>
            <input
              value={bankRef}
              onChange={(e) => setBankRef(e.target.value)}
              placeholder="N° de comprobante"
              className={inputCls}
            />
          </div>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={pending}
            className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {pending ? "Renovando..." : "Confirmar renovación"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────

export default function MembresiasList({ memberships, members, plans }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Membership | null>(null);
  const [cancelling, setCancelling] = useState<Membership | null>(null);
  const [renewing, setRenewing] = useState<Membership | null>(null);

  const today = todayInEcuador();
  const expired = memberships.filter((m) => m.effective_status === "expired");
  const activeAll = memberships.filter((m) => m.effective_status === "active");
  // Programadas: ya pagadas pero su periodo aún no empieza (encadenadas).
  const scheduled = activeAll.filter((m) => m.start_date > today);
  const active = activeAll.filter((m) => m.start_date <= today);
  const frozen = memberships.filter((m) => m.effective_status === "frozen");
  const cancelled = memberships.filter((m) => m.effective_status === "cancelled");
  // Por vencer: activas que vencen en los próximos 7 días (incluye hoy)
  const expiringSoon = active.filter(
    (m) => m.days_until_expiry >= 0 && m.days_until_expiry <= 7
  );

  return (
    <>
      {/* Top bar: nueva membresía */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Nueva membresía
        </button>
      </div>

      {/* Stacked sections */}
      <div className="space-y-8">
        {expiringSoon.length > 0 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
            <MembresiaSection
              title="⚠ Por Vencer (próximos 7 días)"
              rows={expiringSoon}
              csvFilename="membresias_por_vencer.csv"
              onEdit={setEditing}
              onCancel={setCancelling}
              onRenew={setRenewing}
            />
          </div>
        )}
        <MembresiaSection
          title="Lista de Membresías Vencidas"
          rows={expired}
          csvFilename="membresias_vencidas.csv"
          onEdit={setEditing}
          onCancel={setCancelling}
          onRenew={setRenewing}
        />
        <MembresiaSection
          title="Lista de Membresías Activas"
          rows={active}
          csvFilename="membresias_activas.csv"
          onEdit={setEditing}
          onCancel={setCancelling}
          onRenew={setRenewing}
        />
        {scheduled.length > 0 && (
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.04] p-4">
            <MembresiaSection
              title="🗓 Programadas (inician al vencer la actual)"
              rows={scheduled}
              csvFilename="membresias_programadas.csv"
              onEdit={setEditing}
              onCancel={setCancelling}
              onRenew={setRenewing}
            />
          </div>
        )}
        {frozen.length > 0 && (
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.04] p-4">
            <MembresiaSection
              title="❄ Congeladas (pausadas)"
              rows={frozen}
              csvFilename="membresias_congeladas.csv"
              onEdit={setEditing}
              onCancel={setCancelling}
              onRenew={setRenewing}
            />
          </div>
        )}
        {cancelled.length > 0 && (
          <MembresiaSection
            title="Lista de Membresías Canceladas"
            rows={cancelled}
            csvFilename="membresias_canceladas.csv"
            onEdit={setEditing}
            onCancel={setCancelling}
            onRenew={setRenewing}
          />
        )}
      </div>

      {/* Modal editar fechas */}
      {editing && (
        <EditMembershipModal membership={editing} onClose={() => setEditing(null)} />
      )}

      {/* Modal cancelar con motivo */}
      {cancelling && (
        <CancelMembershipModal membership={cancelling} onClose={() => setCancelling(null)} />
      )}

      {/* Modal renovar con confirmación */}
      {renewing && (
        <RenewMembershipModal membership={renewing} plans={plans} onClose={() => setRenewing(null)} />
      )}

      {/* Modal nueva membresía */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-line rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg uppercase tracking-tight">Nueva membresía</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-fg/40 hover:text-fg text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <NewMembershipForm
              members={members}
              plans={plans}
              onClose={() => setShowForm(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
