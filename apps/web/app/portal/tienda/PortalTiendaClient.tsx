"use client";

import { useState, useMemo } from "react";

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  stock: number;
};

type Props = {
  products: Product[];
  memberName: string | null;
  whatsappNumber: string;
};

const CATEGORIES: Record<string, string> = {
  supplement: "Suplementos",
  apparel: "Ropa",
  accessory: "Accesorios",
  other: "Otros",
};

const WA_ICON = (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M12 0C5.373 0 0 5.373 0 12c0 2.128.558 4.121 1.532 5.847L.063 23.25l5.595-1.468A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.887 9.887 0 01-5.031-1.378l-.36-.214-3.742.981.998-3.648-.235-.374A9.86 9.86 0 012.106 12C2.106 6.58 6.58 2.106 12 2.106c5.421 0 9.894 4.474 9.894 9.894 0 5.421-4.473 9.894-9.894 9.894z" />
  </svg>
);

export default function PortalTiendaClient({ products, memberName, whatsappNumber }: Props) {
  const [cart, setCart] = useState<Record<string, number>>({});

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const p = products.find((p) => p.id === id)!;
          return { ...p, qty };
        }),
    [cart, products]
  );

  const cartTotal = cartItems.reduce((sum, i) => sum + i.qty * i.price, 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);

  function add(id: string) {
    const p = products.find((p) => p.id === id);
    if (!p) return;
    setCart((prev) => {
      const current = prev[id] ?? 0;
      if (current >= p.stock) return prev;
      return { ...prev, [id]: current + 1 };
    });
  }

  function remove(id: string) {
    setCart((prev) => {
      const current = prev[id] ?? 0;
      if (current <= 0) return prev;
      const next = { ...prev, [id]: current - 1 };
      if (next[id] === 0) delete next[id];
      return next;
    });
  }

  const waUrl = useMemo(() => {
    const lines = cartItems.map(
      (i) => `• ${i.name} × ${i.qty} — $${(i.qty * i.price).toFixed(2)}`
    );
    const intro = memberName
      ? `Hola Iron Fit! Soy *${memberName}* y me gustaría hacer el siguiente pedido:`
      : "Hola Iron Fit! Me gustaría hacer el siguiente pedido:";
    const msg = [
      intro,
      "",
      ...lines,
      "",
      `Total estimado: *$${cartTotal.toFixed(2)}*`,
      "",
      "¿Pueden confirmarme disponibilidad y coordinar el pago?",
    ].join("\n");
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
  }, [cartItems, cartTotal, memberName, whatsappNumber]);

  // Agrupar por categoría
  const byCategory = useMemo(() => {
    const map: Record<string, Product[]> = {};
    for (const p of products) {
      const cat = p.category ?? "other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }
    return map;
  }, [products]);

  const hasProducts = products.length > 0;

  return (
    <div className={cartCount > 0 ? "space-y-8 pb-32" : "space-y-8"}>
      <div>
        <h1 className="font-display text-3xl uppercase tracking-tight">Tienda</h1>
        <p className="text-fg/40 text-sm mt-1">
          Agrega al carrito y coordina tu pedido por WhatsApp.
        </p>
      </div>

      {!hasProducts && (
        <div className="bg-white/5 border border-line rounded-xl px-5 py-12 text-center text-fg/40 text-sm">
          Próximamente habrá productos disponibles.
        </div>
      )}

      {Object.entries(byCategory).map(([cat, items]) => (
        <section key={cat}>
          <h2 className="text-fg/50 text-xs uppercase tracking-widest mb-4">
            {CATEGORIES[cat] ?? cat}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className={`bg-white/5 border rounded-xl p-5 flex flex-col gap-3 transition-colors ${
                    qty > 0 ? "border-accent/40" : "border-line"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{p.name}</p>
                      {p.description && (
                        <p className="text-fg/40 text-sm mt-0.5">{p.description}</p>
                      )}
                    </div>
                    <p className="text-xl font-display font-bold text-accent shrink-0">
                      ${p.price}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-auto pt-2 border-t border-line/50">
                    <p className="text-fg/30 text-xs">
                      Stock:{" "}
                      <span className={p.stock <= 3 ? "text-amber-400" : "text-fg/50"}>
                        {p.stock} disponibles
                      </span>
                    </p>

                    {qty === 0 ? (
                      <button
                        onClick={() => add(p.id)}
                        className="px-3 py-1.5 bg-accent hover:bg-accent/80 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        Agregar
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => remove(p.id)}
                          className="w-7 h-7 rounded border border-line text-fg/50 hover:text-fg hover:border-accent transition-colors flex items-center justify-center text-lg"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-accent tabular-nums">
                          {qty}
                        </span>
                        <button
                          onClick={() => add(p.id)}
                          disabled={qty >= p.stock}
                          className="w-7 h-7 rounded border border-line text-fg/50 hover:text-fg hover:border-accent transition-colors flex items-center justify-center text-lg disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Barra flotante del carrito */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-line">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-fg/40 text-xs">
                {cartCount} {cartCount === 1 ? "producto" : "productos"} en el carrito
              </p>
              <p className="font-display text-lg font-bold text-accent tabular-nums">
                ${cartTotal.toFixed(2)}
              </p>
            </div>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold py-3 px-5 rounded-xl transition-colors text-sm shrink-0"
            >
              {WA_ICON}
              Pedir por WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
