"use client";

// =============================================================================
// Panel de membresías dentro de la ficha del socio
// =============================================================================
// Reúne las acciones que ya existen en /admin/membresias (agregar, renovar,
// editar fechas, congelar/reanudar, cancelar) pero enfocadas en UN socio.
// Reutiliza los modales compartidos y el formulario de alta.
// =============================================================================

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import { freezeMembership, resumeMembership } from "../../membresias/actions";
import NewMembershipForm from "../../membresias/NewMembershipForm";
import {
  EditMembershipModal,
  CancelMembershipModal,
  RenewMembershipModal,
  type Membership,
  type Plan,
} from "../../membresias/MembershipModals";

type MemberBasic = { id: string; full_name: string; phone: string };

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  expired: "bg-red-500/15 text-red-400",
  frozen: "bg-blue-500/15 text-blue-400",
  cancelled: "bg-white/10 text-fg/40",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  expired: "Vencida",
  frozen: "Congelada",
  cancelled: "Cancelada",
};

const btnBase =
  "text-xs px-2.5 py-1 rounded border transition-colors disabled:opacity-40";

function MembershipCard({
  m,
  onEdit,
  onRenew,
  onCancel,
}: {
  m: Membership;
  onEdit: () => void;
  onRenew: () => void;
  onCancel: () => void;
}) {
  const [freezePending, startFreeze] = useTransition();
  const st = m.effective_status;

  return (
    <div className="bg-white/5 border border-line rounded-xl p-4">
      <div className="flex items-center gap-4">
        <div
          className="w-2 h-12 rounded-full shrink-0"
          style={{ background: m.plan_color }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{m.plan_name}</p>
          <p className="text-fg/40 text-xs">
            {m.start_date} → {m.end_date}
            {st === "active" && m.days_until_expiry <= 14 && (
              <span
                className={`ml-2 ${m.days_until_expiry <= 5 ? "text-red-400" : "text-amber-400"}`}
              >
                {m.days_until_expiry}d restantes
              </span>
            )}
          </p>
          {st === "cancelled" && m.cancellation_reason && (
            <p className="text-fg/30 text-xs mt-0.5">Motivo: {m.cancellation_reason}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${STATUS_STYLE[st] ?? "bg-white/10 text-fg/40"}`}
          >
            {STATUS_LABEL[st] ?? st}
          </span>
          <p className="text-sm font-semibold mt-1">{fmtMoney(m.paid_amount)}</p>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-1.5 justify-end mt-3 pt-3 border-t border-line/50">
        <button
          onClick={onEdit}
          className={`${btnBase} text-fg/50 hover:text-fg border-line hover:border-fg/40`}
        >
          Editar
        </button>
        <button
          onClick={onRenew}
          className={`${btnBase} text-accent hover:text-accent/70 border-accent/40 hover:border-accent`}
        >
          Renovar
        </button>
        {st === "active" && (
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
            className={`${btnBase} text-blue-400 hover:text-blue-300 border-blue-400/40 hover:border-blue-400`}
            title="Pausar la membresía (se reanuda extendiendo la fecha de fin)"
          >
            {freezePending ? "..." : "Congelar"}
          </button>
        )}
        {st === "frozen" && (
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
            className={`${btnBase} text-emerald-400 hover:text-emerald-300 border-emerald-400/40 hover:border-emerald-400`}
          >
            {freezePending ? "..." : "Reanudar"}
          </button>
        )}
        {st === "active" && (
          <button
            onClick={onCancel}
            className={`${btnBase} text-fg/30 hover:text-red-400 border-line hover:border-red-400/40`}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

export default function MemberMembershipsPanel({
  member,
  memberships,
  plans,
}: {
  member: MemberBasic;
  memberships: Membership[];
  plans: Plan[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Membership | null>(null);
  const [cancelling, setCancelling] = useState<Membership | null>(null);
  const [renewing, setRenewing] = useState<Membership | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Agregar membresía
        </button>
      </div>

      {memberships.length === 0 ? (
        <div className="bg-white/5 border border-line rounded-xl px-5 py-12 text-center text-fg/30 text-sm">
          Sin membresías registradas
        </div>
      ) : (
        memberships.map((m) => (
          <MembershipCard
            key={m.id}
            m={m}
            onEdit={() => setEditing(m)}
            onRenew={() => setRenewing(m)}
            onCancel={() => setCancelling(m)}
          />
        ))
      )}

      {editing && (
        <EditMembershipModal membership={editing} onClose={() => setEditing(null)} />
      )}
      {cancelling && (
        <CancelMembershipModal membership={cancelling} onClose={() => setCancelling(null)} />
      )}
      {renewing && (
        <RenewMembershipModal
          membership={renewing}
          plans={plans}
          onClose={() => setRenewing(null)}
        />
      )}

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
              members={[member]}
              plans={plans}
              defaultMemberId={member.id}
              onClose={() => setShowForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
