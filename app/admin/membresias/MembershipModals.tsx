"use client";

// =============================================================================
// Modales de membresía reutilizables
// =============================================================================
// Editar fechas, cancelar (con motivo) y renovar. Se usan tanto en la lista de
// /admin/membresias como en la ficha del socio (/admin/miembros/[id]).
// =============================================================================

import { useState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import {
  renewMembership,
  cancelMembership,
  updateMembership,
  getMembershipSale,
  type MembershipSale,
} from "./actions";
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

/**
 * Corrige una membresía mal registrada, en sitio.
 *
 * NO es "cambiar de plan": eso cancela la actual, crea una nueva y cobra otra
 * vez. Esto es para el error de dedo — plan equivocado, monto mal tecleado,
 * fechas corridas — y por eso ajusta la venta que ya existe en vez de crear otra.
 */
export function EditMembershipModal({
  membership,
  plans,
  onClose,
}: {
  membership: Membership;
  plans: Plan[];
  onClose: () => void;
}) {
  const [startDate, setStartDate] = useState(membership.start_date);
  const [endDate, setEndDate] = useState(membership.end_date);
  const [planId, setPlanId] = useState(membership.plan_id);
  const [amount, setAmount] = useState(String(membership.paid_amount));
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [recalc, setRecalc] = useState(true);
  const [sale, setSale] = useState<MembershipSale | null>(null);
  const amountTouched = useRef(false);
  const [pending, startTransition] = useTransition();

  const selectedPlan = plans.find((p) => p.id === planId);
  const planChanged = planId !== membership.plan_id;
  const suggestedEnd = selectedPlan
    ? addDaysStr(startDate, selectedPlan.duration_days)
    : endDate;

  useEffect(() => {
    let alive = true;
    getMembershipSale(membership.id)
      .then((s) => {
        if (!alive) return;
        setSale(s);
        if (s) setMethod(s.payment_method);
      })
      .catch(() => alive && setSale(null));
    return () => {
      alive = false;
    };
  }, [membership.id]);

  function applyPlan(id: string) {
    setPlanId(id);
    const p = plans.find((x) => x.id === id);
    if (!p) return;
    if (id === membership.plan_id) {
      setEndDate(membership.end_date);
      if (!amountTouched.current) setAmount(String(membership.paid_amount));
      return;
    }
    if (recalc) setEndDate(addDaysStr(startDate, p.duration_days));
    // El precio del plan es solo una sugerencia: si ya tecleaste un monto, manda el tuyo.
    if (!amountTouched.current) setAmount(String(p.price));
  }

  function applyRecalc(v: boolean) {
    setRecalc(v);
    if (!planChanged || !selectedPlan) return;
    setEndDate(v ? addDaysStr(startDate, selectedPlan.duration_days) : membership.end_date);
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateMembership(membership.id, {
          startDate,
          endDate,
          planId,
          paidAmount: parseFloat(amount) || 0,
          paymentMethod: sale ? method : undefined,
          notes,
        });
        toast.success("Membresía actualizada");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al actualizar");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-line rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg uppercase tracking-tight">Editar membresía</h2>
          <button onClick={onClose} className="text-fg/40 hover:text-fg text-xl leading-none">
            ✕
          </button>
        </div>
        <p className="text-fg/40 text-xs mb-5">
          {membership.full_name} · {membership.plan_name}
        </p>

        <div className="space-y-4">
          {/* Plan */}
          <div className="flex flex-col gap-1.5">
            <label className="text-fg/50 text-xs uppercase tracking-wider">Plan</label>
            <select value={planId} onChange={(e) => applyPlan(e.target.value)} className={inputCls}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.duration_days} días · ${p.price.toFixed(2)}
                </option>
              ))}
              {!plans.some((p) => p.id === membership.plan_id) && (
                <option value={membership.plan_id}>{membership.plan_name} (plan inactivo)</option>
              )}
            </select>
          </div>

          {planChanged && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] p-3 space-y-2">
              <p className="text-amber-300/90 text-xs leading-relaxed">
                Se corrige esta misma membresía: no se crea otra ni se genera un cobro nuevo. Si
                el socio de verdad cambió de plan, cierra esto y usa <strong>Cambiar plan</strong>.
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recalc}
                  onChange={(e) => applyRecalc(e.target.checked)}
                  className="mt-0.5 accent-accent"
                />
                <span className="text-xs text-fg/70">
                  Ajustar la fecha de fin al nuevo plan
                  {selectedPlan && (
                    <span className="block text-fg/40 mt-0.5">
                      {selectedPlan.duration_days} días → {fmtLong(suggestedEnd)}
                    </span>
                  )}
                </span>
              </label>
            </div>
          )}

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-fg/50 text-xs uppercase tracking-wider">Inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-fg/50 text-xs uppercase tracking-wider">Fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Cobro */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-fg/50 text-xs uppercase tracking-wider">Monto cobrado</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => {
                  amountTouched.current = true;
                  setAmount(e.target.value);
                }}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-fg/50 text-xs uppercase tracking-wider">Método</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={!sale}
                className={`${inputCls} disabled:opacity-40`}
              >
                {Object.entries(METHOD_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {sale ? (
            <p className="text-fg/35 text-xs">
              Hay un cobro registrado de ${sale.total.toFixed(2)} el {sale.sale_date}. Al guardar
              se corrige esa misma venta, no se crea otra.
              {sale.item_count > 1 && " La venta trae más productos: solo se ajusta la parte de la membresía."}
            </p>
          ) : (
            <p className="text-fg/35 text-xs">
              Esta membresía no tiene una venta enlazada: el monto queda solo en su ficha.
            </p>
          )}

          {/* Notas */}
          <div className="flex flex-col gap-1.5">
            <label className="text-fg/50 text-xs uppercase tracking-wider">
              Nota interna <span className="normal-case tracking-normal text-fg/25">(opcional)</span>
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: corregido, se registró Iron en vez de Iron Fit"
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

const METHOD_LABELS: Record<string, string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
  cxc: "Cuentas x Cobrar",
  other: "Otro",
};

/**
 * Ofrece anular el cobro de la membresía que se está cancelando.
 *
 * Solo aparece si hay una venta viva enlazada. El default se propone según el
 * motivo — "Creada por error" es el único caso donde el cobro no debería existir;
 * en "Solicitud del socio" o "Falta de pago" el socio sí usó días y la plata se
 * queda. Si el usuario toca el check, su decisión manda sobre el default.
 *
 * Se comparte con el modal de /admin/miembros para no duplicar la regla.
 */
export function SaleVoidToggle({
  membershipId,
  reason,
  checked,
  onChange,
}: {
  membershipId: string;
  reason: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const [sale, setSale] = useState<MembershipSale | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    let alive = true;
    getMembershipSale(membershipId)
      .then((s) => alive && setSale(s))
      .catch(() => alive && setSale(null));
    return () => {
      alive = false;
    };
  }, [membershipId]);

  useEffect(() => {
    if (!touched.current) {
      onChange(reason === "Creada por error" && !!sale && sale.item_count === 1);
    }
  }, [reason, sale, onChange]);

  if (!sale) return null;
  const mixta = sale.item_count > 1;

  return (
    <label
      className={`flex items-start gap-2.5 rounded-lg border p-3 ${
        mixta
          ? "border-line bg-white/[0.02] cursor-not-allowed"
          : "border-line bg-white/5 cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked && !mixta}
        disabled={mixta}
        onChange={(e) => {
          touched.current = true;
          onChange(e.target.checked);
        }}
        className="mt-0.5 accent-red-500 disabled:opacity-40"
      />
      <span className="text-xs leading-relaxed">
        <span className="block text-fg">Anular también este cobro</span>
        <span className="block text-fg/40 mt-0.5">
          ${sale.total.toFixed(2)} · {sale.sale_date} ·{" "}
          {METHOD_LABELS[sale.payment_method] ?? sale.payment_method}
        </span>
        {mixta ? (
          <span className="block text-amber-400/80 mt-1">
            La venta trae otros productos. Anúlala desde Ventas para no borrar cobros buenos.
          </span>
        ) : (
          <span className="block text-fg/30 mt-1">
            Sale de Contabilidad, pero queda registrada como anulada.
          </span>
        )}
      </span>
    </label>
  );
}

export function CancelMembershipModal({
  membership,
  onClose,
}: {
  membership: Membership;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [note, setNote] = useState("");
  const [voidSale, setVoidSale] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    const finalReason = reason === "Otro" ? note.trim() || "Otro" : reason;
    startTransition(async () => {
      try {
        await cancelMembership(membership.id, finalReason, voidSale);
        toast.success(voidSale ? "Membresía cancelada y cobro anulado" : "Membresía cancelada");
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

        <SaleVoidToggle
          membershipId={membership.id}
          reason={reason}
          checked={voidSale}
          onChange={setVoidSale}
        />

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
