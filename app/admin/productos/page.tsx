import { createClient } from "@/lib/supabase/server";
import ProductosClient from "./ProductosClient";

export default async function ProductosPage() {
  const supabase = await createClient();

  const [{ data: plans }, { data: products }] = await Promise.all([
    supabase
      .from("membership_plans")
      .select("id, name, description, price, duration_days, color, active, sort_order, image_url, iva_rate")
      .order("sort_order")
      .order("name"),

    supabase
      .from("products")
      .select("id, name, description, category, price, stock, active, image_url, iva_rate")
      .order("name"),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Gestión de Productos</h2>
        <p className="text-fg/40 text-sm mt-0.5">Planes de membresía y productos físicos</p>
      </div>

      <ProductosClient
        plans={(plans ?? []).map((p: any) => ({
          id: p.id as string,
          name: p.name as string,
          description: (p.description ?? null) as string | null,
          price: p.price as number,
          duration_days: p.duration_days as number,
          color: (p.color ?? "#e84b1f") as string,
          active: p.active as boolean,
          image_url: (p.image_url ?? null) as string | null,
          iva_rate: (p.iva_rate ?? 15) as number,
        }))}
        products={(products ?? []).map((p: any) => ({
          id: p.id as string,
          name: p.name as string,
          description: (p.description ?? null) as string | null,
          category: (p.category ?? null) as string | null,
          price: p.price as number,
          stock: p.stock as number,
          active: p.active as boolean,
          image_url: (p.image_url ?? null) as string | null,
          iva_rate: (p.iva_rate ?? 15) as number,
        }))}
      />
    </div>
  );
}
