import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Choice } from '@/components/choice';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { Body } from '@/components/text';
import { SCORE_LABELS, type ScoreType } from '@/features/wod/score';
import { useDeleteResult, useMyResult, useSaveResult, type MyResult } from '@/features/wod/use-wod';
import { useAuth } from '@/lib/auth';
import { fmtWeekdayLong } from '@/lib/dates';
import { colors, fonts, radius, space } from '@/theme';

export default function RegisterResultScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { member } = useAuth();
  const current = useMyResult(member!.id, date);

  if (current.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  return <ResultForm memberId={member!.id} date={date} current={current.data ?? null} />;
}

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};

function ResultForm({ memberId, date, current }: { memberId: string; date: string; current: MyResult | null }) {
  const router = useRouter();
  const save = useSaveResult(memberId, date);
  const remove = useDeleteResult(memberId, date);

  const [type, setType] = useState<ScoreType>(current?.score_type ?? 'time');
  const [min, setMin] = useState(current?.time_seconds != null ? String(Math.floor(current.time_seconds / 60)) : '');
  const [sec, setSec] = useState(current?.time_seconds != null ? String(current.time_seconds % 60) : '');
  const [capped, setCapped] = useState(current?.capped ?? false);
  const [rounds, setRounds] = useState(current?.rounds != null ? String(current.rounds) : '');
  const [reps, setReps] = useState(current?.reps != null ? String(current.reps) : '');
  const [load, setLoad] = useState(current?.load_kg != null ? String(current.load_kg) : '');
  const [rx, setRx] = useState<'rx' | 'scaled'>(current && !current.rx ? 'scaled' : 'rx');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const r = num(reps);
    let input;
    if (type === 'time') {
      const total = (num(min) ?? 0) * 60 + (num(sec) ?? 0);
      if (!capped && total <= 0) return setError('Escribe tu tiempo.');
      if ((num(sec) ?? 0) >= 60) return setError('Los segundos van de 0 a 59.');
      input = { time_seconds: capped ? null : Math.round(total), capped, rounds: null, reps: capped ? r : null, load_kg: null };
    } else if (type === 'rounds') {
      if (num(rounds) == null) return setError('Escribe las rondas completas.');
      input = { time_seconds: null, capped: false, rounds: Math.round(num(rounds)!), reps: r, load_kg: null };
    } else if (type === 'load') {
      if (!num(load)) return setError('Escribe los kilos.');
      input = { time_seconds: null, capped: false, rounds: null, reps: null, load_kg: num(load) };
    } else {
      if (r == null) return setError('Escribe las repeticiones.');
      input = { time_seconds: null, capped: false, rounds: null, reps: Math.round(r), load_kg: null };
    }
    save.mutate(
      { score_type: type, rx: rx === 'rx', notes: notes.trim() || null, ...input },
      { onSuccess: () => router.back(), onError: (e) => setError(e.message) }
    );
  }

  function onDelete() {
    if (!current) return;
    Alert.alert('Borrar resultado', '¿Borrar tu resultado de este día?', [
      { text: 'No', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => remove.mutate(current.id, { onSuccess: () => router.back() }) },
    ]);
  }

  return (
    <Screen>
      <Body dim>{fmtWeekdayLong(date)}</Body>

      <Choice<ScoreType>
        label="¿Cómo se puntúa el WOD?"
        value={type}
        onChange={setType}
        options={(['time', 'rounds', 'load', 'reps'] as ScoreType[]).map((t) => ({ value: t, label: SCORE_LABELS[t] }))}
      />
      <Text style={styles.hint}>
        {type === 'time'
          ? 'For Time: cuánto tardaste en terminarlo.'
          : type === 'rounds'
            ? 'AMRAP: rondas completas y reps de la ronda incompleta.'
            : type === 'load'
              ? 'Fuerza: la carga más alta que levantaste.'
              : 'Máximo de repeticiones.'}
      </Text>

      {type === 'time' && (
        <>
          <Pressable
            onPress={() => setCapped((c) => !c)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: capped }}
            style={styles.check}>
            <View style={[styles.box, capped && styles.boxOn]}>{capped && <Text style={styles.tick}>✓</Text>}</View>
            <Text style={styles.checkText}>No terminé dentro del tiempo límite</Text>
          </Pressable>
          {capped ? (
            <Field label="Reps que completaste (opcional)" value={reps} onChange={setReps} />
          ) : (
            <View style={styles.row}>
              <Field label="Minutos" value={min} onChange={setMin} />
              <Field label="Segundos" value={sec} onChange={setSec} />
            </View>
          )}
        </>
      )}
      {type === 'rounds' && (
        <View style={styles.row}>
          <Field label="Rondas" value={rounds} onChange={setRounds} />
          <Field label="Reps extra" value={reps} onChange={setReps} />
        </View>
      )}
      {type === 'load' && <Field label="Kilos" value={load} onChange={setLoad} decimal />}
      {type === 'reps' && <Field label="Repeticiones" value={reps} onChange={setReps} />}

      <Choice<'rx' | 'scaled'>
        label="Versión"
        value={rx}
        onChange={setRx}
        options={[
          { value: 'rx', label: 'Rx (como estaba)' },
          { value: 'scaled', label: 'Escalado' },
        ]}
      />

      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Nota (opcional). Ej. wall balls con 6 kg, escalé los pull-ups"
        placeholderTextColor={colors.fgMute}
        multiline
        maxLength={500}
        style={styles.notes}
      />

      {error && <Notice message={error} />}
      <Button label={current ? 'Guardar cambios' : 'Guardar resultado'} onPress={submit} loading={save.isPending} />
      {current && <Button label="Borrar resultado" variant="ghost" onPress={onDelete} />}
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  decimal,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(decimal ? /[^\d.,]/g : /\D/g, ''))}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        style={styles.input}
        selectionColor={colors.accent}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.fgMute, marginTop: -space.sm },
  row: { flexDirection: 'row', gap: space.md },
  field: { flex: 1, gap: space.xs + 2 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.fgDim },
  input: {
    minHeight: 56,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm + 2,
    paddingHorizontal: space.lg,
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.fg,
    textAlign: 'center',
  },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: '#fff', fontSize: 14, fontFamily: fonts.bodySemi },
  checkText: { fontFamily: fonts.body, fontSize: 14, color: colors.fg },
  notes: {
    minHeight: 64,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm + 2,
    padding: space.md,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.fg,
  },
});
