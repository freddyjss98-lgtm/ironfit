"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addDays } from "@ironfit/shared/date";
import {
  createChallenge,
  deleteChallenge,
  dismissReports,
  setPostHidden,
  type ChallengeInput,
} from "./actions";

export type ChallengeRow = {
  id: string;
  title: string;
  description: string | null;
  sport: string;
  goalType: "distance" | "time" | "free";
  goalDistanceM: number | null;
  goalSeconds: number | null;
  startsOn: string;
  endsOn: string;
  completed: number;
};

export type PostRow = {
  id: string;
  createdAt: string;
  author: string;
  caption: string | null;
  photoUrl: string | null;
  challengeTitle: string | null;
  sport: string | null;
  distanceM: number | null;
  durationSeconds: number | null;
  hidden: boolean;
  reports: number;
  reportReasons: string[];
};

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelMini = "text-fg/50 text-xs uppercase tracking-wider";
const btnPrimary =
  "px-5 py-2.5 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50";
const btnGhost =
  "px-3 py-1.5 text-xs text-fg/60 hover:text-fg border border-line rounded-lg transition-colors disabled:opacity-50";

const SPORTS: { value: string; label: string }[] = [
  { value: "any", label: "Cualquier deporte" },
  { value: "run", label: "🏃 Correr" },
  { value: "bike", label: "🚴 Bici" },
  { value: "swim", label: "🏊 Natación" },
  { value: "hike", label: "⛰️ Montaña" },
  { value: "walk", label: "🚶 Caminar" },
  { value: "other", label: "💪 Otro" },
];
const sportLabel = (s: string | null) => SPORTS.find((x) => x.value === s)?.label ?? "Actividad";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtDay = (ymd: string) => `${Number(ymd.slice(8, 10))} ${MONTHS[Number(ymd.slice(5, 7)) - 1]}`;
const fmtRange = (a: string, b: string) => (a === b ? fmtDay(a) : `${fmtDay(a)} – ${fmtDay(b)}`);

