import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ExercisePicker } from '@/features/strength/exercise-picker';
import { useCreateRoutine, useStrength } from '@/features/strength/use-strength';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius, space } from '@/theme';

type Row = { exerciseId: string; sets: string; reps: string };

export default function NewRoutineScreen() {
  const router = useRouter();
  const { member, session } = useAuth();
  const strength = useStrength(member!.id);
  const create = useCreateRoutine(member!.id, session!.user.id);
  const [name, setName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [picking, setPicking] = useState(false);

  if (!strength.data) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  const exName = (id: string) => strength.data.exercises.find((e) => e.id === id)?.name ?? 'Ejercicio';
  const set = (i: number, patch: Partial<Row>) => setRows((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Screen>
      <TextField label="Nombre de la rutina" value={name} onChangeText={setName} placeholder="Ej. Pierna pesada" />
      {rows.map((r, i) => (
        <Card key={`${r.exerciseId}-${i}`} style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {exName(r.exerciseId)}
          </Text>
          <TextInput
            value={r.sets}
            onChangeText={(t) => set(i, { sets: t.replace(/\D/g, '') })}
            placeholder="series"
            placeholderTextColor={colors.fgMute}
            keyboardType="number-pad"
            style={styles.input}
          />
          <Text style={styles.x}>×</Text>
          <TextInput
            value={r.reps}
            onChangeText={(t) => set(i, { reps: t.replace(/\D/g, '') })}
            placeholder="reps"
            placeholderTextColor={colors.fgMute}
            keyboardType="number-pad"
            style={styles.input}
          />
          <Pressable onPress={() => setRows((l) => l.filter((_, j) => j !== i))} hitSlop={8}>
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </Card>
      ))}
      <Button label="+ Agregar ejercicio" variant="secondary" onPress={() => setPicking(true)} />
      {create.error && <Notice message={create.error.message} />}
      <Button
        label="Guardar rutina"
        loading={create.isPending}
        onPress={() =>
          create.mutate(
            {
              name,
              exercises: rows.map((r) => ({
                exerciseId: r.exerciseId,
                targetSets: r.sets ? Number(r.sets) : null,
                targetReps: r.reps ? Number(r.reps) : null,
              })),
            },
            { onSuccess: () => router.back() }
          )
        }
      />
      <ExercisePicker
        visible={picking}
        exercises={strength.data.exercises}
        memberId={member!.id}
        userId={session!.user.id}
        onPick={(ex) => {
          setPicking(false);
          setRows((l) => [...l, { exerciseId: ex.id, sets: '3', reps: '10' }]);
        }}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  name: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fg },
  input: {
    width: 64,
    minHeight: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.fg,
    textAlign: 'center',
  },
  x: { fontFamily: fonts.body, color: colors.fgMute },
  remove: { fontSize: 14, color: colors.fgMute, paddingHorizontal: 4 },
});
