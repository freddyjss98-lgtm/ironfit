import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPortalMember } from "@/lib/portal/get-member";
import PreviewBanner from "../_components/PreviewBanner";

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

const METHOD_LABELS: Record<string, string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
  other: "Otro",
};

const METHOD_COLORS: Record<string, string> = {
  transfer: "bg-blue-500/15 text-blue-400",
  cash: "bg-emerald-500/15 text-emerald-400",
  card: "bg-purple-500/15 text-purple-400",
  other: "bg-white/10 text-fg/40",
};

export default async function PortalPagosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { member, isPreview } = await getPortalMember(supabase, user.id);
  if (!member) redirect("/portal");

  const { data: sales } = await supabase
    .from("sales")
    .select("id, sale_date, total, payment_method, bank_reference, notes")
    .eq("member_id", member.id)
    .order("sale_date", { ascending: false });

  const all = sales ?? [];
  const totalPagado = all.reduce((sum, s) => sum + Number(s.total), 0);
  const lastPayment = all[0] ?? null;

  return (
    <div className="space-y-6">
      {isPreview && <PreviewBanner memberName={member.full_name} />}
      <div>
        <h1 className="font-display text-2xl uppercase tracking-tight">
          Mis Pagos
        </h1>
        <p className="text-fg/40 text-sm mt-0.5">Historial de pagos y recibos</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">
            Total pagos
          </p>
          <p className="font-display text-2xl">{all.length}</p>
        </div>
        <div className="bg-white/5 border border-line rounded-xl p-4">
          <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">
            Total pagado
          </p>
          <p className="font-display text-2xl text-accent">
            {fmtMoney(totalPagado)}
          </p>
        </div>
      </div>

      {lastPayment && (
        <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-fg/50 text-xs uppercase tracking-wider mb-0.5">
              Último pago
            </p>
            <p className="font-semibold">{lastPayment.sale_date}</p>
            {lastPayment.notes && (
              <p className="text-fg/40 text-xs mt-0.5">{lastPayment.notes}</p>
            )}
          </div>
          <p className="font-display text-2xl text-accent">
            {fmtMoney(Number(lastPayment.total))}
          </p>
        </div>
      )}

      {/* Table */}
      {all.length === 0 ? (
        <div className="bg-white/5 border border-line rounded-2xl px-5 py-16 text-center">
          <p className="text-fg/30 text-sm">Sin pagos registrados.</p>
        </div>
      ) : (
        <div className="bg-white/5 border border-line rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="text-fg/50 text-xs uppercase tracking-widest">
              {all.length} pago{all.length !== 1 ? "s" : ""}
            </h2>
          </div>

          <div className="divide-y divide-line/40">
            {all.map((s) => (
              <div key={s.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{s.sale_date}</span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          METHOD_COLORS[s.payment_method] ?? "bg-white/10 text-fg/40"
                        }`}
                      >
                        {METHOD_LABELS[s.payment_method] ?? s.payment_method}
                      </span>
                    </div>
                    {s.notes && (
                      <p className="text-fg/40 text-xs mt-0.5">{s.notes}</p>
                    )}
                    {s.bank_reference && (
                      <p className="text-fg/30 text-xs">
                        Ref: {s.bank_reference}
                      </p>
                    )}
                  </div>
                  <p className="font-semibold shrink-0">
                    {fmtMoney(Number(s.total))}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3.5 border-t border-line flex justify-between items-center bg-white/3">
            <span className="text-fg/40 text-sm">Total</span>
            <span className="font-display text-lg text-accent">
              {fmtMoney(totalPagado)}
            </span>
          </div>
        </div>
      )}

      <div className="text-center">
        <p className="text-fg/20 text-xs">
          ¿Algún problema con un pago? Contáctanos por WhatsApp.
        </p>
      </div>
    </div>
  );
}
