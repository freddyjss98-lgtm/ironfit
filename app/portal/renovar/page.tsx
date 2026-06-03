import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { site } from "@/app/content";

export default async function PortalRenovarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  const plan = membership?.membership_plans as unknown as { name: string; price: number } | null;
  const isExpired = !membership || membership.effective_status === "expired";

  // Pre-filled WhatsApp message
  const waMsg = encodeURIComponent(
    member
      ? `Hola Iron Fit! Soy *${member.full_name}* y quiero renovar mi membresía${plan ? ` (${plan.name})` : ""}. ¿Pueden ayudarme?`
      : "Hola Iron Fit! Quiero renovar mi membresía."
  );
  const waUrl = `https://wa.me/${site.whatsappNumber}?text=${waMsg}`;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="font-display text-3xl uppercase tracking-tight">Renovar membresía</h1>
        <p className="text-fg/40 text-sm mt-1">
          Coordina tu pago directamente con el gym.
        </p>
      </div>

      {/* Current status */}
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

        {plan?.price && (
          <div>
            <p className="text-fg/40 text-xs uppercase tracking-widest mb-1">Precio de renovación</p>
            <p className="text-2xl font-display font-bold text-accent">${plan.price}</p>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="bg-white/5 border border-line rounded-xl p-5">
        <p className="text-fg/40 text-xs uppercase tracking-widest mb-4">Cómo renovar</p>
        <ol className="flex flex-col gap-3">
          {[
            "Haz clic en el botón de WhatsApp de abajo",
            "Coordina el pago con el gym (transferencia o efectivo)",
            "Envía el comprobante de pago",
            "El gym activará tu membresía en 24h",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-fg/70">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* CTA */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold py-4 px-6 rounded-xl transition-colors text-base w-full"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M12 0C5.373 0 0 5.373 0 12c0 2.128.558 4.121 1.532 5.847L.063 23.25l5.595-1.468A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.887 9.887 0 01-5.031-1.378l-.36-.214-3.742.981.998-3.648-.235-.374A9.86 9.86 0 012.106 12C2.106 6.58 6.58 2.106 12 2.106c5.421 0 9.894 4.474 9.894 9.894 0 5.421-4.473 9.894-9.894 9.894z" />
        </svg>
        Contactar para renovar
      </a>

      <p className="text-fg/20 text-xs text-center">
        También puedes llamar al{" "}
        <a href={`tel:+${site.whatsappNumber}`} className="underline hover:text-fg/40">
          {site.whatsappDisplay}
        </a>
      </p>
    </div>
  );
}
