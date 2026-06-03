"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { createClient } from "@/lib/supabase/browser";
import {
  createPlan, updatePlan, deletePlan, togglePlanActive,
  createProduct, updateProduct, deleteProduct, toggleProductActive, adjustStock,
} from "./actions";

// ── Types ──────────────────────────────────────────────────────────────────────

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  color: string;
  active: boolean;
  image_url: string | null;
  iva_rate: number;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  stock: number;
  active: boolean;
  image_url: string | null;
  iva_rate: number;
};

type Props = { plans: Plan[]; products: Product[] };

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES: Record<string, string> = {
  supplement: "Suplemento",
  apparel: "Ropa",
  accessory: "Accesorio",
  other: "Otro",
};

const CAT_COLORS: Record<string, string> = {
  supplement: "bg-blue-500 text-white",
  apparel: "bg-purple-500 text-white",
  accessory: "bg-amber-500 text-white",
  other: "bg-white/15 text-fg/70",
};

const IVA_OPTIONS = [
  { value: "15", label: "15% — General" },
  { value: "12", label: "12% — Reducido" },
  { value: "5",  label: "5% — Especial" },
  { value: "0",  label: "0% — Exento" },
];

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelCls = "text-fg/50 text-xs uppercase tracking-wider";

// ── Photo upload ───────────────────────────────────────────────────────────────

