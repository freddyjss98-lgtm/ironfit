// Aviso de que hay una grabación en curso (o terminada sin guardar), para
// volver a ella desde Progreso o Comunidad.

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { fmtClock, fmtDistance } from '@/features/sports/sports';
import { colors, fonts, radius, space } from '@/theme';

import { summarize } from './geo';
import { elapsedMs } from './recorder';
import { useRecording } from './use-recording';

export function RecordingBanner() {
  const router = useRouter();
  const { rec, now } = useRecording();
  if (!rec) return null;

  const finished = rec.status === 'finished';
  const km = fmtDistance(summarize(rec.points).distance_m, rec.sport) ?? '0 km';
  const text = finished
    ? 'Tienes una actividad grabada sin guardar'
    : `${rec.status === 'paused' ? '⏸ En pausa' : '● Grabando'} · ${fmtClock(elapsedMs(rec, now) / 1000)} · ${km}`;

  return (
    <Pressable
      onPress={() => router.push(finished ? '/deportes/guardar' : '/deportes/grabar')}
      accessibilityRole="button"
      style={({ pressed }) => [styles.box, pressed && { opacity: 0.8 }]}>
      <Text style={styles.text}>{text}</Text>
      <Text style={styles.action}>{finished ? 'Guardar ›' : 'Volver ›'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    backgroundColor: 'rgba(232,75,31,0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  text: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.fg },
  action: { fontFamily: fonts.cond, fontSize: 15, letterSpacing: 1, color: colors.accent },
});
