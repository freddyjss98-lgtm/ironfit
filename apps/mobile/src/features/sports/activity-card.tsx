// Tarjeta sin fondo de una actividad (estilo Strava): sello Iron Fit, la ruta
// en naranja y los datos grandes. Se captura como PNG transparente para
// pegarla encima de una foto en la historia de Instagram.

import { Image } from 'expo-image';
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { decodePolyline } from '@/features/gps/geo';
import { RouteSvg } from '@/features/gps/route-svg';
import { colors, fonts } from '@/theme';

import { fmtClock, fmtDistance, fmtPace, sportLabel } from './sports';
import type { Activity } from './use-activities';

const SEAL_RATIO = 1077 / 817;
const W = 340;

export const ActivityCard = forwardRef<View, { activity: Activity; dateLabel: string; showRoute: boolean }>(
  function ActivityCard({ activity: a, dateLabel, showRoute }, ref) {
    const route = showRoute && a.route_polyline ? decodePolyline(a.route_polyline) : [];
    const pace = fmtPace(a.sport, a.duration_seconds, a.distance_m);
    const stats = [
      { label: 'Tiempo', value: fmtClock(a.duration_seconds) },
      pace ? { label: a.sport === 'bike' ? 'Velocidad' : 'Ritmo', value: pace } : null,
      a.elevation_m ? { label: 'Desnivel', value: `${a.elevation_m} m` } : null,
      !a.distance_m && a.calories ? { label: 'Calorías', value: `${a.calories}` } : null,
    ].filter((s): s is { label: string; value: string } => !!s);

    return (
      // collapsable={false}: en Android la vista debe existir para capturarla.
      <View ref={ref} collapsable={false} style={styles.card}>
        <Image source={require('@/assets/images/sello.png')} style={{ width: 120, height: 120 / SEAL_RATIO }} contentFit="contain" />
        <Text style={styles.date}>
          {sportLabel(a.sport).toUpperCase()} · {dateLabel}
        </Text>
        {route.length > 1 && <RouteSvg points={route} width={W - 40} height={190} strokeWidth={5} outline />}
        {a.distance_m ? <Text style={styles.big}>{fmtDistance(a.distance_m, a.sport)}</Text> : null}
        <View style={styles.row}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }
);

const shadow = { textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 };

const styles = StyleSheet.create({
  card: { width: W, paddingVertical: 18, paddingHorizontal: 20, alignItems: 'center', backgroundColor: 'transparent', gap: 8 },
  date: { ...shadow, fontFamily: fonts.cond, fontSize: 15, letterSpacing: 3, color: '#fff' },
  big: { ...shadow, fontFamily: fonts.display, fontSize: 64, lineHeight: 72, color: colors.accent },
  row: { flexDirection: 'row', gap: 22, justifyContent: 'center' },
  stat: { alignItems: 'center' },
  statValue: { ...shadow, fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: '#fff' },
  statLabel: { ...shadow, fontFamily: fonts.condSemi, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fff' },
});
