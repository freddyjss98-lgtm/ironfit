import { todayInEcuador } from '@ironfit/shared/date';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DateField } from '@/components/date-field';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { ExercisePicker } from '@/features/strength/exercise-picker';
import { RestTimer } from '@/features/strength/rest-timer';
import { muscleLabel, useSaveSession, useStrength, type Entry, type Session } from '@/features/strength/use-strength';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius, space } from '@/theme';

/** Series de la última vez que hizo ese ejercicio (para precargar). */
function lastSets(sessions: Session[], exerciseId: string) {
  for (const s of sessions) {
    const sets = s.sets.filter((x) => x.exercise_id === exerciseId).sort((a, b) => a.set_number - b.set_number);
    if (sets.length) return sets.map((x) => ({ weight: String(x.weight_kg), reps: String(x.reps) }));
  }
  return null;
}

export default function SessionScreen() {
  const { routine: routineId } = useLocalSearchParams<{ routine?: string }>();
  const { member, session } = useAuth();
  const strength = useStrength(member!.id);
  if (!strength.data) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  return <SessionForm data={strength.data} routineId={routineId} memberId={member!.id} userId={session!.user.id} />;
}

function SessionForm({
  data,
  routineId,
  memberId,
  userId,
}: {
  data: NonNullable<ReturnType<typeof useStrength>['data']>;
  routineId?: string;
  memberId: string;
  userId: string;
}) {
  const router = useRouter();
  const save = useSaveSession(memberId, userId);
  const [date, setDate] = useState(todayInEcuador());
  const [notes, setNotes] = useState('');
  const [picking, setPicking] = useState(false);
  const [entries, setEntries] = useState<Entry[]>(() => {
    const routine = data.routines.find((r) => r.id === routineId);
    if (!routine) return [];
    // Rutina: sus ejercicios con las series objetivo, o lo de la última vez.
    return routine.exercises.map((re) => ({
      exerciseId: re.exercise_id,
      sets:
        lastSets(data.sessions, re.exercise_id)?.slice(0, re.target_sets ?? undefined) ??
        Array.from({ length: re.target_sets ?? 3 }, () => ({ weight: '', reps: re.target_reps ? String(re.target_reps) : '' })),
    }));
  });

  const name = (id: string) => data.exercises.find((e) => e.id === id);

  const update = (i: number, fn: (e: Entry) => Entry) => setEntries((list) => list.map((e, j) => (j === i ? fn(e) : e)));

  function addExercise(id: string) {
    setPicking(false);
    setEntries((list) => [...list, { exerciseId: id, sets: lastSets(data.sessions, id) ?? [{ weight: '', reps: '' }] }]);
  }

  return (
    <Screen>
      <DateField label="Fecha" value={date} onChange={setDate} maximumDate={new Date()} />
      <RestTimer />

      {entries.map((e, i) => {
        const ex = name(e.exerciseId);
        return (
          <Card key={`${e.exerciseId}-${i}`} style={styles.entry}>
            <View style={styles.entryHead}>
              <View style={styles.flex}>
                <Text style={styles.exName}>{ex?.name ?? 'Ejercicio'}</Text>
                <Text style={styles.small}>{ex ? muscleLabel(ex.muscle_group) : ''}</Text>
              </View>
              <Pressable onPress={() => setEntries((l) => l.filter((_, j) => j !== i))} hitSlop={8}>
                <Text style={styles.remove}>Quitar</Text>
              </Pressable>
            </View>
            {e.sets.map((s, k) => (
              <View key={k} style={styles.setRow}>
                <Text style={styles.setNum}>{k + 1}</Text>
                <TextInput
                  value={s.weight}
                  onChangeText={(t) => update(i, (en) => ({ ...en, sets: en.sets.map((x, m) => (m === k ? { ...x, weight: t.replace(/[^\d.,]/g, '') } : x)) }))}
                  placeholder="kg"
                  placeholderTextColor={colors.fgMute}
                  keyboardType="decimal-pad"
                  style={styles.setInput}
                  accessibilityLabel={`Serie ${k + 1} kilos`}
                />
                <Text style={styles.x}>×</Text>
                <TextInput
                  value={s.reps}
                  onChangeText={(t) => update(i, (en) => ({ ...en, sets: en.sets.map((x, m) => (m === k ? { ...x, reps: t.replace(/\D/g, '') } : x)) }))}
                  placeholder="reps"
                  placeholderTextColor={colors.fgMute}
                  keyboardType="number-pad"
                  style={styles.setInput}
                  accessibilityLabel={`Serie ${k + 1} repeticiones`}
                />
                <Pressable
                  onPress={() => update(i, (en) => ({ ...en, sets: en.sets.filter((_, m) => m !== k) }))}
                  hitSlop={8}
                  accessibilityLabel={`Quitar serie ${k + 1}`}>
                  <Text style={styles.removeSet}>✕</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() => update(i, (en) => ({ ...en, sets: [...en.sets, { ...(en.sets[en.sets.length - 1] ?? { weight: '', reps: '' }) }] }))}
              style={styles.addSet}>
              <Text style={styles.addSetText}>+ Serie</Text>
            </Pressable>
          </Card>
        );
      })}

      <Button label="+ Agregar ejercicio" variant="secondary" onPress={() => setPicking(true)} />
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Nota de la sesión (opcional)"
        placeholderTextColor={colors.fgMute}
        style={styles.notes}
      />
      {save.error && <Notice message={save.error.message} />}
      <Button
        label="Guardar sesión"
        onPress={() => save.mutate({ date, notes, entries }, { onSuccess: () => router.back() })}
        loading={save.isPending}
        disabled={entries.length === 0}
      />

      <ExercisePicker
        visible={picking}
        exercises={data.exercises}
        memberId={memberId}
        userId={userId}
        onPick={(ex) => addExercise(ex.id)}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute },
  entry: { gap: space.sm },
  entryHead: { flexDirection: 'row', alignItems: 'center' },
  exName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.fg },
  remove: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.fgMute },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  setNum: { width: 18, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.fgMute, textAlign: 'center' },
  setInput: {
    flex: 1,
    minHeight: 44,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.fg,
    textAlign: 'center',
  },
  x: { fontFamily: fonts.body, fontSize: 14, color: colors.fgMute },
  removeSet: { fontSize: 14, color: colors.fgMute, paddingHorizontal: 4 },
  addSet: { alignSelf: 'flex-start', paddingVertical: space.xs },
  addSetText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.accent },
  notes: {
    minHeight: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm + 2,
    paddingHorizontal: space.md,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.fg,
  },
});
