"use client";

// =============================================================================
// Historial de envíos automáticos
// =============================================================================
// Lee reminder_log, que hasta el 2026-09-03 no se mostraba en ninguna pantalla.
// Esa ceguera costó dos incidentes: 653 avisos fallidos que pasaron dos meses
// sin que nadie los viera, y tres días en que Meta aceptaba todo sin entregar
// nada por un problema de facturación.
//
// La distinción que hace útil esta pantalla: "Enviado" solo significa que Meta
// aceptó la llamada. "Entregado" es que llegó al teléfono. Son dos cosas
// distintas y confundirlas fue exactamente el error.
// =============================================================================

import { useMemo, useState } from "react";
import { explicarError } from "@/lib/whatsapp/metaErrors";

export type LogRow = {
  id: string;
  created_at: string;
  reminder_type: string;
  status: string;
  to_phone: string | null;
  error: string | null;
  error_code: number | null;
  delivered_at: string | null;
  member_name: string | null;
};

const TIPO_LABEL: Record<string, string> = {
  membership_expiry: "Vence pronto",
  membership_expired: "Venció",
  membership_activated: "Membresía activada",
  member_welcome: "Bienvenida",
  member_winback: "Reenganche",
  member_birthday: "Cumpleaños",
  admin_copy: "Copia al admin",
};

