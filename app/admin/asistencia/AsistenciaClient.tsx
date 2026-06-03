"use client";

import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { checkInMember, deleteAttendance } from "./actions";

type Member = {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  membership_status: string | null;
  current_end_date: string | null;
};

type Attendance = {
  id: string;
  member_id: string;
  full_name: string;
  phone: string;
  checked_in_at: string;
  minutes_since_checkin: number;
};

type Props = {
  members: Member[];
  todayAttendances: Attendance[];
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AsistenciaClient({ members, todayAttendances }: Props) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search on mount + Cmd/Ctrl+K
  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const checkedInToday = new Set(todayAttendances.map((a) => a.member_id));

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    return members
      .filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) || m.phone.includes(q)
      )
      .slice(0, 8);
  }, [query, members]);

  function handleCheckIn(member: Member) {
    if (checkedInToday.has(member.id)) {
      toast.warning(`${member.full_name} ya hizo check-in hoy`);
      return;
    }

    startTransition(async () => {
      try {
        const result = await checkInMember(member.id);

        if (!result.membershipActive) {
          toast.error(`${member.full_name} — Membresía vencida`, {
            description: result.membershipEnd
              ? `Venció el ${result.membershipEnd}. Renovar antes de entrar.`
              : "Sin membresía activa.",
            duration: 6000,
          });
        } else {
          toast.success(`${member.full_name} entró`, {
            description: `Plan ${result.planName} · vence ${result.membershipEnd}`,
          });
        }

        setQuery("");
        inputRef.current?.focus();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al hacer check-in");
      }
    });
  }

  function handleDelete(att: Attendance) {
    if (!confirm(`¿Eliminar el check-in de ${att.full_name}?`)) return;
    startTransition(async () => {
      try {
        await deleteAttendance(att.id);
        toast.success("Check-in eliminado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* COLUMNA IZQUIERDA: Búsqueda y check-in */}
      <div className="space-y-4">
        <div>
          <h3 className="text-fg/50 text-xs uppercase tracking-widest mb-2">
            Buscar atleta
          </h3>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre o teléfono..."
              className="w-full bg-white/5 border border-line text-fg text-lg rounded-xl px-4 py-3 outline-none focus:border-accent transition-colors placeholder:text-fg/30"
            />
            <kbd className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 text-fg/30 text-xs border border-line rounded px-1.5 py-0.5">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <div className="bg-white/5 border border-line rounded-xl overflow-hidden">
            {results.map((m) => {
              const alreadyIn = checkedInToday.has(m.id);
              const membershipOK = m.membership_status === "active";

              return (
                <button
                  key={m.id}
                  onClick={() => handleCheckIn(m)}
                  disabled={pending || alreadyIn}
                  className={`w-full text-left px-4 py-3 border-b border-line/50 last:border-0 transition-colors flex items-center justify-between gap-3 ${
                    alreadyIn
                      ? "bg-emerald-500/5 cursor-default"
                      : "hover:bg-accent/5 cursor-pointer"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{m.full_name}</p>
                    <p className="text-fg/40 text-xs">{m.phone}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!membershipOK && !alreadyIn && (
                      <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded">
                        Vencida
                      </span>
                    )}
                    {alreadyIn ? (
                      <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-semibold">
                        ✓ Ya entró
                      </span>
                    ) : (
                      <span className="text-xs bg-accent/15 text-accent px-2 py-0.5 rounded font-semibold">
                        Check-in →
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {query.trim().length >= 2 && results.length === 0 && (
          <div className="bg-white/5 border border-line rounded-xl px-4 py-6 text-center text-fg/40 text-sm">
            Sin resultados para "{query}"
          </div>
        )}

        {/* Stats del día */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          <div className="bg-white/5 border border-line rounded-xl p-4">
            <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">
              Hoy
            </p>
            <p className="font-display text-3xl text-accent">
              {todayAttendances.length}
            </p>
            <p className="text-fg/40 text-xs">check-ins</p>
          </div>
          <div className="bg-white/5 border border-line rounded-xl p-4">
            <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">
              En el gym
            </p>
            <p className="font-display text-3xl">
              {todayAttendances.filter((a) => a.minutes_since_checkin < 90).length}
            </p>
            <p className="text-fg/40 text-xs">últimos 90 min</p>
          </div>
        </div>
      </div>

      {/* COLUMNA DERECHA: Asistencias de hoy */}
      <div>
        <h3 className="text-fg/50 text-xs uppercase tracking-widest mb-2">
          Check-ins de hoy
        </h3>
        {todayAttendances.length === 0 ? (
          <div className="bg-white/5 border border-line rounded-xl px-4 py-12 text-center text-fg/30 text-sm">
            Aún no hay check-ins hoy
          </div>
        ) : (
          <div className="bg-white/5 border border-line rounded-xl overflow-hidden max-h-[600px] overflow-y-auto">
            {todayAttendances.map((a) => {
              const recent = a.minutes_since_checkin < 90;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line/50 last:border-0 hover:bg-white/5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{a.full_name}</p>
                    <p className="text-fg/40 text-xs">
                      {fmtTime(a.checked_in_at)} ·{" "}
                      <span className={recent ? "text-emerald-400" : "text-fg/40"}>
                        {Math.round(a.minutes_since_checkin)} min
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(a)}
                    className="text-fg/30 hover:text-red-400 text-xs px-2 py-1"
                    title="Eliminar check-in"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
