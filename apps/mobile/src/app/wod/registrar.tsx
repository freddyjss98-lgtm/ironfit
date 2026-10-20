import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Choice } from '@/components/choice';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { Body } from '@/components/text';
import { SCORE_LABELS, type ScoreType } from '@/features/wod/score';
import { useDayWod } from '@/features/wod/use-day-wod';
import { useDeleteResult, useMyResult, useSaveResult, type MyResult } from '@/features/wod/use-wod';
import { detectParts, guessType, parseScore, partScheme, scoreToInput, type PartScore } from '@/features/wod/wod-parts';
import { useAuth } from '@/lib/auth';
import { fmtWeekdayLong } from '@/lib/dates';
import { colors, fonts, radius, space } from '@/theme';

const TYPES: ScoreType[] = ['time', 'rounds', 'load', 'reps'];
const PLACEHOLDER: Record<ScoreType, string> = {
  time: 'mm:ss (ej. 2410)',
  rounds: 'rondas + reps (ej. 7+12)',
  load: 'kg (ej. 80)',
  reps: 'reps (ej. 45)',
};

type Row = { label: string; type: ScoreType; input: string };

export default function MyWodScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { member } = useAuth();
  const result = useMyResult(member!.id, date);
  const wod = useDayWod(date);

  if (result.isPending || wod.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  const html = wod.data ?? undefined;
  const labels = detectParts(html);
  const schemes = Object.fromEntries(labels.map((l) => [l, partScheme(html, l)]));
  return <MyWodForm memberId={member!.id} date={date} current={result.data ?? null} labels={labels} schemes={schemes} />;
}

function initialRows(labels: string[], current: MyResult | null, schemes: Record<string, string>): Row[] {
  const saved = current?.parts ?? [];
  if (labels.length === 0) {
    // Sin títulos en la planificación: un único resultado.
    const p = saved[0] ?? (current ? { ...current, label: 'Resultado' } : null);
    return [{ label: 'Resultado', type: p?.score_type ?? 'time', input: p ? scoreToInput(p as PartScore) : '' }];
  }
  return labels.map((label, i) => {
    const p = saved.find((s) => s.label === label) ?? (saved.length === 0 && i === 0 && current ? { ...current, label } : null);
    return { label, type: p?.score_type ?? guessType(`${label} ${schemes[label] ?? ''}`), input: p ? scoreToInput(p as PartScore) : '' };
  });
}

function MyWodForm({
  memberId,
  date,
  current,
  labels,
  schemes,
}: {
  memberId: string;
  date: string;
  current: MyResult | null;
  labels: string[];
  schemes: Record<string, string>;
}) {
  const router = useRouter();
  const save = useSaveResult(memberId, date);
  const remove = useDeleteResult(memberId, date);
  const [rows, setRows] = useState<Row[]>(() => initialRows(labels, current, schemes));
  const [rx, setRx] = useState<'rx' | 'scaled'>(current && !current.rx ? 'scaled' : 'rx');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const set = (i: number, patch: Partial<Row>) => setRows((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const cycleType = (i: number) => set(i, { type: TYPES[(TYPES.indexOf(rows[i].type) + 1) % TYPES.length] });

  // Solo lo que se entiende: lo vacío o ilegible se ignora (todo es opcional).
  const filled: PartScore[] = rows.flatMap((r) => {
    const v = parseScore(r.type, r.input);
    return v ? [{ label: r.label, score_type: r.type, ...v }] : [];
  });
  const unreadable = rows.filter((r) => r.input.trim() && !parseScore(r.type, r.input));

  async function persist(): Promise<boolean> {
    setError(null);
    if (unreadable.length) {
      setError(`No entendimos "${unreadable[0].input}" en ${unreadable[0].label}. Revísalo o déjalo vacío.`);
      return false;
    }
    if (filled.length === 0) return true; // nada que guardar: igual se puede compartir
    const main = filled[0]; // el primero que anotó es el que va a la pizarra
    try {
      await save.mutateAsync({
        score_type: main.score_type,
        time_seconds: main.time_seconds,
        capped: false,
        rounds: main.rounds,
        reps: main.reps,
        load_kg: main.load_kg,
        rx: rx === 'rx',
        notes: notes.trim() || null,
        parts: labels.length ? filled : [],
      });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      return false;
    }
  }

  async function share() {
    if (await persist()) router.replace({ pathname: '/wod/compartir', params: { date } });
  }

  async function onlySave() {
    if (await persist()) router.back();
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
      <Text style={styles.hint}>
        Todo es opcional: anota solo lo que quieras (una parte basta) o comparte tu WOD tal cual.
      </Text>

      {rows.map((r, i) => (
        <View key={r.label + i} style={styles.part}>
          <View style={styles.partHead}>
            <View style={styles.flex}>
              <Text style={styles.partLabel} numberOfLines={2}>
                {r.label}
              </Text>
              {schemes[r.label] ? <Text style={styles.scheme}>{schemes[r.label]}</Text> : null}
            </View>
            <Pressable onPress={() => cycleType(i)} style={styles.type} accessibilityRole="button" accessibilityLabel={`Formato: ${SCORE_LABELS[r.type]}. Toca para cambiar`}>
              <Text style={styles.typeText}>{SCORE_LABELS[r.type]} ⇄</Text>
            </Pressable>
          </View>
          <TextInput
            value={r.input}
            onChangeText={(t) => set(i, { input: t })}
            placeholder={PLACEHOLDER[r.type]}
            placeholderTextColor={colors.fgMute}
            keyboardType={r.type === 'rounds' ? 'numbers-and-punctuation' : r.type === 'load' ? 'decimal-pad' : 'numbers-and-punctuation'}
            style={[styles.input, r.input.trim() && !parseScore(r.type, r.input) && styles.inputBad]}
            accessibilityLabel={`${r.label}, ${SCORE_LABELS[r.type]}`}
          />
        </View>
      ))}

      <Choice<'rx' | 'scaled'>
        label="Versión"
        value={rx}
        onChange={setRx}
        options={[
          { value: 'rx', label: 'Rx' },
          { value: 'scaled', label: 'Escalado' },
        ]}
      />
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Nota (opcional)"
        placeholderTextColor={colors.fgMute}
        maxLength={500}
        style={[styles.input, styles.notes]}
      />

      {error && <Notice message={error} />}
      <Button label="Compartir mi WOD" onPress={share} loading={save.isPending} />
      {filled.length > 0 && <Button label="Solo guardar" variant="secondary" onPress={onlySave} />}
      {current && <Button label="Borrar resultado" variant="ghost" onPress={onDelete} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.fgMute, marginTop: -space.sm },
  part: { gap: space.xs + 2 },
  partHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  partLabel: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.accent },
  scheme: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, marginTop: 1 },
  type: { borderWidth: 1, borderColor: colors.line2, borderRadius: 999, paddingHorizontal: space.md, paddingVertical: 4 },
  typeText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.fgDim },
  input: {
    minHeight: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm + 2,
    paddingHorizontal: space.lg,
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
    color: colors.fg,
  },
  inputBad: { borderColor: '#f87171' },
  notes: { fontFamily: fonts.body, fontSize: 14 },
});
