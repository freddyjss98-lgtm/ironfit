"use client";

import { useState, useTransition } from "react";
import { createProduct, updateProduct, adjustStock, toggleProductActive } from "./actions";
import { toast } from "sonner";

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  stock: number;
  active: boolean;
};

type Props = { products: Product[] };

const CATEGORIES: Record<string, string> = {
  supplement: "Suplemento",
  apparel: "Ropa",
  accessory: "Accesorio",
  other: "Otro",
};

const CAT_COLORS: Record<string, string> = {
  supplement: "bg-blue-500/15 text-blue-400",
  apparel: "bg-purple-500/15 text-purple-400",
  accessory: "bg-amber-500/15 text-amber-400",
  other: "bg-white/10 text-fg/40",
};

const inputCls =
  "w-full bg-white/5 border border-white/15 text-fg rounded-lg px-3 py-2 text-sm outline-none focus:border-accent transition-colors placeholder:text-fg/20";
const labelCls = "text-fg/50 text-xs uppercase tracking-wider";

function ProductForm({ product, onClose }: { product?: Product; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        if (product) await updateProduct(product.id, fd);
        else await createProduct(fd);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Nombre del producto *</label>
          <input
            name="name"
            required
            defaultValue={product?.name}
            className={inputCls}
            placeholder="Ej. Proteína Whey 1kg"
          />
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
          <label className={labelCls}>Precio (USD) *</label>
          <input
            name="price"
            type="number"
            required
            min="0"
            step="0.01"
            defaultValue={product?.price}
            className={inputCls}
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Stock inicial</label>
          <input
            name="stock"
            type="number"
            min="0"
            defaultValue={product?.stock ?? 0}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Descripción</label>
          <input
            name="description"
            defaultValue={product?.description ?? ""}
            className={inputCls}
            placeholder="Opcional"
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-fg/50 hover:text-fg border border-line rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {pending ? "Guardando..." : product ? "Actualizar" : "Crear producto"}
        </button>
      </div>
    </form>
  );
}

function ToggleActiveButton({ product }: { product: Product }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          try {
            await toggleProductActive(product.id, product.active);
            toast.success(product.active ? "Producto desactivado" : "Producto activado");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error");
          }
        })
      }
      disabled={pending}
      className={`text-xs border px-2.5 py-1 rounded transition-colors disabled:opacity-50 ${
        product.active
          ? "border-line text-fg/40 hover:text-red-400 hover:border-red-500/40"
          : "border-emerald-500/30 text-emerald-400/60 hover:text-emerald-400"
      }`}
    >
      {pending ? "..." : product.active ? "Desactivar" : "Activar"}
    </button>
  );
}

function StockControl({ product }: { product: Product }) {
  const [pending, startTransition] = useTransition();

  function adjust(delta: number) {
    startTransition(async () => {
      await adjustStock(product.id, delta);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => adjust(-1)}
        disabled={pending || product.stock <= 0}
        className="w-6 h-6 rounded border border-line text-fg/50 hover:text-fg hover:border-accent transition-colors text-sm disabled:opacity-30 flex items-center justify-center"
      >
        −
      </button>
      <span
        className={`w-8 text-center text-sm font-semibold ${
          product.stock === 0
            ? "text-red-400"
            : product.stock <= 3
              ? "text-amber-400"
              : "text-fg"
        }`}
      >
        {product.stock}
      </span>
      <button
        onClick={() => adjust(1)}
        disabled={pending}
        className="w-6 h-6 rounded border border-line text-fg/50 hover:text-fg hover:border-accent transition-colors text-sm flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
}

export default function TiendaClient({ products }: Props) {
  const [modal, setModal] = useState<{ product?: Product } | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const filtered = products.filter((p) => {
    if (filter === "all") return true;
    if (filter === "low") return p.stock <= 3 && p.active;
    if (filter === "inactive") return !p.active;
    return p.category === filter;
  });

  const lowStock = products.filter((p) => p.stock <= 3 && p.active).length;

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${filter === "all" ? "bg-accent text-white border-accent" : "border-line text-fg/50 hover:text-fg"}`}
          >
            Todos
          </button>
          {Object.entries(CATEGORIES).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${filter === v ? "bg-accent text-white border-accent" : "border-line text-fg/50 hover:text-fg"}`}
            >
              {l}
            </button>
          ))}
          {lowStock > 0 && (
            <button
              onClick={() => setFilter("low")}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1 ${filter === "low" ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "border-amber-500/30 text-amber-400/60 hover:text-amber-400"}`}
            >
              Stock bajo
              <span className="bg-amber-500/20 px-1.5 rounded">{lowStock}</span>
            </button>
          )}
        </div>

        <button
          onClick={() => setModal({})}
          className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Producto
        </button>
      </div>

      <div className="bg-white/5 border border-line rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-fg/40 text-sm text-center py-12">Sin productos</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-fg/40 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Producto</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Categoría</th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">Precio</th>
                  <th className="text-center px-4 py-3">Stock</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-line/50 last:border-0 hover:bg-white/5 transition-colors ${!p.active ? "opacity-40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.name}</p>
                      {p.description && (
                        <p className="text-fg/40 text-xs">{p.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {p.category ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${CAT_COLORS[p.category] ?? "bg-white/10 text-fg/40"}`}>
                          {CATEGORIES[p.category] ?? p.category}
                        </span>
                      ) : (
                        <span className="text-fg/30 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-right font-semibold">
                      ${p.price}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <StockControl product={p} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ToggleActiveButton product={p} />
                        <button
                          onClick={() => setModal({ product: p })}
                          className="text-xs text-fg/40 hover:text-fg border border-line px-2.5 py-1 rounded transition-colors"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-line rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg uppercase tracking-tight">
                {modal.product ? "Editar producto" : "Nuevo producto"}
              </h2>
              <button onClick={() => setModal(null)} className="text-fg/40 hover:text-fg text-xl leading-none">✕</button>
            </div>
            <ProductForm product={modal.product} onClose={() => setModal(null)} />
          </div>
        </div>
      )}
    </>
  );
}
