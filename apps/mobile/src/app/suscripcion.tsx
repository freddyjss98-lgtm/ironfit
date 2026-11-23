import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { Body, Title } from '@/components/text';
import { INCLUDED, ONLINE_NAME, PLANS, subscriptionLine, TRIAL_DAYS } from '@/features/online/plans';
import { useAppAccess } from '@/features/training/use-active';
import { useAuth } from '@/lib/auth';
import { WEB_URL } from '@/lib/config';
import { colors, fonts, radius, space } from '@/theme';

type PlanId = (typeof PLANS)[number]['id'];

// Planes de Iron Fit Online. El cobro (Apple / Google vía RevenueCat) se
// conecta en el Bloque 2; aquí ya están los textos y avisos que piden las
// tiendas para una suscripción que se renueva sola.
export default function SubscriptionScreen() {
  const { member } = useAuth();
  const access = useAppAccess(member!.id);
  const [plan, setPlan] = useState<PlanId>('monthly');
  const chosen = PLANS.find((p) => p.id === plan)!;
  const line = subscriptionLine(access.data?.subscription ?? null);

  function subscribe() {
    Alert.alert('Muy pronto', 'La suscripción estará disponible en la próxima actualización de la app.');
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Membresía digital</Text>
        <Title>{ONLINE_NAME}</Title>
        <Body dim>Entrena con la programación de Iron Fit estés donde estés.</Body>
      </View>

      {access.data?.gym && (
        <Notice tone="ok" message="Ya tienes todo incluido con tu membresía del gimnasio. No necesitas suscribirte." />
      )}
      {line && <Notice tone={access.data?.subscription?.status === 'billing_issue' ? 'error' : 'ok'} message={line} />}

      <Card style={styles.list}>
        {INCLUDED.map((i) => (
          <View key={i.text} style={styles.item}>
            <Text style={styles.icon}>{i.icon}</Text>
            <Text style={styles.itemText}>{i.text}</Text>
          </View>
        ))}
      </Card>

      {!line && !access.data?.gym && (
        <>
          <View style={styles.plans}>
            {PLANS.map((p) => {
              const selected = p.id === plan;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPlan(p.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.plan, selected && styles.planSelected]}>
                  {p.note && <Text style={styles.planNote}>{p.note}</Text>}
                  <Text style={styles.planLabel}>{p.label}</Text>
                  <Text style={styles.planPrice}>{p.price}</Text>
                  <Text style={styles.planPer}>{p.per}</Text>
                </Pressable>
              );
            })}
          </View>

          <Button label={`Probar ${TRIAL_DAYS} días gratis`} onPress={subscribe} />
          <Text style={styles.fine}>
            {TRIAL_DAYS} días gratis y luego {chosen.price} {chosen.per}. La suscripción se renueva sola hasta que la
            canceles desde tu cuenta de la tienda, al menos 24 horas antes de que termine el periodo. Si cancelas
            durante la prueba no se te cobra nada.
          </Text>
        </>
      )}

      <View style={styles.links}>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terminos`)} hitSlop={8}>
          <Text style={styles.link}>Términos de uso</Text>
        </Pressable>
        <Text style={styles.dot}>·</Text>
        <Pressable onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacidad`)} hitSlop={8}>
          <Text style={styles.link}>Privacidad</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.xs },
  kicker: { fontFamily: fonts.condSemi, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent },
  list: { gap: space.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { fontSize: 20, width: 28, textAlign: 'center' },
  itemText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fg },
  plans: { flexDirection: 'row', gap: space.md },
  plan: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.lg,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  planSelected: { borderColor: colors.accent, backgroundColor: 'rgba(232,75,31,0.08)' },
  planNote: { fontFamily: fonts.condSemi, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.accent },
  planLabel: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.fg },
  planPrice: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.fg },
  planPer: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute },
  fine: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.fgMute, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  link: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.fgDim, textDecorationLine: 'underline' },
  dot: { color: colors.fgMute },
});
