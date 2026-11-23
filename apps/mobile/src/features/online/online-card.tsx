import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import type { AppAccess } from '@/features/training/use-active';
import { colors, fonts, radius, space } from '@/theme';

import { ONLINE_NAME, PLANS, subscriptionLine, TRIAL_DAYS } from './plans';

/** Tarjeta del inicio para la membresía digital: estado o invitación. */
export function OnlineCard({ access }: { access: AppAccess }) {
  const router = useRouter();
  const line = subscriptionLine(access.subscription);
  const open = () => router.push('/suscripcion');

  if (line) {
    return (
      <Pressable onPress={open} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
        <Text style={styles.kicker}>Membresía digital</Text>
        <Text style={styles.title}>{ONLINE_NAME}</Text>
        <Text style={[styles.text, access.subscription?.status === 'billing_issue' && styles.warn]}>{line}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, styles.invite]}>
      <Text style={styles.kicker}>Membresía digital</Text>
      <Text style={styles.title}>{ONLINE_NAME}</Text>
      <Text style={styles.text}>
        El WOD de cada día y todas las herramientas del box por {PLANS[0].price} {PLANS[0].per}. Pruébalo {TRIAL_DAYS} días
        gratis.
      </Text>
      <View style={styles.action}>
        <Button label="Ver planes" onPress={open} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  invite: { borderColor: 'rgba(232,75,31,0.35)', backgroundColor: 'rgba(232,75,31,0.06)' },
  kicker: { fontFamily: fonts.condSemi, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.fg },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fgDim },
  warn: { color: colors.danger },
  action: { marginTop: space.sm },
});
