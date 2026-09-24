"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { uploadReceipt, createRenewalRequest } from "./actions";

type Plan = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  color: string | null;
  is_exclusive: boolean;
};

type Bank = {
  bank_name: string | null;
  account_type: string | null;
  account_number: string | null;
  account_holder: string | null;
  account_doc: string | null;
  payment_note: string | null;
} | null;

type Pending = {
  id: string;
  plan_name: string;
  amount: number;
  payment_method: string;
  receipt_url: string | null;
  created_at: string;
} | null;

const METHODS: [string, string][] = [
  ["transfer", "Transferencia"],
  ["cash", "Efectivo"],
  ["card", "Tarjeta"],
  ["other", "Otro"],
];

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelMini = "text-fg/50 text-xs uppercase tracking-wider";

function bankIsEmpty(b: Bank): boolean {
  if (!b) return true;
  return !b.bank_name && !b.account_number && !b.account_holder;
}

export default function RenewForm({
  plans,
  bank,
  pending,
}: {
  plans: Plan[];
  bank: Bank;
  pending: Pending;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "");
  const [method, setMethod] = useState("transfer");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [pendingTx, startTransition] = useTransition();

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  // ── Solicitud en revisión ──────────────────────────────────────────────────
  if (pending) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⏳</span>
          <p className="text-amber-300 font-semibold">Solicitud en revisión</p>
        </div>
        <p className="text-fg/60 text-sm">
          Enviaste una solicitud de <span className="font-semibold">{pending.plan_name}</span> por{" "}
          <span className="font-semibold">${pending.amount.toFixed(2)}</span>. El gym la revisará y
          activará tu membresía pronto.
        </p>
        {pending.receipt_url && (
          <a
            href={pending.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-xs text-accent hover:text-accent/80 underline"
          >
            Ver comprobante enviado
          </a>
        )}
      </div>
    );
  }

  async function copyAccount() {
    if (!bank?.account_number) return;
    try {
      await navigator.clipboard.writeText(bank.account_number);
      toast.success("Número de cuenta copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  function handleSubmit() {
    if (!selectedPlanId) {
      toast.error("Selecciona un plan");
      return;
    }
    if (!file) {
      toast.error("Sube el comprobante de pago");
      return;
    }
    startTransition(async () => {
      try {
        const url = await uploadReceipt(file);
        const fd = new FormData();
        fd.set("plan_id", selectedPlanId);
        fd.set("amount", String(selectedPlan?.price ?? 0));
        fd.set("payment_method", method);
        fd.set("receipt_url", url);
        fd.set("member_note", note);
        await createRenewalRequest(fd);
        toast.success("¡Solicitud enviada! El gym la revisará pronto.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al enviar");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* 1. Elegir plan */}
      <div>
        <p className={labelMini + " mb-2"}>1 · Elige tu plan</p>
        {plans.length === 0 ? (
          <p className="text-fg/40 text-sm">No hay planes disponibles. Contacta al gym.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {plans.map((p) => {
              const active = p.id === selectedPlanId;
              const color = p.color ?? "#e84b1f";
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`text-left rounded-xl border p-3 transition-colors ${
                    active ? "border-accent bg-accent/10" : "border-line bg-white/5 hover:border-fg/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{p.name}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                  {p.is_exclusive && (
                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-400/25 to-yellow-500/10 text-amber-300 text-[9px] font-bold uppercase tracking-wider">
                      <span aria-hidden>★</span> Exclusivo para ti
                    </span>
                  )}
                  <p className="text-fg/40 text-xs mt-0.5">{p.duration_days} días</p>
                  <p className="font-display text-xl text-accent mt-1">${p.price}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Datos para transferir */}
      <div>
        <p className={labelMini + " mb-2"}>2 · Realiza el pago</p>
        {bankIsEmpty(bank) ? (
          <div className="bg-white/5 border border-line rounded-xl p-4 text-sm text-fg/50">
            El gym aún no publicó los datos de pago. Coordina por el botón de soporte de abajo.
          </div>
        ) : (
          <div className="bg-white/5 border border-line rounded-xl p-4 space-y-2 text-sm">
            {bank?.bank_name && (
              <div className="flex justify-between gap-3">
                <span className="text-fg/40">Banco</span>
                <span className="font-medium text-right">{bank.bank_name}</span>
              </div>
            )}
            {bank?.account_type && (
              <div className="flex justify-between gap-3">
                <span className="text-fg/40">Tipo de cuenta</span>
                <span className="font-medium text-right">{bank.account_type}</span>
              </div>
            )}
            {bank?.account_number && (
              <div className="flex justify-between gap-3 items-center">
                <span className="text-fg/40">Número</span>
                <span className="font-medium text-right flex items-center gap-2">
                  {bank.account_number}
                  <button
                    onClick={copyAccount}
                    className="text-xs text-accent hover:text-accent/80 border border-accent/40 rounded px-1.5 py-0.5"
                  >
                    Copiar
                  </button>
                </span>
              </div>
            )}
            {bank?.account_holder && (
              <div className="flex justify-between gap-3">
                <span className="text-fg/40">Titular</span>
                <span className="font-medium text-right">{bank.account_holder}</span>
              </div>
            )}
            {bank?.account_doc && (
              <div className="flex justify-between gap-3">
                <span className="text-fg/40">C.I./RUC</span>
                <span className="font-medium text-right">{bank.account_doc}</span>
              </div>
            )}
            {bank?.payment_note && (
              <p className="text-fg/40 text-xs pt-1 border-t border-line/40">{bank.payment_note}</p>
            )}
          </div>
        )}
      </div>

      {/* 3. Subir comprobante */}
      <div className="space-y-3">
        <p className={labelMini}>3 · Sube tu comprobante</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className={labelMini}>Método</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
              {METHODS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelMini}>Monto</label>
            <input
              readOnly
              value={selectedPlan ? `$${selectedPlan.price}` : "—"}
              className={inputCls + " opacity-70"}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelMini}>Comprobante (foto o PDF)</label>
          <label className="cursor-pointer inline-flex items-center gap-2 text-sm text-fg/70 hover:text-fg border border-line hover:border-accent/40 rounded-lg px-3 py-2.5 transition-colors w-fit">
            {file ? "Cambiar archivo" : "Seleccionar archivo"}
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          {file && <p className="text-fg/40 text-xs truncate">📎 {file.name}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelMini}>Nota (opcional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={inputCls + " resize-none"}
            placeholder="Ej. transferí desde mi cuenta de Pichincha"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={pendingTx || plans.length === 0}
          className="w-full bg-accent hover:bg-accent/80 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {pendingTx ? "Enviando..." : "Enviar solicitud de renovación"}
        </button>
        <p className="text-fg/30 text-xs text-center">
          El gym revisará tu comprobante y activará tu membresía.
        </p>
      </div>
    </div>
  );
}
