"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addDays } from "@ironfit/shared/date";
import {
  createClosures,
  deleteClosure,
  previewClosures,
  type ClosurePreview,
} from "./actions";

export type ClosureRow = {
  id: string;
  date: string;
  reason: string;
  /** Socios a los que se les sumó el día. */
  members: number;
};

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelMini = "text-fg/50 text-xs uppercase tracking-wider";

const WEEK_HEADER = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// ── Fechas 'YYYY-MM-DD' (siempre en UTC para que servidor y navegador coincidan) ──

function weekday(date: string): number {
  return new Date(date + "T12:00:00Z").getUTCDay(); // 0 = domingo
}

function fmtLong(date: string): string {
  const s = new Date(date + "T12:00:00Z").toLocaleDateString("es-EC", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtShort(date: string): string {
  return new Date(date + "T12:00:00Z").toLocaleDateString("es-EC", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

// ── Calendario: el admin toca los días que no abre ───────────────────────────

function Calendar({
  month,
  setMonth,
  selected,
  closed,
  minDate,
  maxDate,
  today,
  onToggle,
}: {
  month: string; // 'YYYY-MM'
  setMonth: (m: string) => void;
  selected: Set<string>;
  closed: Map<string, string>;
  minDate: string;
  maxDate: string;
  today: string;
  onToggle: (date: string) => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (weekday(first) + 6) % 7; // lunes = 0
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];

  const prevMonth = addDays(first, -1).slice(0, 7);
  const nextMonth = addDays(`${month}-${String(daysInMonth).padStart(2, "0")}`, 1).slice(0, 7);
  const canPrev = prevMonth >= minDate.slice(0, 7);
  const canNext = nextMonth <= maxDate.slice(0, 7);

  return (
    <div className="bg-white/[0.03] border border-line rounded-xl p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setMonth(prevMonth)}
          disabled={!canPrev}
          aria-label="Mes anterior"
          className="w-9 h-9 rounded-lg text-fg/60 hover:text-fg hover:bg-white/5 disabled:opacity-20 transition-colors"
        >
          ‹
        </button>
        <p className="text-sm font-semibold capitalize">
          {MONTHS[m - 1]} {y}
        </p>
        <button
          type="button"
          onClick={() => setMonth(nextMonth)}
          disabled={!canNext}
          aria-label="Mes siguiente"
          className="w-9 h-9 rounded-lg text-fg/60 hover:text-fg hover:bg-white/5 disabled:opacity-20 transition-colors"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEK_HEADER.map((d) => (
          <span key={d} className={`text-[10px] uppercase tracking-wider py-1 ${d === "Dom" ? "text-fg/20" : "text-fg/40"}`}>
            {d}
          </span>
        ))}

        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} />;
          const isSunday = weekday(date) === 0;
          const closedReason = closed.get(date);
          const outOfRange = date < minDate || date > maxDate;
          const isSelected = selected.has(date);
          const disabled = isSunday || !!closedReason || outOfRange;
          const title = isSunday
            ? "Domingo: el gimnasio no abre, no se compensa"
            : closedReason
              ? `Ya registrado: ${closedReason}`
              : outOfRange
                ? "Fuera del rango permitido"
                : undefined;

          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              title={title}
              onClick={() => onToggle(date)}
              className={`h-10 rounded-lg text-sm transition-colors ${
                isSelected
                  ? "bg-accent text-white font-semibold"
                  : closedReason
                    ? "bg-red-500/15 text-red-300 line-through"
                    : isSunday
                      ? "text-fg/15"
                      : outOfRange
                        ? "text-fg/20"
                        : "text-fg/80 hover:bg-white/10"
              } ${date === today && !isSelected ? "ring-1 ring-accent/60" : ""} disabled:cursor-not-allowed`}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-fg/40">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-accent" /> Elegido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/40" /> Ya registrado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-white/10" /> Domingo (no cuenta)
        </span>
      </div>
    </div>
  );
}

// ── Formulario: elegir días + motivo ─────────────────────────────────────────

function NewClosureCard({ closures, today }: { closures: ClosureRow[]; today: string }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<{ key: string; data: ClosurePreview[] }>({
    key: "",
    data: [],
  });
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const closed = useMemo(() => new Map(closures.map((c) => [c.date, c.reason])), [closures]);
  const minDate = addDays(today, -30);
  const maxDate = addDays(today, 366);
  const dates = useMemo(() => [...selected].sort(), [selected]);
  const datesKey = dates.join(",");
  const loadingPreview = datesKey !== "" && preview.key !== datesKey;

  // Vista previa con debounce: cuántos socios recuperan el día y cuántas
  // reservas se cancelan.
  useEffect(() => {
    if (!datesKey) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await previewClosures(datesKey.split(","));
      if (cancelled) return;
      if (!res.ok) toast.error(res.error);
      setPreview({ key: datesKey, data: res.ok ? res.data : [] });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [datesKey]);

  function toggle(date: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function openConfirm() {
    if (dates.length === 0) {
      toast.error("Elige en el calendario el día o los días que no abre");
      return;
    }
    if (!reason.trim()) {
      toast.error("Escribe el motivo del cierre");
      return;
    }
    setConfirming(true);
  }

  function handleConfirm() {
    startTransition(async () => {
      const res = await createClosures(dates, reason.trim());
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const lines = res.data.map(
        (d) =>
          `${fmtShort(d.date)}: ${plural(d.members, "socio", "socios")} +1 día` +
          (d.bookings_cancelled > 0
            ? ` · ${plural(d.bookings_cancelled, "reserva cancelada", "reservas canceladas")}`
            : "")
      );
      toast.success(
        res.data.length === 1 ? "Cierre registrado" : `${res.data.length} días de cierre registrados`,
        {
          description: (
            <div>
              {lines.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
          ),
        }
      );
      setConfirming(false);
      setSelected(new Set());
      setReason("");
    });
  }

  const previewByDate = new Map(
    loadingPreview ? [] : preview.data.map((p) => [p.date, p] as const)
  );

  return (
    <div className="bg-white/5 border border-line rounded-xl p-4 sm:p-5">
      <h3 className="font-display text-base uppercase tracking-tight">Registrar cierre</h3>
      <p className="text-fg/40 text-xs mt-0.5">
        Toca en el calendario el día o los días que el gimnasio no va a abrir.
      </p>

      <div className="grid gap-5 mt-4 lg:grid-cols-2">
        <Calendar
          month={month}
          setMonth={setMonth}
          selected={selected}
          closed={closed}
          minDate={minDate}
          maxDate={maxDate}
          today={today}
          onToggle={toggle}
        />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="closure-reason" className={labelMini}>
              Motivo
            </label>
            <input
              id="closure-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={120}
              placeholder="Ej. Feriado de la Independencia de Guayaquil"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelMini}>Días elegidos</span>
            {dates.length === 0 ? (
              <p className="text-fg/30 text-sm">Todavía no eliges ningún día.</p>
            ) : (
              <ul className="divide-y divide-line/40 border border-line rounded-lg overflow-hidden">
                {dates.map((d) => {
                  const p = previewByDate.get(d);
                  return (
                    <li key={d} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{fmtLong(d)}</p>
                        <p className="text-fg/40 text-xs">
                          {loadingPreview
                            ? "Calculando..."
                            : p
                              ? `${plural(p.members, "socio recupera", "socios recuperan")} 1 día` +
                                (p.bookings > 0
                                  ? ` · se cancelan ${plural(p.bookings, "reserva", "reservas")}`
                                  : "")
                              : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggle(d)}
                        aria-label={`Quitar ${fmtLong(d)}`}
                        className="text-fg/30 hover:text-red-400 text-lg leading-none px-1 transition-colors"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={openConfirm}
            disabled={pending}
            className="mt-auto px-5 py-2.5 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {dates.length > 1 ? `Registrar ${dates.length} días de cierre` : "Registrar cierre"}
          </button>
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-line rounded-2xl w-full max-w-md p-6 flex flex-col gap-4">
            <div>
              <h2 className="font-display text-lg uppercase tracking-tight">Confirmar cierre</h2>
              <p className="text-fg/50 text-sm mt-1">{reason.trim()}</p>
            </div>

            <ul className="flex flex-col gap-2 text-sm">
              {dates.map((d) => {
                const p = previewByDate.get(d);
                return (
                  <li key={d} className="bg-white/5 border border-line rounded-lg px-3 py-2">
                    <p className="font-medium">{fmtLong(d)}</p>
                    {p && (
                      <p className="text-fg/50 text-xs mt-0.5">
                        {plural(p.members, "socio recupera", "socios recuperan")} 1 día
                        {p.bookings > 0 &&
                          ` · se cancelan ${plural(p.bookings, "reserva", "reservas")}`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="text-fg/40 text-xs">
              A cada socio con membresía activa ese día se le suma 1 día al vencimiento, y lo verá
              enseguida en el portal. Si alguien compra o congela su membresía antes de esa fecha, el
              sistema lo ajusta solo ese día.
            </p>

            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {pending ? "Registrando..." : "Sí, registrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lista de cierres ─────────────────────────────────────────────────────────

function ClosureItem({ c, today, onDelete }: { c: ClosureRow; today: string; onDelete: () => void }) {
  const badge =
    c.date > today
      ? { label: "Próximo", cls: "bg-blue-500/15 text-blue-400" }
      : c.date === today
        ? { label: "Hoy", cls: "bg-accent/20 text-accent" }
        : { label: "Pasado", cls: "bg-white/10 text-fg/50" };

  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">
          {fmtLong(c.date)}
          <span className="text-fg/40 font-normal"> · {c.date.slice(0, 4)}</span>
        </p>
        <p className="text-fg/40 text-xs truncate">
          {c.reason} · {plural(c.members, "socio", "socios")} +1 día
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${badge.cls}`}>{badge.label}</span>
        <button
          onClick={onDelete}
          className="text-xs text-fg/30 hover:text-red-400 border border-line hover:border-red-400/40 px-2.5 py-1 rounded-lg transition-colors"
        >
          Borrar
        </button>
      </div>
    </div>
  );
}

function DeleteClosureModal({ closure, onClose }: { closure: ClosureRow; onClose: () => void }) {
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const res = await deleteClosure(closure.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data > 0
          ? `Cierre borrado: a ${plural(res.data, "socio", "socios")} se les quitó el día`
          : "Cierre borrado"
      );
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111] border border-line rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div>
          <h2 className="font-display text-lg uppercase tracking-tight text-red-400">Borrar cierre</h2>
          <p className="text-fg/50 text-sm mt-1">
            <span className="text-fg font-semibold">{fmtLong(closure.date)}</span> · {closure.reason}
          </p>
        </div>

        <p className="text-fg/60 text-sm">
          {closure.members > 0
            ? `A ${plural(closure.members, "socio", "socios")} se les quitará el día que se les sumó.`
            : "Ningún socio recibió este día."}{" "}
          Úsalo si al final el gimnasio sí abre o si el día se registró por error.
        </p>
        <p className="text-fg/40 text-xs">
          Las reservas de clase que se cancelaron por este cierre no se restauran.
        </p>

        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors"
          >
            No borrar
          </button>
          <button
            onClick={handleConfirm}
            disabled={pending}
            className="px-5 py-2 text-sm font-semibold bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {pending ? "Borrando..." : "Sí, borrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function FeriadosClient({ closures, today }: { closures: ClosureRow[]; today: string }) {
  const [deleting, setDeleting] = useState<ClosureRow | null>(null);

  const upcoming = closures.filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = closures.filter((c) => c.date < today);

  return (
    <div className="space-y-6">
      <NewClosureCard closures={closures} today={today} />

      <div className="space-y-3">
        <h3 className="font-display text-base uppercase tracking-tight text-fg/80">
          Próximos cierres ({upcoming.length})
        </h3>
        {upcoming.length === 0 ? (
          <div className="bg-white/5 border border-line rounded-xl px-5 py-10 text-center text-fg/40 text-sm">
            No hay cierres programados
          </div>
        ) : (
          <div className="bg-white/5 border border-line rounded-xl overflow-hidden divide-y divide-line/40">
            {upcoming.map((c) => (
              <ClosureItem key={c.id} c={c} today={today} onDelete={() => setDeleting(c)} />
            ))}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display text-base uppercase tracking-tight text-fg/80">
            Historial ({past.length})
          </h3>
          <div className="bg-white/5 border border-line rounded-xl overflow-hidden divide-y divide-line/40">
            {past.map((c) => (
              <ClosureItem key={c.id} c={c} today={today} onDelete={() => setDeleting(c)} />
            ))}
          </div>
        </div>
      )}

      {deleting && <DeleteClosureModal closure={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
