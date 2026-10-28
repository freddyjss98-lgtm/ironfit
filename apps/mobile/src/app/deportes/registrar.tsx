import { todayInEcuador } from '@ironfit/shared/date';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Choice } from '@/components/choice';
import { DateField } from '@/components/date-field';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import type { PickedPhoto } from '@/features/community/photo';
import { ShareFields } from '@/features/community/share-fields';
import { estimateCalories, fmtPace, parseDecimal, SPORTS, type Sport } from '@/features/sports/sports';
import { useLatestWeight, useLogActivity } from '@/features/sports/use-activities';
import { Locked } from '@/features/training/locked';
import { useActiveMembership } from '@/features/training/use-active';
import { useAuth } from '@/lib/auth';
import { colors, fonts, space } from '@/theme';

const int = (raw: string) => {
  const t = raw.trim();
  return t === '' ? 0 : Number(t);
};

// Registro a mano de una actividad fuera del box. Lo único obligatorio es el
// deporte y el tiempo; si cumple un reto vigente, el reto se marca solo.
export default function LogActivityScreen() {
  const { member, session } = useAuth();
  const memberId = member!.id;
  const router = useRouter();
  const active = useActiveMembership(memberId);
  const weight = useLatestWeight(memberId);
  const save = useLogActivity(memberId, session!.user.id);

  const today = todayInEcuador();
  const [sport, setSport] = useState<Sport | ''>('');
  const [date, setDate] = useState(today);
  const [h, setH] = useState('');
  const [min, setMin] = useState('');
  const [sec, setSec] = useState('');
  const [distance, setDistance] = useState('');
  const [elevation, setElevation] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [share, setShare] = useState(false);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (active.data === false) {
    return (
      <Screen>
        <Locked what="Registrar actividades" />
      </Screen>
    );
  }

  const swim = sport === 'swim';
  const seconds = int(h) * 3600 + int(min) * 60 + int(sec);
  const distNum = parseDecimal(distance);
  const meters = distNum == null || !Number.isFinite(distNum) ? null : Math.round(swim ? distNum : distNum * 1000);
  const estimate = sport && Number.isFinite(seconds) ? estimateCalories(sport, seconds, meters, weight.data ?? null) : null;
  const pace = sport && Number.isFinite(seconds) ? fmtPace(sport, seconds, meters) : null;

  function submit() {
    setError(null);
    if (!sport) return setError('Elige el deporte.');
    if (!Number.isFinite(seconds) || seconds <= 0) return setError('Escribe cuánto tiempo duró.');
    if (distNum != null && (!Number.isFinite(distNum) || distNum < 0)) return setError('La distancia debe ser un número.');
    const elev = elevation.trim() === '' ? null : Number(elevation.trim());
    if (elev != null && (!Number.isInteger(elev) || elev < 0)) return setError('El desnivel debe ser un número entero de metros.');
    const kcalTyped = calories.trim() === '' ? null : Number(calories.trim());
    if (kcalTyped != null && (!Number.isFinite(kcalTyped) || kcalTyped < 0)) return setError('Las calorías deben ser un número.');

    // Hoy: terminó hace un momento. Otro día: al mediodía (solo importa la fecha).
    const startedAt = date === today ? new Date(Date.now() - seconds * 1000).toISOString() : `${date}T12:00:00-05:00`;

    save.mutate(
      {
        sport,
        started_at: startedAt,
        duration_seconds: seconds,
        distance_m: meters,
        elevation_m: elev,
        calories: kcalTyped != null ? Math.round(kcalTyped) : estimate,
        calories_estimated: kcalTyped == null && estimate != null,
        notes: notes.trim() || null,
        share,
        photo,
      },
      {
        onSuccess: (r) => {
          router.back();
          if (r.completed.length) {
            Alert.alert('¡Reto cumplido! 🏆', r.completed.map((t) => `• ${t}`).join('\n'));
          }
        },
      }
    );
  }

  return (
    <Screen>
      {(error || save.error) && <Notice message={error ?? save.error!.message} />}

      <Choice<Sport>
        label="Deporte"
        value={sport}
        onChange={setSport}
        columns={3}
        options={SPORTS.map((s) => ({ value: s.key, label: `${s.emoji} ${s.label}` }))}
      />

      <DateField label="Fecha" value={date} onChange={setDate} maximumDate={new Date()} />

      <View>
        <Text style={styles.label}>Tiempo</Text>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Horas" value={h} onChangeText={setH} keyboardType="number-pad" placeholder="0" maxLength={2} />
          </View>
          <View style={styles.flex}>
            <TextField label="Min" value={min} onChangeText={setMin} keyboardType="number-pad" placeholder="0" maxLength={3} />
          </View>
          <View style={styles.flex}>
            <TextField label="Seg" value={sec} onChangeText={setSec} keyboardType="number-pad" placeholder="0" maxLength={2} />
          </View>
        </View>
      </View>

      <TextField
        label={swim ? 'Distancia (metros, opcional)' : 'Distancia (km, opcional)'}
        value={distance}
        onChangeText={setDistance}
        keyboardType="decimal-pad"
        placeholder={swim ? 'Ej. 1500' : 'Ej. 5,2'}
      />
      {pace ? <Text style={styles.pace}>Ritmo: {pace}</Text> : null}

      {(sport === 'hike' || sport === 'bike' || sport === 'run') && (
        <TextField
          label="Desnivel positivo (m, opcional)"
          value={elevation}
          onChangeText={setElevation}
          keyboardType="number-pad"
          placeholder="Ej. 650"
        />
      )}

      <TextField
        label="Calorías (opcional)"
        value={calories}
        onChangeText={setCalories}
        keyboardType="number-pad"
        placeholder={estimate != null ? `≈ ${estimate} estimadas` : 'Las del reloj, si las tienes'}
      />
      {estimate == null && weight.data == null && !weight.isPending ? (
        <Text style={styles.hint}>Registra tu peso en Progreso › Cuerpo y la app estimará tus calorías.</Text>
      ) : null}

      <TextField label="Comentario (opcional)" value={notes} onChangeText={setNotes} placeholder="Ej. Ruta del Parque Metropolitano" maxLength={300} />

      <ShareFields share={share} onShare={setShare} photo={photo} onPhoto={setPhoto} />

      <Button label="Guardar actividad" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.sm },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.fg, marginBottom: space.xs },
  pace: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.accent, marginTop: -space.sm },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, marginTop: -space.sm },
});