const ESTADO: Record<string, { label: string; cls: string }> = {
  read: { label: "Leído", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  delivered: { label: "Entregado", cls: "bg-green-500/15 text-green-400 border-green-500/20" },
  sent: { label: "Enviado", cls: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  failed: { label: "Falló", cls: "bg-red-500/15 text-red-400 border-red-500/20" },
  dry_run: { label: "Simulado", cls: "bg-white/10 text-fg/40 border-white/10" },
};

const RANGOS = [
  { id: "hoy", label: "Hoy", dias: 0 },
  { id: "7", label: "7 días", dias: 7 },
  { id: "30", label: "30 días", dias: 30 },
];

/** 'YYYY-MM-DD' de hoy en Ecuador (el navegador puede estar en otra zona). */
function hoyEc(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
}

function fechaEc(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date(iso));
}

function horaEc(iso: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function EnviosLog({ logs }: { logs: LogRow[] }) {
  const [rango, setRango] = useState("7");
  const [tipo, setTipo] = useState("all");
  const [estado, setEstado] = useState("all");

  const hoy = hoyEc();

  const { filas, resumenHoy } = useMemo(() => {
    const dias = RANGOS.find((r) => r.id === rango)?.dias ?? 7;
    const corte = new Date();
    corte.setDate(corte.getDate() - dias);
    const corteStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(corte);

    const filas = logs.filter((l) => {
      const f = fechaEc(l.created_at);
      if (rango === "hoy" ? f !== hoy : f < corteStr) return false;
      if (tipo !== "all" && l.reminder_type !== tipo) return false;
      if (estado !== "all" && l.status !== estado) return false;
      return true;
    });

    // El resumen SIEMPRE es de hoy, sin importar los filtros: es el semáforo.
    const deHoy = logs.filter((l) => fechaEc(l.created_at) === hoy);
    const resumenHoy = {
      total: deHoy.length,
      entregados: deHoy.filter((l) => l.status === "delivered" || l.status === "read").length,
      leidos: deHoy.filter((l) => l.status === "read").length,
      enviados: deHoy.filter((l) => l.status === "sent").length,
      fallidos: deHoy.filter((l) => l.status === "failed").length,
    };

    return { filas, resumenHoy };
  }, [logs, rango, tipo, estado, hoy]);

  const tiposPresentes = useMemo(
    () => Array.from(new Set(logs.map((l) => l.reminder_type))).sort(),
    [logs]
  );

  return (
    <div className="space-y-5">
      {/* ── Alerta: lo que faltó los días del incidente ────────────────────── */}
      {resumenHoy.fallidos > 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4">
          <p className="text-red-300 font-semibold text-sm">
            ⚠️ {resumenHoy.fallidos} {resumenHoy.fallidos === 1 ? "aviso no salió" : "avisos no salieron"} hoy
          </p>
          <p className="text-red-200/70 text-xs mt-1">
            Revisa el motivo en la tabla de abajo. Si todos fallan por lo mismo, suele ser la cuenta
            de Meta y no los socios.
          </p>
        </div>
      )}

      {/* ── Semáforo del día ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tarjeta label="Mensajes hoy" valor={resumenHoy.total} cls="bg-white/5 text-fg border-line" />
        <Tarjeta
          label="Entregados"
          valor={resumenHoy.entregados}
          cls="bg-green-500/15 text-green-400 border-green-500/20"
        />
        <Tarjeta
          label="Sin confirmar"
          valor={resumenHoy.enviados}
          cls="bg-blue-500/15 text-blue-400 border-blue-500/20"
        />
        <Tarjeta
          label="Fallidos"
          valor={resumenHoy.fallidos}
          cls={
            resumenHoy.fallidos > 0
              ? "bg-red-500/15 text-red-400 border-red-500/20"
              : "bg-white/5 text-fg/30 border-line"
          }
        />
      </div>

      <p className="text-fg/30 text-xs -mt-2">
        <span className="text-fg/50">Sin confirmar</span> = Meta aceptó el mensaje pero todavía no
        avisa que llegó. Si se queda así mucho rato, no se entregó.
      </p>

      {/* ── Filtros ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line overflow-hidden">
          {RANGOS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRango(r.id)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                rango === r.id ? "bg-accent text-white" : "text-fg/50 hover:text-fg hover:bg-white/5"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent"
        >
          <option value="all">Todos los avisos</option>
          {tiposPresentes.map((t) => (
            <option key={t} value={t}>
              {TIPO_LABEL[t] ?? t}
            </option>
          ))}
        </select>

        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent"
        >
          <option value="all">Todos los estados</option>
          <option value="read">Leído</option>
          <option value="delivered">Entregado</option>
          <option value="sent">Sin confirmar</option>
          <option value="failed">Falló</option>
        </select>

        <span className="text-fg/30 text-xs ml-auto">{filas.length} registros</span>
      </div>

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      {filas.length === 0 ? (
        <div className="bg-white/5 border border-line rounded-2xl px-6 py-16 text-center">
          <p className="text-fg/30 text-sm">No hay envíos con esos filtros.</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-line rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-fg/40 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-medium">Cuándo</th>
                  <th className="px-4 py-3 text-left font-medium">Socio</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Aviso</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((l) => {
                  const est = ESTADO[l.status] ?? {
                    label: l.status,
                    cls: "bg-white/10 text-fg/50 border-white/10",
                  };
                  const err = l.status === "failed" ? explicarError(l.error_code, l.error) : null;

                  return (
                    <tr key={l.id} className="border-b border-line/50 last:border-0 hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-fg/60 whitespace-nowrap">
                        <div>{horaEc(l.created_at)}</div>
                        {fechaEc(l.created_at) !== hoy && (
                          <div className="text-fg/30 text-xs">{fechaEc(l.created_at)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-fg">{l.member_name ?? "—"}</div>
                        <div className="text-fg/30 text-xs">{l.to_phone}</div>
                      </td>
                      <td className="px-4 py-3 text-fg/60 hidden sm:table-cell whitespace-nowrap">
                        {TIPO_LABEL[l.reminder_type] ?? l.reminder_type}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${est.cls}`}
                        >
                          {est.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        {err ? (
                          <>
                            <div className="text-red-300 text-xs">{err.que}</div>
                            {err.accion && (
                              <div className="text-fg/40 text-xs mt-0.5">{err.accion}</div>
                            )}
                          </>
                        ) : l.delivered_at ? (
                          <span className="text-fg/30 text-xs">
                            Entregado {horaEc(l.delivered_at)}
                          </span>
                        ) : (
                          <span className="text-fg/20 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ label, valor, cls }: { label: string; valor: number; cls: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="text-2xl font-bold tabular-nums">{valor}</div>
      <div className="text-xs opacity-70 mt-0.5">{label}</div>
    </div>
  );
}
