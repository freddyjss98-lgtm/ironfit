import { createClient } from "@/lib/supabase/server";
import { todayInEcuador } from "@ironfit/shared/date";
import FeriadosClient, { type ClosureRow } from "./FeriadosClient";

export default async function FeriadosPage() {
  const supabase = await createClient();

  // Por si el cron de las 9:00 falló: la revisión final de los cierres cuyo día
  // ya llegó también corre al abrir esta pantalla. Es idempotente.
  await supabase.rpc("finalize_due_gym_closures");

  const [{ data: closures }, { data: credits }] = await Promise.all([
    supabase
      .from("gym_closures")
      .select("id, closure_date, reason")
      .order("closure_date", { ascending: false }),
    supabase.from("gym_closure_credits").select("closure_id, member_id").eq("kind", "extended"),
  ]);

  const membersByClosure = new Map<string, number>();
  for (const c of credits ?? []) {
    const id = c.closure_id as string;
    membersByClosure.set(id, (membersByClosure.get(id) ?? 0) + 1);
  }

  const rows: ClosureRow[] = (closures ?? []).map((c) => ({
    id: c.id as string,
    date: c.closure_date as string,
    reason: c.reason as string,
    members: membersByClosure.get(c.id as string) ?? 0,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Feriados</h2>
        <p className="text-fg/40 text-sm mt-0.5 max-w-2xl">
          Marca los días que el gimnasio no abre. A cada socio con membresía activa ese día se le
          suma 1 día al vencimiento. Los domingos no cuentan: el gimnasio nunca abre.
        </p>
      </div>

      <FeriadosClient closures={rows} today={todayInEcuador()} />
    </div>
  );
}
