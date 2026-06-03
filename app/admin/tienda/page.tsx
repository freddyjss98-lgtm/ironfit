import { createClient } from "@/lib/supabase/server";
import TiendaClient from "./TiendaClient";

export default async function TiendaPage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, description, category, price, stock, active")
    .order("category")
    .order("name");

  const total = products?.length ?? 0;
  const lowStock = products?.filter((p) => p.stock <= 3 && p.active).length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Tienda</h2>
        <p className="text-fg/40 text-sm mt-0.5">
          {total} productos
          {lowStock > 0 && (
            <span className="ml-2 text-amber-400">{lowStock} con stock bajo</span>
          )}
        </p>
      </div>

      <TiendaClient products={products ?? []} />
    </div>
  );
}
