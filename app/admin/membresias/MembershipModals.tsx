"use client";

// =============================================================================
// Modales de membresía reutilizables
// =============================================================================
// Editar fechas, cancelar (con motivo) y renovar. Se usan tanto en la lista de
// /admin/membresias como en la ficha del socio (/admin/miembros/[id]).
// =============================================================================

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { renewMembership, cancelMembership, updateMembership } from "./actions";
import { todayInEcuador } from "@/lib/date";

export type Membership = {
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

export type Plan = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  color: string;
};

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors";

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

// ── Modal: editar fechas de la membresía ───────────────────────────────────────

export function EditMembershipModal({
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

// ── Modal: cancelar membresía con motivo ──────────────────────────────────────

const CANCEL_REASONS = [
  "Solicitud del socio",
  "Falta de pago",
  "Cambio de plan",
  "Creada por error",
  "Otro",
];

export function CancelMembershipModal({
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

export function RenewMembershipModal({
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
