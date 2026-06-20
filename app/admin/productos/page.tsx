import { createClient } from "@/lib/supabase/server";
import ProductosClient from "./ProductosClient";

export default async function ProductosPage() {
  const supabase = await createClient();

  const [{ data: plans }, { data: products }, { data: members }, { data: access }] =
    await Promise.all([
      supabase
        .from("membership_plans")
        .select("id, name, description, price, duration_days, color, active, sort_order, image_url, iva_rate, is_exclusive")
        .order("sort_order")
        .order("name"),

      supabase
        .from("products")
        .select("id, name, description, category, price, stock, active, image_url, iva_rate")
        .order("name"),

      supabase
        .from("members")
        .select("id, full_name")
        .is("deleted_at", null)
        .order("full_name"),

      supabase.from("plan_member_access").select("plan_id, member_id"),
    ]);

  // Mapa plan_id → lista de member_ids con acceso
  const planAccess: Record<string, string[]> = {};
  for (const a of access ?? []) {
    const pid = a.plan_id as string;
    (planAccess[pid] ??= []).push(a.member_id as string);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Gestión de Productos</h2>
        <p className="text-fg/40 text-sm mt-0.5">Planes de membresía y productos físicos</p>
      </div>

      <ProductosClient
        members={(members ?? []).map((m: any) => ({ id: m.id as string, full_name: m.full_name as string }))}
        planAccess={planAccess}
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
          is_exclusive: (p.is_exclusive ?? false) as boolean,
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