function PhotoUpload({
  current,
  onChange,
}: {
  current: string | null;
  onChange: (url: string | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(current);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("productos")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from("productos")
        .getPublicUrl(path);
      setPreview(publicUrl);
      onChange(publicUrl);
      toast.success("Imagen subida correctamente");
    } catch {
      toast.error("Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* Preview */}
      <div className="w-16 h-16 rounded-lg border border-line overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
        {preview ? (
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <span className="text-fg/25 text-xs text-center leading-tight px-1">Sin foto</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          className={`cursor-pointer px-3 py-1.5 border border-accent/40 hover:border-accent text-accent text-xs rounded-lg transition-colors flex items-center gap-1.5 ${
            uploading ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <input type="file" accept="image/*" onChange={handleFile} className="sr-only" />
          📷 {uploading ? "Subiendo..." : preview ? "Cambiar foto" : "Subir foto"}
        </label>
        {preview && (
          <button
            type="button"
            onClick={() => { setPreview(null); onChange(null); }}
            className="text-xs text-fg/30 hover:text-red-400 transition-colors text-left"
          >
            Quitar foto
          </button>
        )}
      </div>
    </div>
  );
}

// ── Action buttons ─────────────────────────────────────────────────────────────

function EditarBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded transition-colors"
    >
      ✏ EDITAR
    </button>
  );
}

function EliminarBtn({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 border border-red-300 rounded transition-colors disabled:opacity-40"
    >
      🗑 ELIMINAR
    </button>
  );
}

function EstadoBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${
        active ? "bg-emerald-600 text-white" : "bg-gray-400 text-white"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

// ── Plan Form ──────────────────────────────────────────────────────────────────

function PlanForm({ plan, onClose }: { plan?: Plan; onClose: () => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(plan?.image_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (imageUrl) fd.set("image_url", imageUrl);
    setError(null);
    startTransition(async () => {
      try {
        if (plan) await updatePlan(plan.id, fd);
        else await createPlan(fd);
        toast.success(plan ? "Plan actualizado" : "Plan creado");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Nombre *</label>
          <input name="name" required defaultValue={plan?.name} className={inputCls} placeholder="Ej. Iron Fit" />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Descripción</label>
          <input name="description" defaultValue={plan?.description ?? ""} className={inputCls} placeholder="Opcional" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Precio (USD) *</label>
          <input name="price" type="number" required min="0" step="0.01" defaultValue={plan?.price} className={inputCls} placeholder="0.00" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Duración (días) *</label>
          <input name="duration_days" type="number" required min="1" defaultValue={plan?.duration_days} className={inputCls} placeholder="30" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>IVA (SRI)</label>
          <select name="iva_rate" defaultValue={String(plan?.iva_rate ?? 15)} className={inputCls}>
            {IVA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Color del plan</label>
          <div className="flex gap-2 items-center">
            <input name="color" type="color" defaultValue={plan?.color ?? "#e84b1f"}
              className="h-9 w-16 rounded bg-transparent border border-white/15 cursor-pointer" />
            <span className="text-fg/40 text-xs">Color distintivo en la UI</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Foto del plan</label>
          <PhotoUpload current={plan?.image_url ?? null} onChange={setImageUrl} />
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors">
          CANCELAR
        </button>
        <button type="submit" disabled={pending}
          className="px-5 py-2 text-sm font-bold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50">
          {pending ? "Guardando..." : plan ? "ACTUALIZAR PLAN" : "CREAR PLAN"}
        </button>
      </div>
    </form>
  );
}

// ── Product Form ───────────────────────────────────────────────────────────────

function ProductForm({ product, onClose }: { product?: Product; onClose: () => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (imageUrl) fd.set("image_url", imageUrl);
    setError(null);
    startTransition(async () => {
      try {
        if (product) await updateProduct(product.id, fd);
        else await createProduct(fd);
        toast.success(product ? "Producto actualizado" : "Producto creado");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Nombre *</label>
          <input name="name" required defaultValue={product?.name} className={inputCls} placeholder="Ej. Proteína Whey 1kg" />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Descripción</label>
          <input name="description" defaultValue={product?.description ?? ""} className={inputCls} placeholder="Opcional" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Precio (USD) *</label>
          <input name="price" type="number" required min="0" step="0.01" defaultValue={product?.price} className={inputCls} placeholder="0.00" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Stock</label>
          <input name="stock" type="number" min="0" defaultValue={product?.stock ?? 0} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Categoría</label>
          <select name="category" defaultValue={product?.category ?? ""} className={inputCls}>
            <option value="">Sin categoría</option>
            {Object.entries(CATEGORIES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>IVA (SRI)</label>
          <select name="iva_rate" defaultValue={String(product?.iva_rate ?? 15)} className={inputCls}>
            {IVA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Foto del producto</label>
          <PhotoUpload current={product?.image_url ?? null} onChange={setImageUrl} />
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors">
          CANCELAR
        </button>
        <button type="submit" disabled={pending}
          className="px-5 py-2 text-sm font-bold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50">
          {pending ? "Guardando..." : product ? "ACTUALIZAR PRODUCTO" : "CREAR PRODUCTO"}
        </button>
      </div>
    </form>
  );
}

// ── Delete helper hook ─────────────────────────────────────────────────────────

function useDelete(action: (id: string) => Promise<void>, successMsg: string) {
  const [pending, startTransition] = useTransition();
  function run(id: string) {
    if (!confirm("¿Estás seguro? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      try {
        await action(id);
        toast.success(successMsg);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al eliminar");
      }
    });
  }
  return { run, pending };
}

// ── Planes section ─────────────────────────────────────────────────────────────

function PlanesSection({ plans }: { plans: Plan[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [togglePending, startToggle] = useTransition();
  const { run: doDelete, pending: deletePending } = useDelete(deletePlan, "Plan eliminado");

  const filtered = plans.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q);
  });

  const total = filtered.length;
  const pageCount = Math.ceil(total / rowsPerPage) || 1;
  const cp = Math.min(page, pageCount - 1);
  const paged = filtered.slice(cp * rowsPerPage, (cp + 1) * rowsPerPage);

  function openEdit(plan: Plan) {
    setEditPlan(plan);
    setShowForm(false);
  }

  function openCreate() {
    setEditPlan(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditPlan(null);
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg uppercase tracking-tight">Planes de Membresía</h3>
          <p className="text-fg/40 text-xs mt-0.5">{plans.length} planes registrados</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Crear Plan
        </button>
      </div>

      {/* Inline form */}
      {(showForm || editPlan) && (
        <div className="bg-white/5 border border-line rounded-xl p-6">
          <h4 className="font-semibold text-sm mb-4">
            {editPlan ? `Editar — ${editPlan.name}` : "Crear Nuevo Plan"}
          </h4>
          <PlanForm plan={editPlan ?? undefined} onClose={closeForm} />
        </div>
      )}

      {/* Search */}
      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        placeholder="Buscar por nombre o descripción..."
        className="w-full bg-white/5 border border-line text-fg text-sm rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-fg/30"
      />

      {/* Table */}
      <div className="bg-white/5 border border-line rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-fg/40 text-sm text-center py-10">Sin resultados</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wider bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-accent">Nombre</th>
                    <th className="text-left px-4 py-3 text-accent hidden sm:table-cell">Descripción</th>
                    <th className="text-right px-4 py-3 text-fg/50">Precio</th>
                    <th className="text-center px-4 py-3 text-fg/50">Tipo</th>
                    <th className="text-center px-4 py-3 text-fg/50">Cupo</th>
                    <th className="text-center px-4 py-3 text-fg/50 hidden md:table-cell">Meses</th>
                    <th className="text-center px-4 py-3 text-fg/50">Estado</th>
                    <th className="text-center px-4 py-3 text-fg/50">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((plan) => (
                    <tr key={plan.id} className={`border-b border-line/50 last:border-0 hover:bg-white/[0.03] transition-colors ${!plan.active ? "opacity-50" : ""}`}>
                      {/* Nombre */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {plan.image_url && (
                            <img src={plan.image_url} alt={plan.name}
                              className="w-8 h-8 rounded object-cover border border-line shrink-0" />
                          )}
                          <div>
                            <span className="font-semibold text-fg">{plan.name}</span>
                            <p className="text-xs text-fg/40">IVA {plan.iva_rate}%</p>
                          </div>
                        </div>
                      </td>
                      {/* Descripción */}
                      <td className="px-4 py-3 text-fg/50 text-xs hidden sm:table-cell max-w-[180px] truncate">
                        {plan.description ?? "—"}
                      </td>
                      {/* Precio */}
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        ${plan.price.toFixed(2)}
                      </td>
                      {/* Tipo */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-600 text-white">
                          Membresía
                        </span>
                      </td>
                      {/* Cupo */}
                      <td className="px-4 py-3 text-center text-fg/70">{plan.duration_days}</td>
                      {/* Meses */}
                      <td className="px-4 py-3 text-center text-fg/70 hidden md:table-cell">
                        {(plan.duration_days / 30).toFixed(2)}
                      </td>
                      {/* Estado */}
                      <td className="px-4 py-3 text-center">
                        <button
                          disabled={togglePending}
                          onClick={() =>
                            startToggle(async () => {
                              try {
                                await togglePlanActive(plan.id, plan.active);
                                toast.success(plan.active ? "Plan desactivado" : "Plan activado");
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Error");
                              }
                            })
                          }
                          title="Clic para cambiar estado"
                          className="disabled:opacity-50"
                        >
                          <EstadoBadge active={plan.active} />
                        </button>
                      </td>
                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <EditarBtn onClick={() => openEdit(plan)} />
                          <EliminarBtn onClick={() => doDelete(plan.id)} pending={deletePending} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-line text-xs text-fg/50">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                  className="bg-white/10 border border-line rounded px-2 py-0.5 text-fg text-xs outline-none">
                  {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span>{total === 0 ? "0" : `${cp * rowsPerPage + 1}–${Math.min((cp + 1) * rowsPerPage, total)}`} of {total}</span>
                <button disabled={cp === 0} onClick={() => setPage((p) => p - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-line disabled:opacity-30 hover:border-fg/40 hover:text-fg transition-colors">‹</button>
                <button disabled={cp >= pageCount - 1} onClick={() => setPage((p) => p + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-line disabled:opacity-30 hover:border-fg/40 hover:text-fg transition-colors">›</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Productos section ──────────────────────────────────────────────────────────

function ProductosSection({ products }: { products: Product[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [togglePending, startToggle] = useTransition();
  const [stockPending, startStock] = useTransition();
  const { run: doDelete, pending: deletePending } = useDelete(deleteProduct, "Producto eliminado");

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q);
  });

  const total = filtered.length;
  const pageCount = Math.ceil(total / rowsPerPage) || 1;
  const cp = Math.min(page, pageCount - 1);
  const paged = filtered.slice(cp * rowsPerPage, (cp + 1) * rowsPerPage);

  function openEdit(product: Product) {
    setEditProduct(product);
    setShowForm(false);
  }

  function openCreate() {
    setEditProduct(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditProduct(null);
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg uppercase tracking-tight">Productos Físicos</h3>
          <p className="text-fg/40 text-xs mt-0.5">{products.length} productos registrados</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Crear Producto
        </button>
      </div>

      {/* Inline form */}
      {(showForm || editProduct) && (
        <div className="bg-white/5 border border-line rounded-xl p-6">
          <h4 className="font-semibold text-sm mb-4">
            {editProduct ? `Editar — ${editProduct.name}` : "Crear Nuevo Producto"}
          </h4>
          <ProductForm product={editProduct ?? undefined} onClose={closeForm} />
        </div>
      )}

      {/* Search */}
      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        placeholder="Buscar por nombre o descripción..."
        className="w-full bg-white/5 border border-line text-fg text-sm rounded-lg px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-fg/30"
      />

      {/* Table */}
      <div className="bg-white/5 border border-line rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-fg/40 text-sm text-center py-10">Sin resultados</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wider bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-accent">Nombre</th>
                    <th className="text-left px-4 py-3 text-accent hidden sm:table-cell">Descripción</th>
                    <th className="text-right px-4 py-3 text-fg/50">Precio</th>
                    <th className="text-center px-4 py-3 text-fg/50">Tipo</th>
                    <th className="text-center px-4 py-3 text-fg/50">Stock</th>
                    <th className="text-center px-4 py-3 text-fg/50">Estado</th>
                    <th className="text-center px-4 py-3 text-fg/50">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((product) => (
                    <tr key={product.id} className={`border-b border-line/50 last:border-0 hover:bg-white/[0.03] transition-colors ${!product.active ? "opacity-50" : ""}`}>
                      {/* Nombre */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {product.image_url && (
                            <img src={product.image_url} alt={product.name}
                              className="w-8 h-8 rounded object-cover border border-line shrink-0" />
                          )}
                          <div>
                            <span className="font-semibold text-fg">{product.name}</span>
                            <p className="text-xs text-fg/40">IVA {product.iva_rate}%</p>
                          </div>
                        </div>
                      </td>
                      {/* Descripción */}
                      <td className="px-4 py-3 text-fg/50 text-xs hidden sm:table-cell max-w-[180px] truncate">
                        {product.description ?? "—"}
                      </td>
                      {/* Precio */}
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        ${product.price.toFixed(2)}
                      </td>
                      {/* Tipo/Categoría */}
                      <td className="px-4 py-3 text-center">
                        {product.category ? (
                          <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${CAT_COLORS[product.category] ?? "bg-white/15 text-fg/70"}`}>
                            {CATEGORIES[product.category] ?? product.category}
                          </span>
                        ) : (
                          <span className="text-fg/30 text-xs">—</span>
                        )}
                      </td>
                      {/* Stock */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            disabled={stockPending || product.stock <= 0}
                            onClick={() => startStock(async () => { await adjustStock(product.id, -1); })}
                            className="w-6 h-6 rounded border border-line text-fg/50 hover:text-fg hover:border-accent transition-colors text-sm disabled:opacity-30 flex items-center justify-center"
                          >−</button>
                          <span className={`w-8 text-center font-semibold text-sm ${product.stock === 0 ? "text-red-400" : product.stock <= 3 ? "text-amber-400" : "text-fg"}`}>
                            {product.stock}
                          </span>
                          <button
                            disabled={stockPending}
                            onClick={() => startStock(async () => { await adjustStock(product.id, 1); })}
                            className="w-6 h-6 rounded border border-line text-fg/50 hover:text-fg hover:border-accent transition-colors text-sm flex items-center justify-center"
                          >+</button>
                        </div>
                      </td>
                      {/* Estado */}
                      <td className="px-4 py-3 text-center">
                        <button
                          disabled={togglePending}
                          onClick={() =>
                            startToggle(async () => {
                              try {
                                await toggleProductActive(product.id, product.active);
                                toast.success(product.active ? "Producto desactivado" : "Producto activado");
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Error");
                              }
                            })
                          }
                          title="Clic para cambiar estado"
                          className="disabled:opacity-50"
                        >
                          <EstadoBadge active={product.active} />
                        </button>
                      </td>
                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <EditarBtn onClick={() => openEdit(product)} />
                          <EliminarBtn onClick={() => doDelete(product.id)} pending={deletePending} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-line text-xs text-fg/50">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                  className="bg-white/10 border border-line rounded px-2 py-0.5 text-fg text-xs outline-none">
                  {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span>{total === 0 ? "0" : `${cp * rowsPerPage + 1}–${Math.min((cp + 1) * rowsPerPage, total)}`} of {total}</span>
                <button disabled={cp === 0} onClick={() => setPage((p) => p - 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-line disabled:opacity-30 hover:border-fg/40 hover:text-fg transition-colors">‹</button>
                <button disabled={cp >= pageCount - 1} onClick={() => setPage((p) => p + 1)}
                  className="w-6 h-6 flex items-center justify-center rounded border border-line disabled:opacity-30 hover:border-fg/40 hover:text-fg transition-colors">›</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────

export default function ProductosClient({ plans, products }: Props) {
  return (
    <div className="space-y-12">
      {/* Divider top */}
      <PlanesSection plans={plans} />

      <div className="border-t border-line/40 pt-8">
        <ProductosSection products={products} />
      </div>
    </div>
  );
}
