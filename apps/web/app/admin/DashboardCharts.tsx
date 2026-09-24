"use client";

import { useState } from "react";

type DailySale = { date: string; total: number };
type MonthlySale = { month: string; total: number };
type DistribItem = { name: string; color: string; count: number };

type Props = {
  dailySales: DailySale[];
  yearlySales: MonthlySale[];
  membershipDistrib: DistribItem[];
  topItems: { description: string; item_type: string; revenue: number; units: number }[];
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ─── Area chart: ventas últimos 30 días ──────────────────────────────────────
function AreaChart({ data }: { data: DailySale[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const W = 600, H = 180;
  const padL = 52, padR = 12, padT = 14, padB = 32;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-fg/30 text-sm">
        Sin datos suficientes
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const toX = (i: number) => padL + (i / (data.length - 1)) * cW;
  const toY = (v: number) => padT + cH - (v / maxVal) * cH;

  const accent = "#f97316";
  const points = data.map((d, i) => `${toX(i)},${toY(d.total)}`).join(" ");
  const areaPath = [
    `M ${toX(0)},${padT + cH}`,
    ...data.map((d, i) => `L ${toX(i)},${toY(d.total)}`),
    `L ${toX(data.length - 1)},${padT + cH}`,
    "Z",
  ].join(" ");

  const yTicks = [0, maxVal * 0.33, maxVal * 0.67, maxVal];
  const xStep = Math.max(1, Math.floor(data.length / 6));
  const segW = cW / (data.length - 1);

  const hovData = hovered !== null ? data[hovered] : null;

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {yTicks.map((val, i) => (
          <g key={i}>
            <line x1={padL} y1={toY(val)} x2={W - padR} y2={toY(val)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 5} y={toY(val)} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.22)" fontSize="9">
              {val === 0 ? "$0" : val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${Math.round(val)}`}
            </text>
          </g>
        ))}

        {/* Vertical hover line */}
        {hovered !== null && (
          <line
            x1={toX(hovered)} y1={padT}
            x2={toX(hovered)} y2={padT + cH}
            stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4 3"
          />
        )}

        <path d={areaPath} fill="url(#areaG)" />
        <polyline points={points} fill="none" stroke={accent} strokeWidth="1.8" strokeLinejoin="round" />

        {/* Invisible hover zones */}
        {data.map((_, i) => (
          <rect
            key={i}
            x={toX(i) - segW / 2}
            y={padT}
            width={segW}
            height={cH}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}

        {/* Hover dot */}
        {hovered !== null && (
          <circle cx={toX(hovered)} cy={toY(data[hovered].total)} r="4" fill={accent} />
        )}

        {/* X labels */}
        {data
          .filter((_, i) => i % xStep === 0 || i === data.length - 1)
          .map((d) => {
            const i = data.indexOf(d);
            return (
              <text key={d.date} x={toX(i)} y={H - 6} textAnchor="middle" fill="rgba(255,255,255,0.22)" fontSize="8.5">
                {new Date(d.date + "T12:00:00").toLocaleDateString("es-EC", { day: "2-digit", month: "short" })}
              </text>
            );
          })}
      </svg>

      {/* Tooltip HTML overlay */}
      {hovData && hovered !== null && (
        <div
          className="absolute pointer-events-none bg-[#1c1c1c] border border-line rounded-lg px-3 py-2 text-xs shadow-xl z-10"
          style={{
            left: `${((toX(hovered)) / W) * 100}%`,
            top: `${((toY(hovData.total) - 10) / H) * 100}%`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="text-fg/50 mb-0.5">
            {new Date(hovData.date + "T12:00:00").toLocaleDateString("es-EC", { weekday: "short", day: "numeric", month: "short" })}
          </p>
          <p className="font-bold text-accent">{fmt(hovData.total)}</p>
        </div>
      )}
    </div>
  );
}

// ─── Bar chart: ventas mensuales ──────────────────────────────────────────────
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function BarChart({ data }: { data: MonthlySale[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const W = 600, H = 180;
  const padL = 52, padR = 12, padT = 14, padB = 32;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const barW = cW / data.length;
  const gap = barW * 0.22;
  const accent = "#f97316";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto select-none"
      onMouseLeave={() => setHovered(null)}
    >
      {/* Grid */}
      {[0, maxVal * 0.5, maxVal].map((val, i) => (
        <g key={i}>
          <line x1={padL} y1={padT + cH - (val / maxVal) * cH} x2={W - padR} y2={padT + cH - (val / maxVal) * cH} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={padL - 5} y={padT + cH - (val / maxVal) * cH} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.22)" fontSize="9">
            {val === 0 ? "$0" : val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${Math.round(val)}`}
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const bh = Math.max((d.total / maxVal) * cH, d.total > 0 ? 2 : 0);
        const x = padL + i * barW + gap / 2;
        const y = padT + cH - bh;
        const w = barW - gap;
        const isH = hovered === i;
        const monthIdx = parseInt(d.month.slice(5, 7)) - 1;

        return (
          <g key={d.month} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <rect
              x={x} y={y} width={w} height={bh}
              fill={isH ? accent : `${accent}55`}
              rx="2"
            />
            {isH && d.total > 0 && (
              <>
                <rect x={x + w / 2 - 24} y={y - 22} width={48} height={18} fill="#1c1c1c" rx="3" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                <text x={x + w / 2} y={y - 11} textAnchor="middle" fill={accent} fontSize="8.5" fontWeight="bold">
                  {fmt(d.total)}
                </text>
              </>
            )}
            <text x={x + w / 2} y={H - 7} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8.5">
              {MONTHS[monthIdx]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Donut chart: distribución de membresías ──────────────────────────────────
function DonutChart({ data }: { data: DistribItem[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return <p className="text-fg/30 text-sm text-center py-6">Sin membresías activas</p>;

  const CX = 90, CY = 90, R = 74, INNER = 38;

  let angle = -90;
  const slices = data.map((d) => {
    const deg = (d.count / total) * 360;
    const s = { ...d, startAngle: angle, endAngle: angle + Math.max(deg, 0.5) };
    angle += deg;
    return s;
  });

  function arc(sa: number, ea: number) {
    const rad = (a: number) => (a * Math.PI) / 180;
    const x1 = CX + R * Math.cos(rad(sa));
    const y1 = CY + R * Math.sin(rad(sa));
    const x2 = CX + R * Math.cos(rad(ea));
    const y2 = CY + R * Math.sin(rad(ea));
    const large = ea - sa > 180 ? 1 : 0;
    return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  const activeSlice = hovered ? slices.find((s) => s.name === hovered) : null;

  return (
    <div className="flex flex-col sm:flex-row gap-5 items-start">
      <svg viewBox="0 0 180 180" className="w-36 h-36 shrink-0">
        {slices.map((s) => (
          <path
            key={s.name}
            d={arc(s.startAngle, s.endAngle)}
            fill={s.color}
            opacity={hovered && hovered !== s.name ? 0.25 : 1}
            onMouseEnter={() => setHovered(s.name)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-pointer transition-opacity duration-100"
          />
        ))}
        <circle cx={CX} cy={CY} r={INNER} fill="#0d0d0d" />
        {activeSlice ? (
          <>
            <text x={CX} y={CY - 7} textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">
              {activeSlice.count}
            </text>
            <text x={CX} y={CY + 8} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="6.5">
              {((activeSlice.count / total) * 100).toFixed(0)}%
            </text>
          </>
        ) : (
          <>
            <text x={CX} y={CY - 5} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">
              {total}
            </text>
            <text x={CX} y={CY + 10} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7">
              activos
            </text>
          </>
        )}
      </svg>

      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {slices.map((s) => (
          <div
            key={s.name}
            className={`flex items-center gap-2 text-xs cursor-default transition-opacity ${hovered && hovered !== s.name ? "opacity-25" : ""}`}
            onMouseEnter={() => setHovered(s.name)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="truncate text-fg/70 flex-1">{s.name}</span>
            <span className="font-semibold tabular-nums">{s.count}</span>
            <span className="text-fg/30 w-9 text-right tabular-nums">
              {((s.count / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Top items table ──────────────────────────────────────────────────────────
function TopItemsTable({
  items,
}: {
  items: { description: string; item_type: string; revenue: number; units: number }[];
}) {
  if (items.length === 0) return <p className="text-fg/30 text-sm text-center py-6">Sin ventas registradas</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-fg/35 text-xs uppercase tracking-wider">
          <th className="text-left py-2.5 w-7">#</th>
          <th className="text-left py-2.5">Descripción</th>
          <th className="text-left py-2.5 hidden sm:table-cell">Tipo</th>
          <th className="text-right py-2.5 hidden md:table-cell">Uds.</th>
          <th className="text-right py-2.5">Ingresos</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={item.description} className="border-b border-line/40 last:border-0">
            <td className="py-2.5 text-fg/25 text-xs">{i + 1}</td>
            <td className="py-2.5 font-medium truncate max-w-[140px]">{item.description}</td>
            <td className="py-2.5 hidden sm:table-cell">
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                  item.item_type === "membership"
                    ? "bg-accent/15 text-accent"
                    : "bg-blue-500/15 text-blue-400"
                }`}
              >
                {item.item_type === "membership" ? "membresía" : "producto"}
              </span>
            </td>
            <td className="py-2.5 hidden md:table-cell text-right text-fg/50">{item.units}</td>
            <td className="py-2.5 text-right font-semibold">{fmt(item.revenue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function DashboardCharts({ dailySales, yearlySales, membershipDistrib, topItems }: Props) {
  const year = new Date().getFullYear();
  return (
    <div className="space-y-4">
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-line rounded-xl p-5">
          <p className="text-fg/40 text-xs uppercase tracking-widest mb-4">Ventas últimos 30 días</p>
          <AreaChart data={dailySales} />
        </div>
        <div className="bg-white/5 border border-line rounded-xl p-5">
          <p className="text-fg/40 text-xs uppercase tracking-widest mb-4">Ventas mensuales {year}</p>
          <BarChart data={yearlySales} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-line rounded-xl p-5">
          <p className="text-fg/40 text-xs uppercase tracking-widest mb-4">Top 5 por ingresos</p>
          <TopItemsTable items={topItems} />
        </div>
        <div className="bg-white/5 border border-line rounded-xl p-5">
          <p className="text-fg/40 text-xs uppercase tracking-widest mb-5">Distribución de membresías</p>
          <DonutChart data={membershipDistrib} />
        </div>
      </div>
    </div>
  );
}
