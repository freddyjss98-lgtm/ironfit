import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { site } from "@/app/content";
import RenewForm from "./RenewForm";

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

export default async function PortalRenovarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, phone")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: membership } = member
    ? await supabase
        .from("vw_memberships_status")
        .select("end_date, effective_status, days_until_expiry, membership_plans(name, price)")
        .eq("member_id", member.id)
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const [{ data: plans }, { data: bank }, { data: sales }, { data: pendingReq }, { data: myAccess }] =
    await Promise.all([
      supabase
        .from("membership_plans")
        .select("id, name, price, duration_days, color, is_exclusive")
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("gym_settings")
        .select("bank_name, account_type, account_number, account_holder, account_doc, payment_note")
        .eq("id", 1)
        .maybeSingle(),
      member
        ? supabase
            .from("sales")
            .select("id, sale_date, total, payment_method, bank_reference, notes")
            .eq("member_id", member.id)
            .order("sale_date", { ascending: false })
        : Promise.resolve({ data: [] as unknown[] }),
      member
        ? supabase
            .from("renewal_requests")
            .select("id, amount, payment_method, receipt_url, created_at, membership_plans(name)")
            .eq("member_id", member.id)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      member
        ? supabase.from("plan_member_access").select("plan_id").eq("member_id", member.id)
        : Promise.resolve({ data: [] as { plan_id: string }[] }),
    ]);

  // Planes visibles para el socio: públicos + exclusivos donde está autorizado.
  const allowedExclusive = new Set((myAccess ?? []).map((a) => a.plan_id as string));
  const visiblePlans = (plans ?? []).filter(
    (p) => !p.is_exclusive || allowedExclusive.has(p.id as string)
  );

  const plan = membership?.membership_plans as unknown as { name: string; price: number } | null;
  const isExpired = !membership || membership.effective_status === "expired";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pr = pendingReq as any;
  const pending = pr
    ? {
        id: pr.id as string,
        plan_name: (pr.membership_plans?.name ?? "Plan") as string,
        amount: Number(pr.amount ?? 0),
        payment_method: pr.payment_method as string,
        receipt_url: (pr.receipt_url ?? null) as string | null,
        created_at: pr.created_at as string,
      }
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSales = (sales ?? []) as any[];
  const totalPagado = allSales.reduce((sum, s) => sum + Number(s.total), 0);
  const lastPayment = allSales[0] ?? null;

  // WhatsApp solo para soporte
  const waMsg = encodeURIComponent(
    member
      ? `Hola Iron Fit! Soy *${member.full_name}* y necesito ayuda con mi renovación / pago.`
      : "Hola Iron Fit! Necesito ayuda con una renovación."
  );
  const waUrl = `https://wa.me/${site.whatsappNumber}?text=${waMsg}`;

  return (
    <div className="space-y-8 max-w-lg">
      {/* ── RENOVAR (principal) ──────────────────────────────────────────── */}
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-tight">Renovar membresía</h1>
          <p className="text-fg/40 text-sm mt-1">
            Elige tu plan, paga y sube tu comprobante. El gym lo revisa y activa tu membresía.
          </p>
        </div>

        {/* Estado actual */}
        <div className="bg-white/5 border border-line rounded-xl p-5 flex flex-col gap-4">
          <div>
            <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">Plan actual</p>
            <p className="font-semibold text-lg">{plan?.name ?? "Sin plan activo"}</p>
          </div>

          {membership && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">Vencimiento</p>
                <p className="font-semibold">{membership.end_date}</p>
              </div>
              <div>
                <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">Estado</p>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                    isExpired ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"
                  }`}
                >
                  {isExpired ? "Vencida" : `${membership.days_until_expiry} días restantes`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Flujo de renovación */}
        <RenewForm
          plans={visiblePlans.map((p) => ({
            id: p.id as string,
            name: p.name as string,
            price: Number(p.price),
            duration_days: Number(p.duration_days),
            color: (p.color ?? null) as string | null,
            is_exclusive: Boolean(p.is_exclusive),
          }))}
          bank={bank ?? null}
          pending={pending}
        />

        {/* Soporte */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 border border-line hover:border-[#25D366]/50 text-fg/70 hover:text-fg font-medium py-3 px-6 rounded-xl transition-colors text-sm w-full"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#25D366] shrink-0">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z M12 0C5.373 0 0 5.373 0 12c0 2.128.558 4.121 1.532 5.847L.063 23.25l5.595-1.468A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
          </svg>
          ¿Necesitas ayuda? Soporte por WhatsApp
        </a>
      </div>

      {/* ── MIS PAGOS (abajo) ────────────────────────────────────────────── */}
      <div className="space-y-6 border-t border-line pt-8">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-tight">Mis Pagos</h2>
          <p className="text-fg/40 text-sm mt-0.5">Historial de pagos y recibos</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-line rounded-xl p-4">
            <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">Total pagos</p>
            <p className="font-display text-2xl">{allSales.length}</p>
          </div>
          <div className="bg-white/5 border border-line rounded-xl p-4">
            <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">Total pagado</p>
            <p className="font-display text-2xl text-accent">{fmtMoney(totalPagado)}</p>
          </div>
        </div>

        {lastPayment && (
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-fg/50 text-xs uppercase tracking-wider mb-0.5">Último pago</p>
              <p className="font-semibold">{lastPayment.sale_date}</p>
              {lastPayment.notes && <p className="text-fg/40 text-xs mt-0.5">{lastPayment.notes}</p>}
            </div>
            <p className="font-display text-2xl text-accent">{fmtMoney(Number(lastPayment.total))}</p>
          </div>
        )}

        {allSales.length === 0 ? (
          <div className="bg-white/5 border border-line rounded-2xl px-5 py-12 text-center">
            <p className="text-fg/30 text-sm">Sin pagos registrados.</p>
          </div>
        ) : (
          <div className="bg-white/5 border border-line rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="text-fg/50 text-xs uppercase tracking-widest">
                {allSales.length} pago{allSales.length !== 1 ? "s" : ""}
              </h3>
            </div>

            <div className="divide-y divide-line/40">
              {allSales.map((s) => (
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
                      {s.notes && <p className="text-fg/40 text-xs mt-0.5">{s.notes}</p>}
                      {s.bank_reference && (
                        <p className="text-fg/30 text-xs">Ref: {s.bank_reference}</p>
                      )}
                    </div>
                    <p className="font-semibold shrink-0">{fmtMoney(Number(s.total))}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3.5 border-t border-line flex justify-between items-center bg-white/3">
              <span className="text-fg/40 text-sm">Total</span>
              <span className="font-display text-lg text-accent">{fmtMoney(totalPagado)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
