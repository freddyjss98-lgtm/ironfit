import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import type { PickedPhoto } from '@/features/community/photo';
import { ShareFields } from '@/features/community/share-fields';
import { routeForStorage, summarize } from '@/features/gps/geo';
import { clearRecording, elapsedMs } from '@/features/gps/recorder';
import { RouteSvg } from '@/features/gps/route-svg';
import { useRecording } from '@/features/gps/use-recording';
import { estimateCalories, fmtClock, fmtDistance, fmtPace, sportEmoji, sportLabel } from '@/features/sports/sports';
import { useLatestWeight, useLogActivity } from '@/features/sports/use-activities';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius, space } from '@/theme';

// Resumen de lo grabado con el GPS: comentario, compartir y guardar. Al
// guardar se ofrece la tarjeta sin fondo para Instagram.
export default function SaveRecordingScreen() {
  const { member, session } = useAuth();
  const memberId = member!.id;
  const router = useRouter();
  const { rec } = useRecording();
  const weight = useLatestWeight(memberId);
  const save = useLogActivity(memberId, session!.user.id);
  const { width } = useWindowDimensions();
  const [notes, setNotes] = useState('');
  const [share, setShare] = useState(false);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);

  if (rec === undefined) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  if (!rec || rec.status !== 'finished') {
    return (
      <Screen>
        <Notice message="No hay ninguna actividad grabada para guardar." />
        <Button label="Grabar una actividad" onPress={() => router.replace('/deportes/grabar')} />
      </Screen>
    );
  }

  const stats = summarize(rec.points);
  const seconds = Math.max(1, Math.round(elapsedMs(rec) / 1000));
  const calories = estimateCalories(rec.sport, seconds, stats.distance_m, weight.data ?? null);
  const pace = fmtPace(rec.sport, seconds, stats.distance_m);
  // Ancho útil dentro de la tarjeta (márgenes de la pantalla y de la tarjeta).
  const routeW = Math.min(width - space.xl * 2, 420) - space.lg * 2 - 2;

  function submit() {
    save.mutate(
      {
        sport: rec!.sport,
        started_at: new Date(rec!.startedAt).toISOString(),
        duration_seconds: seconds,
        distance_m: stats.distance_m,
        elevation_m: stats.elevation_m || null,
        calories,
        calories_estimated: calories != null,
        notes: notes.trim() || null,
        share,
        photo,
        gps: { route_polyline: routeForStorage(rec!.points) },
      },
      {
        onSuccess: async (r) => {
          await clearRecording();
          router.replace({ pathname: '/deportes/compartir', params: { id: r.activity_id } });
          if (r.completed.length) Alert.alert('¡Reto cumplido! 🏆', r.completed.map((t) => `• ${t}`).join('\n'));
        },
      }
    );
  }

  function discard() {
    Alert.alert('Descartar actividad', 'Se borra lo grabado. No se puede deshacer.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: async () => {
          await clearRecording();
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      {save.error && <Notice message={save.error.message} />}

      <Card style={styles.summary}>
        <Text style={styles.sport}>
          {sportEmoji(rec.sport)} {sportLabel(rec.sport)}
        </Text>
        <View style={styles.route}>
          <RouteSvg points={rec.points.map((p) => [p.lat, p.lng])} width={routeW} height={200} />
        </View>
        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.value}>{fmtDistance(stats.distance_m, rec.sport) ?? '0 km'}</Text>
            <Text style={styles.unit}>Distancia</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.value}>{fmtClock(seconds)}</Text>
            <Text style={styles.unit}>Tiempo</Text>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.value}>{pace ?? '—'}</Text>
            <Text style={styles.unit}>{rec.sport === 'bike' ? 'Velocidad' : 'Ritmo'}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.value}>{stats.elevation_m} m</Text>
            <Text style={styles.unit}>Desnivel</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.value}>{calories ?? '—'}</Text>
            <Text style={styles.unit}>kcal (est.)</Text>
          </View>
        </View>
      </Card>

      <TextField label="Comentario (opcional)" value={notes} onChangeText={setNotes} placeholder="Ej. ¡Nuevo récord en el Itchimbía!" maxLength={300} />
      <ShareFields share={share} onShare={setShare} photo={photo} onPhoto={setPhoto} />

      <Button label="Guardar actividad" onPress={submit} loading={save.isPending} />
      <Button label="Descartar" variant="ghost" disabled={save.isPending} onPress={discard} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: space.md },
  sport: { fontFamily: fonts.cond, fontSize: 16, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent },
  route: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  metric: { flex: 1, alignItems: 'center' },
  value: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.fg },
  unit: { fontFamily: fonts.condSemi, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.fgMute },
});
