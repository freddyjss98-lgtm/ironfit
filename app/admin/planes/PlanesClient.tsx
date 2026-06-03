"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPlan, updatePlan, togglePlanActive } from "./actions";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  color: string;
  active: boolean;
};

type Props = { plans: Plan[] };

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelCls = "text-fg/50 text-xs uppercase tracking-wider";

function PlanForm({
  plan,
  onClose,
}: {
  plan?: Plan;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        if (plan) {
          await updatePlan(plan.id, fd);
        } else {
          await createPlan(fd);
        }
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Nombre del plan *</label>
          <input
            name="name"
            required
            defaultValue={plan?.name}
            className={inputCls}
            placeholder="Ej. Iron Fit"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Precio (USD) *</label>
          <input
            name="price"
            type="number"
            required
            min="0"
            step="0.01"
            defaultValue={plan?.price}
            className={inputCls}
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Duración (días) *</label>
          <input
            name="duration_days"
            type="number"
            required
            min="1"
            defaultValue={plan?.duration_days}
            className={inputCls}
            placeholder="30"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Color</label>
          <div className="flex gap-2 items-center">
            <input
              name="color"
              type="color"
              defaultValue={plan?.color ?? "#e84b1f"}
              className="h-9 w-16 rounded bg-transparent border border-white/15 cursor-pointer"
            />
            <span className="text-fg/40 text-xs">Color del plan en la UI</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Descripción</label>
          <input
            name="description"
            defaultValue={plan?.description ?? ""}
            className={inputCls}
            placeholder="Opcional"
          />
        </div>
      </div>

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
          {pending ? "Guardando..." : plan ? "Actualizar" : "Crear plan"}
        </button>
      </div>
    </form>
  );
}

export default function PlanesClient({ plans }: Props) {
  const [modal, setModal] = useState<{ plan?: Plan } | null>(null);

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => setModal({})}
          className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Nuevo plan
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white/5 border rounded-xl p-5 flex flex-col gap-3 ${plan.active ? "border-line" : "border-line/30 opacity-50"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: plan.color }}
                />
                <p className="font-semibold">{plan.name}</p>
              </div>
              {!plan.active && (
                <span className="text-xs text-fg/30 border border-line/30 px-2 py-0.5 rounded">
                  Inactivo
                </span>
              )}
            </div>

            {plan.description && (
              <p className="text-fg/40 text-xs">{plan.description}</p>
            )}

            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-fg/40 text-xs">Precio</p>
                <p className="font-semibold">${plan.price}</p>
              </div>
              <div>
                <p className="text-fg/40 text-xs">Duración</p>
                <p className="font-semibold">{plan.duration_days} días</p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setModal({ plan })}
                className="flex-1 text-xs border border-line text-fg/50 hover:text-fg py-1.5 rounded-lg transition-colors"
              >
                Editar
              </button>
              <TogglePlanButton planId={plan.id} active={plan.active} />
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-line rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg uppercase tracking-tight">
                {modal.plan ? "Editar plan" : "Nuevo plan"}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="text-fg/40 hover:text-fg text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <PlanForm plan={modal.plan} onClose={() => setModal(null)} />
          </div>
        </div>
      )}
    </>
  );
}

function TogglePlanButton({ planId, active }: { planId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            await togglePlanActive(planId, active);
            toast.success(active ? "Plan desactivado" : "Plan activado");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error");
          }
        });
      }}
      className="text-xs border border-line text-fg/50 hover:text-fg px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
    >
      {pending ? "..." : active ? "Desactivar" : "Activar"}
    </button>
  );
}
