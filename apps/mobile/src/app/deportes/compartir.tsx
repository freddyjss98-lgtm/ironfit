import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { ActivityCard } from '@/features/sports/activity-card';
import { useActivities } from '@/features/sports/use-activities';
import { useAuth } from '@/lib/auth';
import { useCardExport } from '@/lib/card-export';
import { ecuadorDateOf } from '@/lib/dates';
import { colors, fonts, radius, space } from '@/theme';

const DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function dateLabel(iso: string) {
  const [y, m, d] = ecuadorDateOf(iso).split('-').map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

// Tarjeta sin fondo de una actividad para la historia de Instagram.
export default function ShareActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member } = useAuth();
  const router = useRouter();
  const activities = useActivities(member!.id);
  const cardRef = useRef<View>(null);
  const [showRoute, setShowRoute] = useState(true);
  const { busy, save, copy, share } = useCardExport(cardRef, 'Compartir mi actividad');

  if (activities.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  const activity = activities.data?.find((a) => a.id === id);
  if (!activity) {
    return (
      <Screen>
        <Notice message="No encontramos esa actividad." />
      </Screen>
    );
  }

  return (
    <Screen>
      {/* El gris es solo para ver la tarjeta: la imagen sale sin fondo. */}
      <View style={styles.preview}>
        <ActivityCard ref={cardRef} activity={activity} dateLabel={dateLabel(activity.started_at)} showRoute={showRoute} />
      </View>
      <Text style={styles.note}>La imagen se guarda sin fondo para ponerla encima de tu foto.</Text>

      {activity.route_polyline && (
        <Card style={styles.option}>
          <Text style={styles.optionText}>Mostrar la ruta</Text>
          <Switch value={showRoute} onValueChange={setShowRoute} trackColor={{ true: colors.accent, false: colors.line2 }} thumbColor="#fff" />
        </Card>
      )}

      <Button label="Guardar en fotos" onPress={save} loading={busy === 'save'} disabled={!!busy} />
      <Button label="Copiar para pegar en mi historia" variant="secondary" onPress={copy} loading={busy === 'copy'} disabled={!!busy} />
      <Button label="Compartir…" variant="ghost" onPress={share} loading={busy === 'share'} disabled={!!busy} />
      <Button label="Listo" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a3a3a',
    borderRadius: radius.lg,
    paddingVertical: space.lg,
  },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, textAlign: 'center', marginTop: -space.sm },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { fontFamily: fonts.body, fontSize: 14, color: colors.fgDim },
});
