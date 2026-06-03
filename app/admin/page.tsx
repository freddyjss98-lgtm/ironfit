import { getDashboardStats } from "@/lib/supabase/queries";
import Link from "next/link";
import DashboardCharts from "./DashboardCharts";
import { waLink, winBackMessage } from "@/lib/whatsapp";

function fmt(n: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="bg-white/5 border border-line rounded-xl p-5 flex flex-col gap-2">
      <p className="text-fg/40 text-xs uppercase tracking-widest">{label}</p>
      <p
        className={`font-display text-3xl tracking-tight ${
          accent ? "text-accent" : warn ? "text-amber-400" : "text-fg"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-fg/40 text-xs">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-fg/35 text-xs uppercase tracking-widest mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-8">
      {/* ─── Ventas ──────────────────────────────────────────────────────── */}
      <Section title="Ventas">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Ingresos hoy"
            value={fmt(stats.todayTotal)}
            sub={`${stats.todaySales} venta${stats.todaySales !== 1 ? "s" : ""}`}
            accent={stats.todayTotal > 0}
          />
          <KpiCard
            label="Ingresos del mes"
            value={fmt(stats.monthTotal)}
            sub={`${stats.monthSales} transacciones`}
          />
          <KpiCard
            label="Ticket promedio"
            value={fmt(stats.ticketPromedio)}
            sub="promedio por venta este mes"
          />
          <KpiCard
            label="Check-ins hoy"
            value={String(stats.todayCheckIns)}
            sub="asistencias registradas"
            accent={stats.todayCheckIns > 0}
          />
        </div>
      </Section>

      {/* ─── Membresías ──────────────────────────────────────────────────── */}
      <Section title="Membresías">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Atletas activos"
            value={String(stats.activeMembersCount)}
            sub={
              stats.newMembersThisMonth > 0
                ? `+${stats.newMembersThisMonth} nuevos este mes`
                : "membresía vigente hoy"
            }
          />
          <KpiCard
            label="Churn rate"
            value={`${stats.churnRate.toFixed(1)}%`}
            sub="tasa de abandono mensual"
            warn={stats.churnRate > 15}
          />
          <KpiCard
            label="MRR estimado"
            value={fmt(stats.mrr)}
            sub="ingresos recurrentes mensuales"
          />
          <KpiCard
            label="Por vencer (7 días)"
            value={String(stats.expiring7Days)}
            sub="membresías próximas a vencer"
            warn={stats.expiring7Days > 0}
          />
        </div>
      </Section>

      {/* ─── Socios en riesgo (churn silencioso) ─────────────────────────── */}
      <Section title="Retención · Socios en riesgo">
        {stats.atRiskMembers.length === 0 ? (
          <div className="bg-white/5 border border-line rounded-xl px-5 py-8 text-center text-fg/40 text-sm">
            🎉 Ningún socio activo lleva más de 10 días sin asistir. ¡Buena retención!
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-fg/40 text-xs">
                {stats.atRiskCount} socio{stats.atRiskCount !== 1 ? "s" : ""} con membresía activa sin venir hace ≥10 días
              </span>
            </div>
            <div className="bg-white/5 border border-line rounded-xl overflow-hidden divide-y divide-line/50">
              {stats.atRiskMembers.slice(0, 8).map((m) => {
                const meta =
                  m.days_since_visit === null
                    ? "Nunca ha asistido"
                    : `Sin venir hace ${m.days_since_visit} días`;
                const severe = m.days_since_visit === null || m.days_since_visit >= 20;
                return (
                  <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        severe ? "bg-red-500" : "bg-amber-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/admin/miembros/${m.id}`}
                        className="font-medium text-sm hover:text-accent transition-colors truncate block"
                      >
                        {m.full_name}
                      </Link>
                      <p className="text-fg/40 text-xs">
                        {meta}
                        {m.plan_name && ` · ${m.plan_name}`}
                      </p>
                    </div>
                    <a
                      href={waLink(m.phone, winBackMessage(m.full_name))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                      </svg>
                      Reactivar
                    </a>
                  </div>
                );
              })}
            </div>
            {stats.atRiskCount > 8 && (
              <p className="text-fg/30 text-xs mt-2 text-right">
                +{stats.atRiskCount - 8} más · ver en Recordatorios
              </p>
            )}
          </>
        )}
      </Section>

      {/* ─── Charts + Top 5 + Distribución ───────────────────────────────── */}
      <DashboardCharts
        dailySales={stats.dailySales30}
        yearlySales={stats.yearlySales}
        membershipDistrib={stats.membershipDistrib}
        topItems={stats.topItems}
      />

      {/* ─── Membresías por vencer ────────────────────────────────────────── */}
      <Section title="Membresías por vencer">
        {stats.expiringSoon.length === 0 ? (
          <div className="bg-white/5 border border-line rounded-xl px-5 py-8 text-center text-fg/40 text-sm">
            Sin membresías por vencer en los próximos 14 días
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-fg/40 text-xs">{stats.expiringSoon.length} membresías</span>
              <Link
                href="/admin/recordatorios"
                className="text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Ver recordatorios →
              </Link>
            </div>
            <div className="bg-white/5 border border-line rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-fg/40 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Atleta</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Plan</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Vence</th>
                      <th className="text-right px-4 py-3">Días</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.expiringSoon.map((row) => (
                      <tr
                        key={row.membership_id}
                        className="border-b border-line/50 last:border-0 hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{row.full_name}</p>
                          <p className="text-fg/40 text-xs">{row.phone}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-fg/60">{row.plan_name}</td>
                        <td className="px-4 py-3 hidden sm:table-cell text-fg/60">{row.end_date}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                              row.days_left <= 3
                                ? "bg-red-500/20 text-red-400"
                                : row.days_left <= 7
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-white/10 text-fg/60"
                            }`}
                          >
                            {row.days_left}d
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