function fmtGoal(c: Pick<ChallengeRow, "goalType" | "goalDistanceM" | "goalSeconds">): string {
  if (c.goalType === "distance") return `${(c.goalDistanceM ?? 0) / 1000} km`;
  if (c.goalType === "time") {
    const min = Math.round((c.goalSeconds ?? 0) / 60);
    return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ""}`.trim() : `${min} min`;
  }
  return "Meta libre";
}

/** Próximo fin de semana (o el actual si hoy es sábado o domingo). */
function weekend(today: string): [string, string] {
  const dow = new Date(today + "T12:00:00Z").getUTCDay(); // 0 = domingo
  if (dow === 0) return [today, today];
  const sat = addDays(today, 6 - dow);
  return [sat, addDays(sat, 1)];
}

function ChallengeForm({ today }: { today: string }) {
  const [sat, sun] = weekend(today);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sport, setSport] = useState("run");
  const [goalType, setGoalType] = useState<ChallengeInput["goalType"]>("distance");
  const [goalValue, setGoalValue] = useState("");
  const [startsOn, setStartsOn] = useState(sat);
  const [endsOn, setEndsOn] = useState(sun);
  const [notify, setNotify] = useState(true);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = goalValue.trim() === "" ? null : Number(goalValue.replace(",", "."));
    start(async () => {
      const res = await createChallenge({
        title,
        description,
        sport,
        goalType,
        goalValue: value,
        startsOn,
        endsOn,
        notify,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(notify ? "Reto publicado y avisado a los socios" : "Reto publicado");
      setTitle("");
      setDescription("");
      setGoalValue("");
    });
  }

  return (
    <form onSubmit={submit} className="bg-white/5 border border-line rounded-xl p-4 sm:p-5 flex flex-col gap-4">
      <div>
        <h3 className="font-display text-base uppercase tracking-tight">Nuevo reto</h3>
        <p className="text-fg/40 text-xs mt-0.5">
          Los socios lo ven en la pestaña Comunidad de la app. Si registran una actividad que cumple la
          meta, el reto se marca solo.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelMini} htmlFor="r-title">Título</label>
        <input id="r-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Corre 5K este fin de semana" maxLength={80} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelMini} htmlFor="r-desc">Descripción (opcional)</label>
        <textarea id="r-desc" className={`${inputCls} min-h-20`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Sube tu foto en la meta. ¡El que lo cumpla gana un batido!" maxLength={600} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelMini} htmlFor="r-sport">Deporte</label>
          <select id="r-sport" className={inputCls} value={sport} onChange={(e) => setSport(e.target.value)}>
            {SPORTS.map((s) => (
              <option key={s.value} value={s.value} className="bg-[#111]">{s.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelMini} htmlFor="r-goal">Meta</label>
          <select id="r-goal" className={inputCls} value={goalType} onChange={(e) => setGoalType(e.target.value as ChallengeInput["goalType"])}>
            <option value="distance" className="bg-[#111]">Distancia (km)</option>
            <option value="time" className="bg-[#111]">Tiempo (minutos)</option>
            <option value="free" className="bg-[#111]">Libre (solo cumplirlo)</option>
          </select>
        </div>
        {goalType !== "free" && (
          <div className="flex flex-col gap-1.5">
            <label className={labelMini} htmlFor="r-value">{goalType === "distance" ? "Kilómetros" : "Minutos"}</label>
            <input id="r-value" className={inputCls} inputMode="decimal" value={goalValue} onChange={(e) => setGoalValue(e.target.value)} placeholder={goalType === "distance" ? "5" : "30"} />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={labelMini} htmlFor="r-start">Desde</label>
          <input id="r-start" type="date" className={inputCls} value={startsOn} min={today} onChange={(e) => setStartsOn(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelMini} htmlFor="r-end">Hasta</label>
          <input id="r-end" type="date" className={inputCls} value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-fg/70">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-accent" />
        Avisar a los socios activos con una notificación
      </label>

      <button type="submit" disabled={pending} className={`${btnPrimary} self-start`}>
        {pending ? "Publicando…" : "Publicar reto"}
      </button>
    </form>
  );
}

function ChallengeList({ challenges, today }: { challenges: ChallengeRow[]; today: string }) {
  const [pending, start] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function remove(id: string) {
    start(async () => {
      const res = await deleteChallenge(id);
      if (!res.ok) toast.error(res.error);
      else toast.success("Reto eliminado");
      setConfirmId(null);
    });
  }

  if (challenges.length === 0) return <p className="text-fg/30 text-sm">Todavía no hay retos.</p>;

  return (
    <ul className="divide-y divide-line/40 border border-line rounded-xl overflow-hidden">
      {challenges.map((c) => {
        const status = today < c.startsOn ? "Próximo" : today > c.endsOn ? "Terminado" : "En curso";
        return (
          <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">{c.title}</p>
              <p className="text-fg/40 text-xs">
                <span className={status === "En curso" ? "text-accent" : ""}>{status}</span> · {fmtRange(c.startsOn, c.endsOn)} ·{" "}
                {sportLabel(c.sport)} · {fmtGoal(c)}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-fg/60 text-xs">
                <span className="font-display text-base text-fg">{c.completed}</span> cumplieron
              </span>
              {confirmId === c.id ? (
                <>
                  <button className={btnGhost} onClick={() => setConfirmId(null)} disabled={pending}>No</button>
                  <button className={`${btnGhost} text-red-400 border-red-500/40`} onClick={() => remove(c.id)} disabled={pending}>
                    Borrar
                  </button>
                </>
              ) : (
                <button
                  className="text-fg/30 hover:text-red-400 text-lg leading-none px-1 transition-colors"
                  onClick={() => setConfirmId(c.id)}
                  aria-label={`Eliminar ${c.title}`}
                >
                  ×
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PostItem({ post }: { post: PostRow }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Error");
      else toast.success(msg);
    });

  const stats = [
    post.distanceM ? `${(post.distanceM / 1000).toFixed(1)} km` : null,
    post.durationSeconds ? `${Math.round(post.durationSeconds / 60)} min` : null,
  ].filter(Boolean);

  return (
    <li className={`bg-white/[0.03] border rounded-xl overflow-hidden flex flex-col ${post.reports && !post.hidden ? "border-red-500/50" : "border-line"} ${post.hidden ? "opacity-50" : ""}`}>
      {post.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.photoUrl} alt={`Foto de ${post.author}`} className="w-full aspect-[4/5] object-cover bg-black" />
      ) : null}
      <div className="p-3 flex flex-col gap-1.5 text-sm flex-1">
        <p className="font-medium">{post.author}</p>
        <p className="text-accent text-xs">
          {post.challengeTitle ? `🏆 ${post.challengeTitle}` : sportLabel(post.sport)}
          {stats.length ? ` · ${stats.join(" · ")}` : ""}
        </p>
        {post.caption && <p className="text-fg/70 text-xs">{post.caption}</p>}
        <p className="text-fg/30 text-[11px]">
          {new Date(post.createdAt).toLocaleString("es-EC", { timeZone: "America/Guayaquil", dateStyle: "medium", timeStyle: "short" })}
          {post.hidden ? " · Oculta" : ""}
        </p>
        {post.reports > 0 && !post.hidden && (
          <p className="text-red-400 text-xs">
            ⚠ {post.reports} {post.reports === 1 ? "reporte" : "reportes"}
            {post.reportReasons.length ? `: ${[...new Set(post.reportReasons)].join(", ")}` : ""}
          </p>
        )}
        <div className="flex gap-2 mt-auto pt-2">
          {post.hidden ? (
            <button className={btnGhost} disabled={pending} onClick={() => run(() => setPostHidden(post.id, false), "Publicación visible otra vez")}>
              Mostrar
            </button>
          ) : (
            <button className={`${btnGhost} text-red-400 border-red-500/40`} disabled={pending} onClick={() => run(() => setPostHidden(post.id, true), "Publicación oculta")}>
              Ocultar
            </button>
          )}
          {post.reports > 0 && !post.hidden && (
            <button className={btnGhost} disabled={pending} onClick={() => run(() => dismissReports(post.id), "Reporte descartado")}>
              Está bien
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function RetosClient({
  challenges,
  posts,
  today,
}: {
  challenges: ChallengeRow[];
  posts: PostRow[];
  today: string;
}) {
  const reported = useMemo(() => posts.filter((p) => p.reports > 0 && !p.hidden), [posts]);
  const recent = useMemo(() => posts.filter((p) => !(p.reports > 0 && !p.hidden)), [posts]);

  return (
    <div className="space-y-8">
      {reported.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-base uppercase tracking-tight text-red-400">
            Reportadas · revisar en menos de 24 h
          </h3>
          <ul className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {reported.map((p) => (
              <PostItem key={p.id} post={p} />
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <ChallengeForm today={today} />
        <section className="space-y-3">
          <h3 className="font-display text-base uppercase tracking-tight">Retos</h3>
          <ChallengeList challenges={challenges} today={today} />
        </section>
      </div>

      <section className="space-y-3">
        <h3 className="font-display text-base uppercase tracking-tight">Lo último en la comunidad</h3>
        {recent.length === 0 ? (
          <p className="text-fg/30 text-sm">Todavía no hay publicaciones.</p>
        ) : (
          <ul className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {recent.map((p) => (
              <PostItem key={p.id} post={p} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
