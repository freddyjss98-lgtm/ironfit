import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Choice } from '@/components/choice';
import { Screen } from '@/components/screen';
import { currentPace, summarize } from '@/features/gps/geo';
import {
  clearRecording,
  elapsedMs,
  finishRecording,
  pauseRecording,
  resumeRecording,
  resumeTrackingIfNeeded,
  startRecording,
} from '@/features/gps/recorder';
import { RouteSvg } from '@/features/gps/route-svg';
import { useRecording } from '@/features/gps/use-recording';
import { fmtClock, GPS_SPORTS, sportEmoji, sportLabel, type Sport } from '@/features/sports/sports';
import { Locked } from '@/features/training/locked';
import { useActiveMembership } from '@/features/training/use-active';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius, space } from '@/theme';

// Grabar una actividad con el GPS: elegir deporte → Empezar → Pausar /
// Reanudar → Terminar (pasa a /deportes/guardar). Se puede salir de la
// pantalla o apagarla: la grabación sigue.
export default function RecordScreen() {
  const { member } = useAuth();
  const router = useRouter();
  const active = useActiveMembership(member!.id);
  const { rec, now } = useRecording();
  const { width } = useWindowDimensions();
  const [sport, setSport] = useState<Sport | ''>('run');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    resumeTrackingIfNeeded();
  }, []);

  useEffect(() => {
    if (rec?.status === 'finished') router.replace('/deportes/guardar');
  }, [rec?.status, router]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('No se pudo', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  if (active.data === false) {
    return (
      <Screen>
        <Locked what="Grabar actividades con GPS" />
      </Screen>
    );
  }
  if (rec === undefined) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (!rec) {
    return (
      <Screen>
        <Choice<Sport>
          label="¿Qué vas a hacer?"
          value={sport}
          onChange={setSport}
          columns={3}
          options={GPS_SPORTS.map((s) => ({ value: s.key, label: `${s.emoji} ${s.label}` }))}
        />
        <Card style={styles.tips}>
          <Text style={styles.tip}>📍 Sal a un lugar abierto y espera unos segundos a que el GPS tome señal.</Text>
          <Text style={styles.tip}>📱 Puedes bloquear el teléfono y guardarlo: la grabación sigue.</Text>
          <Text style={styles.tip}>🔒 Al compartir, se ocultan los primeros y últimos 200 m de tu ruta.</Text>
        </Card>
        <Button label="Empezar" disabled={!sport} loading={busy} onPress={() => sport && run(() => startRecording(sport))} />
      </Screen>
    );
  }

  const stats = summarize(rec.points);
  const seconds = elapsedMs(rec, now) / 1000;
  // Ritmo de los últimos 30 s mientras se mueve; si no, el promedio (s/km).
  const live = rec.status === 'recording' ? currentPace(rec.points, now) : null;
  const paceSecs = live ?? (stats.distance_m >= 100 ? seconds / (stats.distance_m / 1000) : null);
  const km = (stats.distance_m / 1000).toFixed(2);
  // Con un solo punto todavía no hay línea que dibujar.
  const waiting = rec.points.length < 2;
  const routeW = Math.min(width - space.xl * 2, 420);

  function confirmFinish() {
    if (stats.distance_m < 50 && seconds < 60) {
      Alert.alert('Muy corta', 'Todavía no hay suficiente recorrido. ¿Descartar la grabación?', [
        { text: 'Seguir', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => run(clearRecording) },
      ]);
      return;
    }
    run(finishRecording);
  }

  function confirmDiscard() {
    Alert.alert('Descartar actividad', 'Se borra lo grabado. No se puede deshacer.', [
      { text: 'No', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => run(clearRecording) },
    ]);
  }

  return (
    <Screen>
      <Text style={styles.sport}>
        {sportEmoji(rec.sport)} {sportLabel(rec.sport)}
        {rec.status === 'paused' ? ' · EN PAUSA' : ''}
      </Text>

      <View style={styles.center}>
        <Text style={styles.clock}>{fmtClock(seconds)}</Text>
        <Text style={styles.unit}>Tiempo</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.metric}>
          <Text style={styles.value}>{km}</Text>
          <Text style={styles.unit}>km</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.value}>{!paceSecs ? '—' : rec.sport === 'bike' ? (3600 / paceSecs).toFixed(1) : fmtClock(paceSecs)}</Text>
          <Text style={styles.unit}>{rec.sport === 'bike' ? 'km/h' : 'ritmo /km'}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.value}>{stats.elevation_m}</Text>
          <Text style={styles.unit}>m desnivel</Text>
        </View>
      </View>

      <View style={[styles.route, { height: 220 }]}>
        {waiting ? (
          <View style={styles.waiting}>
            {rec.status === 'recording' && <ActivityIndicator color={colors.accent} />}
            <Text style={styles.waitingText}>
              {rec.status === 'paused'
                ? 'En pausa'
                : rec.lastAccuracy != null
                  ? `Buscando señal GPS… (±${Math.round(rec.lastAccuracy)} m)`
                  : 'Buscando señal GPS…'}
            </Text>
          </View>
        ) : (
          <RouteSvg points={rec.points.map((p) => [p.lat, p.lng])} width={routeW} height={220} />
        )}
      </View>

      {rec.status === 'recording' ? (
        <Button label="Pausar" variant="secondary" loading={busy} onPress={() => run(pauseRecording)} />
      ) : (
        <>
          <Button label="Reanudar" loading={busy} onPress={() => run(resumeRecording)} />
          <Button label="Terminar" variant="secondary" disabled={busy} onPress={confirmFinish} />
          <Button label="Descartar" variant="ghost" disabled={busy} onPress={confirmDiscard} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tips: { gap: space.sm },
  tip: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fgDim },
  sport: { fontFamily: fonts.cond, fontSize: 16, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, textAlign: 'center' },
  center: { alignItems: 'center' },
  clock: { fontFamily: fonts.display, fontSize: 72, lineHeight: 80, color: colors.fg },
  row: { flexDirection: 'row' },
  metric: { flex: 1, alignItems: 'center' },
  value: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.fg },
  unit: { fontFamily: fonts.condSemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.fgMute },
  route: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  waiting: { alignItems: 'center', gap: space.sm },
  waitingText: { fontFamily: fonts.body, fontSize: 13, color: colors.fgDim },
});
