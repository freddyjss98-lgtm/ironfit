import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card, SectionLabel } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { Body } from '@/components/text';
import { useAuth } from '@/lib/auth';
import { GYM_WHATSAPP } from '@/lib/config';
import { fmtMoney } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, fonts, radius, space } from '@/theme';

type Product = { id: string; name: string; description: string | null; category: string | null; price: number; stock: number };

const CATEGORIES: Record<string, string> = {
  supplement: 'Suplementos',
  apparel: 'Ropa',
  accessory: 'Accesorios',
  other: 'Otros',
};

// Igual que /portal/tienda: catálogo y carrito; el pedido se coordina por WhatsApp.
export default function StoreScreen() {
  const { member } = useAuth();
  const [cart, setCart] = useState<Record<string, number>>({});
  const products = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, category, price, stock')
        .eq('active', true)
        .gt('stock', 0)
        .order('category')
        .order('name');
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, price: Number(p.price), stock: Number(p.stock) })) as Product[];
    },
  });

  if (products.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  if (products.isError) {
    return (
      <Screen>
        <Notice message="No pudimos cargar la tienda. Revisa tu conexión." />
        <Button label="Reintentar" variant="secondary" onPress={() => products.refetch()} />
      </Screen>
    );
  }

  const list = products.data;
  const items = list.filter((p) => (cart[p.id] ?? 0) > 0).map((p) => ({ ...p, qty: cart[p.id] }));
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const byCategory: Record<string, Product[]> = {};
  for (const p of list) (byCategory[p.category ?? 'other'] ??= []).push(p);

  const change = (p: Product, delta: number) =>
    setCart((prev) => {
      const next = Math.max(0, Math.min(p.stock, (prev[p.id] ?? 0) + delta));
      const copy = { ...prev, [p.id]: next };
      if (next === 0) delete copy[p.id];
      return copy;
    });

  function order() {
    const msg = [
      `Hola Iron Fit! Soy *${member!.full_name}* y me gustaría hacer el siguiente pedido:`,
      '',
      ...items.map((i) => `• ${i.name} × ${i.qty} — ${fmtMoney(i.qty * i.price)}`),
      '',
      `Total estimado: *${fmtMoney(total)}*`,
      '',
      '¿Pueden confirmarme disponibilidad y coordinar el pago?',
    ].join('\n');
    Linking.openURL(`https://wa.me/${GYM_WHATSAPP}?text=${encodeURIComponent(msg)}`);
  }

  return (
    <View style={styles.flex}>
      <Screen onRefresh={() => products.refetch()} refreshing={products.isRefetching}>
        <Body dim>Agrega al carrito y coordina tu pedido por WhatsApp.</Body>
        {list.length === 0 && (
          <Card>
            <Text style={styles.empty}>Próximamente habrá productos disponibles.</Text>
          </Card>
        )}
        {Object.entries(byCategory).map(([cat, prods]) => (
          <View key={cat} style={styles.section}>
            <SectionLabel>{CATEGORIES[cat] ?? cat}</SectionLabel>
            {prods.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <Card key={p.id} style={qty > 0 ? [styles.product, styles.productActive] : styles.product}>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Text style={styles.name}>{p.name}</Text>
                      {p.description ? <Text style={styles.desc}>{p.description}</Text> : null}
                    </View>
                    <Text style={styles.price}>{fmtMoney(p.price)}</Text>
                  </View>
                  <View style={[styles.row, styles.footer]}>
                    <Text style={styles.stock}>
                      Stock: <Text style={{ color: p.stock <= 3 ? '#fbbf24' : colors.fgDim }}>{p.stock} disponibles</Text>
                    </Text>
                    {qty === 0 ? (
                      <Pressable onPress={() => change(p, 1)} style={styles.add} accessibilityRole="button">
                        <Text style={styles.addText}>Agregar</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.qtyRow}>
                        <Pressable onPress={() => change(p, -1)} style={styles.qtyBtn} accessibilityLabel={`Quitar ${p.name}`}>
                          <Text style={styles.qtyBtnText}>−</Text>
                        </Pressable>
                        <Text style={styles.qty}>{qty}</Text>
                        <Pressable
                          onPress={() => change(p, 1)}
                          disabled={qty >= p.stock}
                          style={[styles.qtyBtn, qty >= p.stock && styles.off]}
                          accessibilityLabel={`Agregar otro ${p.name}`}>
                          <Text style={styles.qtyBtnText}>+</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        ))}
        {count > 0 && <View style={styles.spacer} />}
      </Screen>

      {count > 0 && (
        <SafeAreaView edges={['bottom']} style={styles.cartBar}>
          <View style={styles.flex}>
            <Text style={styles.cartCount}>
              {count} {count === 1 ? 'producto' : 'productos'} en el carrito
            </Text>
            <Text style={styles.cartTotal}>{fmtMoney(total)}</Text>
          </View>
          <Pressable onPress={order} style={styles.wa} accessibilityRole="button">
            <Text style={styles.waText}>Pedir por WhatsApp</Text>
          </Pressable>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  section: { gap: space.sm },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.fgMute, textAlign: 'center', paddingVertical: space.xl },
  product: { gap: space.md },
  productActive: { borderColor: 'rgba(232,75,31,0.4)' },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.fg },
  desc: { fontFamily: fonts.body, fontSize: 13, color: colors.fgDim, marginTop: 2 },
  price: { fontFamily: fonts.display, fontSize: 20, color: colors.accent },
  footer: { borderTopWidth: 1, borderTopColor: 'rgba(36,36,36,0.5)', paddingTop: space.sm },
  stock: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute },
  add: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 6 },
  addText: { fontFamily: fonts.bodySemi, fontSize: 13, color: '#fff' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  qtyBtn: { width: 32, height: 32, borderRadius: 6, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontFamily: fonts.bodySemi, fontSize: 18, color: colors.fg },
  off: { opacity: 0.3 },
  qty: { minWidth: 20, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 15, color: colors.accent },
  spacer: { height: 80 },
  cartBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    backgroundColor: 'rgba(10,10,10,0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  cartCount: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute },
  cartTotal: { fontFamily: fonts.display, fontSize: 20, color: colors.accent },
  wa: { backgroundColor: '#25D366', borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  waText: { fontFamily: fonts.bodySemi, fontSize: 14, color: '#fff' },
});
