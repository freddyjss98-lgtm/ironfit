"use client";

import { useState, useTransition } from "react";
import { createMembership } from "./actions";

type Member = { id: string; full_name: string; phone: string };
type Plan = { id: string; name: string; price: number; duration_days: number; color: string };

type Props = {
  members: Member[];
  plans: Plan[];
  onClose: () => void;
  defaultMemberId?: string;
};

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors";
const labelCls = "text-fg/50 text-xs uppercase tracking-wider";

export default function NewMembershipForm({ members, plans, onClose, defaultMemberId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "");
  const [paidAmount, setPaidAmount] = useState(String(plans[0]?.price ?? ""));

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  function handlePlanChange(id: string) {
    setSelectedPlanId(id);
    const plan = plans.find((p) => p.id === id);
    if (plan) setPaidAmount(String(plan.price));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        await createMembership(fd);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Atleta *</label>
          <select
            name="member_id"
            required
            defaultValue={defaultMemberId ?? ""}
            className={inputCls}
          >
            {!defaultMemberId && <option value="">Seleccionar miembro...</option>}
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name} — {m.phone}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Plan *</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {plans.map((plan) => (
              <label
                key={plan.id}
                className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                  selectedPlanId === plan.id
                    ? "border-accent bg-accent/10"
                    : "border-line bg-white/5 hover:border-line-2"
                }`}
              >
                <input
                  type="radio"
                  name="plan_id"
                  value={plan.id}
                  checked={selectedPlanId === plan.id}
                  onChange={() => handlePlanChange(plan.id)}
                  className="sr-only"
                />
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: plan.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{plan.name}</p>
                  <p className="text-xs text-fg/40">{plan.duration_days} días</p>
                </div>
                <span className="text-sm font-semibold shrink-0">${plan.price}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Fecha de inicio *</label>
          <input
            name="start_date"
            type="date"
            required
            defaultValue={today}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Monto pagado (USD) *</label>
          <input
            name="paid_amount"
            type="number"
            required
            min="0"
            step="0.01"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Forma de pago *</label>
          <select name="payment_method" required className={inputCls}>
            <option value="transfer">Transferencia bancaria</option>
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="other">Otro</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Referencia / comprobante</label>
          <input
            name="bank_reference"
            className={inputCls}
            placeholder="Nº transferencia (opcional)"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Notas</label>
          <input name="notes" className={inputCls} placeholder="Opcional" />
        </div>
      </div>

      {selectedPlan && (
        <div className="bg-white/5 border border-line rounded-lg px-4 py-3 text-sm text-fg/60">
          Vence en{" "}
          <strong className="text-fg">
            {(() => {
              const d = new Date();
              d.setDate(d.getDate() + selectedPlan.duration_days);
              return d.toLocaleDateString("es-EC", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
            })()}
          </strong>{" "}
          ({selectedPlan.duration_days} días)
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? "Registrando..." : "Registrar membresía"}
        </button>
      </div>
    </form>
  );
}
