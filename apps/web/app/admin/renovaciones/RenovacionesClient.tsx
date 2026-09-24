"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveRenewalRequest, rejectRenewalRequest, updateGymSettings } from "./actions";

type ReqRow = {
  id: string;
  amount: number;
  payment_method: string;
  receipt_url: string | null;
  member_note: string | null;
  admin_note: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  member_name: string;
  member_phone: string;
  plan_name: string;
  plan_days: number;
};

type Settings = {
  bank_name: string | null;
  account_type: string | null;
  account_number: string | null;
  account_holder: string | null;
  account_doc: string | null;
  payment_note: string | null;
} | null;

const METHOD_LABELS: Record<string, string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
  other: "Otro",
};

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelMini = "text-fg/50 text-xs uppercase tracking-wider";

function fmtDateTime(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" });
}

// ── Tarjeta de solicitud pendiente ───────────────────────────────────────────
function RequestCard({ r }: { r: ReqRow }) {
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    if (!confirm(`¿Aprobar la renovación de ${r.member_name} (${r.plan_name})? Se activará su membresía.`))
      return;
    startTransition(async () => {
      try {
        await approveRenewalRequest(r.id);
        toast.success(`Membresía de ${r.member_name} renovada`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al aprobar");
      }
    });
  }

  function handleReject() {
    const reason = prompt("Motivo del rechazo (opcional):");
    if (reason === null) return; // canceló
    startTransition(async () => {
      try {
        await rejectRenewalRequest(r.id, reason);
        toast.success("Solicitud rechazada");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al rechazar");
      }
    });
  }

  return (
    <div className="bg-white/5 border border-line rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold">{r.member_name}</p>
          <p className="text-fg/40 text-xs">{r.member_phone}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl text-accent">${r.amount.toFixed(2)}</p>
          <span className="text-xs text-fg/40">{fmtDateTime(r.created_at)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
        <div>
          <p className={labelMini}>Plan</p>
          <p className="font-medium">
            {r.plan_name} <span className="text-fg/40">· {r.plan_days}d</span>
          </p>
        </div>
        <div>
          <p className={labelMini}>Método</p>
          <p className="font-medium">{METHOD_LABELS[r.payment_method] ?? r.payment_method}</p>
        </div>
      </div>

      {r.member_note && (
        <p className="text-fg/50 text-xs mt-2 italic border-t border-line/40 pt-2">
          “{r.member_note}”
        </p>
      )}

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {r.receipt_url ? (
          <a
            href={r.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs border border-line hover:border-accent/50 text-fg/70 hover:text-fg px-3 py-1.5 rounded-lg transition-colors"
          >
            📎 Ver comprobante
          </a>
        ) : (
          <span className="text-xs text-fg/30">Sin comprobante</span>
        )}
        <div className="flex-1" />
        <button
          onClick={handleReject}
          disabled={pending}
          className="text-xs text-fg/40 hover:text-red-400 border border-line hover:border-red-400/40 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          Rechazar
        </button>
        <button
          onClick={handleApprove}
          disabled={pending}
          className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? "..." : "Aprobar y renovar"}
        </button>
      </div>
    </div>
  );
}

// ── Datos bancarios (config admin) ────────────────────────────────────────────
function BankSettings({ settings }: { settings: Settings }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateGymSettings(fd);
        toast.success("Datos de pago actualizados");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <div className="bg-white/5 border border-line rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base uppercase tracking-tight">Datos de pago</h3>
          <p className="text-fg/40 text-xs mt-0.5">
            Lo que ve el socio para transferir al renovar.
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-accent hover:text-accent/80 transition-colors"
        >
          {open ? "Cerrar" : "Editar"}
        </button>
      </div>

      {!open ? (
        <div className="mt-3 text-sm text-fg/60 grid sm:grid-cols-2 gap-x-6 gap-y-1">
          <p>Banco: <span className="text-fg">{settings?.bank_name || "—"}</span></p>
          <p>Cuenta: <span className="text-fg">{settings?.account_number || "—"}</span></p>
          <p>Tipo: <span className="text-fg">{settings?.account_type || "—"}</span></p>
          <p>Titular: <span className="text-fg">{settings?.account_holder || "—"}</span></p>
          <p>C.I./RUC: <span className="text-fg">{settings?.account_doc || "—"}</span></p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className={labelMini}>Banco</label>
            <input name="bank_name" defaultValue={settings?.bank_name ?? ""} className={inputCls} placeholder="Ej. Banco Pichincha" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelMini}>Tipo de cuenta</label>
            <input name="account_type" defaultValue={settings?.account_type ?? ""} className={inputCls} placeholder="Ahorros / Corriente" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelMini}>Número de cuenta</label>
            <input name="account_number" defaultValue={settings?.account_number ?? ""} className={inputCls} placeholder="2200..." />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelMini}>Titular</label>
            <input name="account_holder" defaultValue={settings?.account_holder ?? ""} className={inputCls} placeholder="Nombre del titular" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelMini}>C.I. / RUC</label>
            <input name="account_doc" defaultValue={settings?.account_doc ?? ""} className={inputCls} placeholder="11..." />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className={labelMini}>Nota / instrucciones</label>
            <textarea name="payment_note" defaultValue={settings?.payment_note ?? ""} rows={2} className={inputCls + " resize-none"} placeholder="Ej. Envía el comprobante por la app." />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {pending ? "Guardando..." : "Guardar datos"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function RenovacionesClient({
  requests,
  settings,
}: {
  requests: ReqRow[];
  settings: Settings;
}) {
  const pending = requests.filter((r) => r.status === "pending");
  const history = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <BankSettings settings={settings} />

      {/* Pendientes */}
      <div className="space-y-3">
        <h3 className="font-display text-base uppercase tracking-tight text-fg/80">
          Pendientes ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <div className="bg-white/5 border border-line rounded-xl px-5 py-10 text-center text-fg/40 text-sm">
            No hay solicitudes pendientes 🎉
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {pending.map((r) => (
              <RequestCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </div>

      {/* Historial */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display text-base uppercase tracking-tight text-fg/80">
            Historial ({history.length})
          </h3>
          <div className="bg-white/5 border border-line rounded-xl overflow-hidden divide-y divide-line/40">
            {history.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {r.member_name}
                    <span className="text-fg/40 font-normal"> · {r.plan_name}</span>
                  </p>
                  <p className="text-fg/40 text-xs">
                    {fmtDateTime(r.created_at)}
                    {r.admin_note ? ` · ${r.admin_note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-fg/60">${r.amount.toFixed(2)}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      r.status === "approved"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {r.status === "approved" ? "Aprobada" : "Rechazada"}
                  </span>
                  {r.receipt_url && (
                    <a
                      href={r.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:text-accent/80"
                    >
                      Recibo
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
