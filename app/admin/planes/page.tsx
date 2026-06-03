import { createClient } from "@/lib/supabase/server";
import PlanesClient from "./PlanesClient";

export default async function PlanesPage() {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("membership_plans")
    .select("id, name, description, price, duration_days, color, active")
    .order("sort_order")
    .order("name");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Planes</h2>
        <p className="text-fg/40 text-sm mt-0.5">{plans?.length ?? 0} planes</p>
      </div>

      <PlanesClient plans={plans ?? []} />
    </div>
  );
}
