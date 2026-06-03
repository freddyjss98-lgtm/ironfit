"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCoach, updateCoach, toggleCoachActive, deleteCoach } from "./actions";

type Coach = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  specialty: string | null;
  active: boolean;
  class_count: number;
  class_names: string[];
};

type Props = { coaches: Coach[] };

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelCls = "text-fg/50 text-xs uppercase tracking-wider";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Deterministic accent color per coach based on name
const AVATAR_COLORS = [
  "bg-red-500/20 text-red-300",
  "bg-orange-500/20 text-orange-300",
  "bg-amber-500/20 text-amber-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-teal-500/20 text-teal-300",
  "bg-blue-500/20 text-blue-300",
  "bg-violet-500/20 text-violet-300",
  "bg-pink-500/20 text-pink-300",
];
function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function CoachForm({
  coach,
  onClose,
}: {
  coach?: Coach;
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
        if (coach) {
          await updateCoach(coach.id, fd);
          toast.success("Coach actualizado");
        } else {
          await createCoach(fd);
          toast.success("Coach agregado");
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
          <label className={labelCls}>Nombre completo *</label>
          <input
            name="full_name"
            required
            defaultValue={coach?.full_name}
            className={inputCls}
            placeholder="Ej. Marco Torres"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Teléfono</label>
          <input
            name="phone"
            defaultValue={coach?.phone ?? ""}
            className={inputCls}
            placeholder="0999 000 000"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Email</label>
          <input
            name="email"
            type="email"
            defaultValue={coach?.email ?? ""}
            className={inputCls}
            placeholder="coach@ironfit.com"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Especialidad</label>
          <input
            name="specialty"
            defaultValue={coach?.specialty ?? ""}
            className={inputCls}
            placeholder="CrossFit, Funcional, Spinning..."
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
          {pending ? "Guardando..." : coach ? "Actualizar" : "Agregar coach"}
        </button>
      </div>
    </form>
  );
}

function CoachCard({
  coach,
  onEdit,
}: {
  coach: Coach;
  onEdit: () => void;
}) {
  const [togglePending, startToggle] = useTransition();
  const [deletePending, startDelete] = useTransition();

  function handleDelete() {
    if (!confirm(`¿Eliminar a ${coach.full_name}?`)) return;
    startDelete(async () => {
      try {
        await deleteCoach(coach.id);
        toast.success("Coach eliminado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al eliminar");
      }
    });
  }

  function handleToggle() {
    startToggle(async () => {
      try {
        await toggleCoachActive(coach.id, coach.active);
        toast.success(coach.active ? "Coach desactivado" : "Coach activado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  return (
    <div
      className={`bg-white/5 border rounded-xl p-5 flex flex-col gap-4 transition-opacity ${
        coach.active ? "border-line" : "border-line/30 opacity-50"
      }`}
    >
      {/* Top: avatar + name + status */}
      <div className="flex items-start gap-3">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(coach.full_name)}`}
        >
          {initials(coach.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{coach.full_name}</p>
            {!coach.active && (
              <span className="text-xs text-fg/30 border border-line/30 px-1.5 py-0.5 rounded shrink-0">
                Inactivo
              </span>
            )}
          </div>
          {coach.specialty && (
            <p className="text-fg/40 text-xs mt-0.5 truncate">{coach.specialty}</p>
          )}
        </div>
      </div>

      {/* Contact + classes */}
      <div className="space-y-1.5">
        {coach.phone && (
          <div className="flex items-center gap-2 text-xs text-fg/50">
            <span className="text-fg/25">📞</span>
            <span>{coach.phone}</span>
          </div>
        )}
        {coach.email && (
          <div className="flex items-center gap-2 text-xs text-fg/50">
            <span className="text-fg/25">✉</span>
            <span className="truncate">{coach.email}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-fg/25">◌</span>
          {coach.class_count === 0 ? (
            <span className="text-fg/30">Sin clases asignadas</span>
          ) : (
            <span className="text-fg/50">
              {coach.class_count} clase{coach.class_count !== 1 ? "s" : ""}
              {coach.class_names.length > 0 && (
                <span className="text-fg/30 ml-1">
                  ({coach.class_names.slice(0, 2).join(", ")}
                  {coach.class_names.length > 2 ? `…` : ""})
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-line/40">
        <button
          onClick={onEdit}
          className="flex-1 text-xs text-fg/40 hover:text-fg border border-line hover:border-accent/40 py-1.5 rounded-lg transition-colors"
        >
          Editar
        </button>
        <button
          onClick={handleToggle}
          disabled={togglePending}
          className={`text-xs border px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 ${
            coach.active
              ? "border-line text-fg/40 hover:text-amber-400 hover:border-amber-500/30"
              : "border-emerald-500/30 text-emerald-400/60 hover:text-emerald-400"
          }`}
        >
          {togglePending ? "..." : coach.active ? "Desactivar" : "Activar"}
        </button>
        <button
          onClick={handleDelete}
          disabled={deletePending}
          className="text-xs text-red-400/40 hover:text-red-400 border border-line/40 hover:border-red-500/30 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          title="Eliminar coach"
        >
          {deletePending ? "..." : "✕"}
        </button>
      </div>
    </div>
  );
}

export default function CoachesClient({ coaches }: Props) {
  const [modal, setModal] = useState<{ coach?: Coach } | null>(null);

  const active = coaches.filter((c) => c.active);
  const inactive = coaches.filter((c) => !c.active);

  return (
    <>
      {/* Toolbar */}
      <div className="flex justify-end">
        <button
          onClick={() => setModal({})}
          className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Nuevo coach
        </button>
      </div>

      {coaches.length === 0 ? (
        <div className="bg-white/5 border border-line rounded-xl px-6 py-16 text-center">
          <p className="text-fg/30 text-sm">No hay coaches registrados.</p>
          <button
            onClick={() => setModal({})}
            className="mt-3 text-accent text-sm hover:underline"
          >
            Agregar el primero →
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active coaches */}
          {active.length > 0 && (
            <div>
              <p className="text-fg/35 text-xs uppercase tracking-widest mb-3">
                Activos ({active.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {active.map((c) => (
                  <CoachCard key={c.id} coach={c} onEdit={() => setModal({ coach: c })} />
                ))}
              </div>
            </div>
          )}

          {/* Inactive coaches */}
          {inactive.length > 0 && (
            <div>
              <p className="text-fg/35 text-xs uppercase tracking-widest mb-3">
                Inactivos ({inactive.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactive.map((c) => (
                  <CoachCard key={c.id} coach={c} onEdit={() => setModal({ coach: c })} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-line rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg uppercase tracking-tight">
                {modal.coach ? "Editar coach" : "Nuevo coach"}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="text-fg/40 hover:text-fg text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <CoachForm coach={modal.coach} onClose={() => setModal(null)} />
          </div>
        </div>
      )}
    </>
  );
}
