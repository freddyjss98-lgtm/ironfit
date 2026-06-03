import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import { getPortalMember } from "@/lib/portal/get-member";
import PreviewBanner from "../_components/PreviewBanner";

type Progress = {
  id: string;
  measured_at: string;
  weight: number | null;
  body_fat: number | null;
  muscle_mass: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  arm_cm: number | null;
  leg_cm: number | null;
  notes: string | null;
  photo_url: string | null;
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function WeightChart({ data }: { data: Progress[] }) {
  const points = data.filter((d) => d.weight !== null).slice(0, 12).reverse();
  if (points.length < 2) return null;

  const weights = points.map((d) => d.weight!);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const w = 300;
  const h = 80;

  const pts = weights
    .map((v, i) => {
      const x = (i / (weights.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
        <polyline points={pts} fill="none" stroke="#e84b1f" strokeWidth="2.5" strokeLinejoin="round" />
        {weights.map((v, i) => {
          const x = (i / (weights.length - 1)) * w;
          const y = h - ((v - min) / range) * (h - 8) - 4;
          return <circle key={i} cx={x} cy={y} r="3" fill="#e84b1f" />;
        })}
      </svg>
      <div className="flex justify-between text-xs text-fg/30 mt-1">
        <span>{points[0]?.measured_at}</span>
        <span>{points[points.length - 1]?.measured_at}</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-fg/40 text-xs uppercase tracking-wider mb-0.5">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  );
}

export default async function PortalProgresoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { member, isPreview } = await getPortalMember(supabase, user.id);
  if (!member) redirect("/portal");

  const { data: progress } = await supabase
    .from("member_progress")
    .select("id, measured_at, weight, body_fat, muscle_mass, chest_cm, waist_cm, hips_cm, arm_cm, leg_cm, notes, photo_url")
    .eq("member_id", member.id)
    .order("measured_at", { ascending: false });

  const all = progress ?? [];
  const withWeight = all.filter((p) => p.weight !== null).slice(0, 12).reverse();
  const firstWeight = withWeight[0]?.weight ?? null;
  const lastWeight = withWeight[withWeight.length - 1]?.weight ?? null;
  const delta = firstWeight && lastWeight ? lastWeight - firstWeight : null;

  return (
    <div className="space-y-6">
      {isPreview && <PreviewBanner memberName={member.full_name} />}
      <div>
        <h1 className="font-display text-2xl uppercase tracking-tight">
          Mi Progreso
        </h1>
        <p className="text-fg/40 text-sm mt-0.5">
          Seguimiento de tus medidas y evolución
        </p>
      </div>

      {/* Weight summary card */}
      {withWeight.length > 0 && (
        <div className="bg-white/5 border border-line rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">
                Evolución de peso
              </p>
              <p className="font-display text-3xl">
                {lastWeight?.toFixed(1)} kg
              </p>
              {delta !== null && (
                <p
                  className={`text-sm font-semibold mt-1 ${
                    delta < 0
                      ? "text-emerald-400"
                      : delta > 0
                        ? "text-amber-400"
                        : "text-fg/40"
                  }`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)} kg desde el inicio
                </p>
              )}
            </div>
            {member.height_cm && lastWeight && (
              <div className="text-right">
                <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">IMC</p>
                <p className="font-display text-2xl">
                  {(lastWeight / Math.pow(member.height_cm / 100, 2)).toFixed(1)}
                </p>
              </div>
            )}
          </div>
          <WeightChart data={all} />
        </div>
      )}

      {/* Progress history */}
      {all.length === 0 ? (
        <div className="bg-white/5 border border-line rounded-2xl px-5 py-16 text-center">
          <p className="text-fg/30 text-sm">
            No hay mediciones registradas aún.
          </p>
          <p className="text-fg/20 text-xs mt-2">
            El equipo Iron Fit registrará tu progreso en cada medición.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-fg/40 text-xs uppercase tracking-widest">
            {all.length} medición{all.length !== 1 ? "es" : ""}
          </h2>
          {all.map((p) => (
            <div
              key={p.id}
              className="bg-white/5 border border-line rounded-xl p-4"
            >
              <p className="font-semibold text-sm mb-3">{fmtDate(p.measured_at)}</p>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {p.weight && <Metric label="Peso" value={`${p.weight} kg`} />}
                {p.body_fat && <Metric label="% Grasa" value={`${p.body_fat}%`} />}
                {p.muscle_mass && <Metric label="Músculo" value={`${p.muscle_mass} kg`} />}
                {p.chest_cm && <Metric label="Pecho" value={`${p.chest_cm} cm`} />}
                {p.waist_cm && <Metric label="Cintura" value={`${p.waist_cm} cm`} />}
                {p.hips_cm && <Metric label="Cadera" value={`${p.hips_cm} cm`} />}
                {p.arm_cm && <Metric label="Brazo" value={`${p.arm_cm} cm`} />}
                {p.leg_cm && <Metric label="Pierna" value={`${p.leg_cm} cm`} />}
              </div>

              {p.notes && (
                <p className="text-fg/50 text-sm mt-3 italic border-t border-line/40 pt-3">
                  {p.notes}
                </p>
              )}

              {p.photo_url && (
                <div className="mt-3">
                  <Image
                    src={p.photo_url}
                    alt={`Foto ${p.measured_at}`}
                    width={300}
                    height={300}
                    className="rounded-lg object-cover max-h-72 w-auto"
                                     />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
