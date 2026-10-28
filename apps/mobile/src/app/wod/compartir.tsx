import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { useHome } from '@/features/home/use-home';
import { ShareCard, type CardData, type CardDesign, type CardSection } from '@/features/wod/share-card';
import { useDayRecords, useDayWod } from '@/features/wod/use-day-wod';
import { useMyResult } from '@/features/wod/use-wod';
import { wodSections } from '@/features/wod/wod-parts';
import { useAuth } from '@/lib/auth';
import { useCardExport } from '@/lib/card-export';
import { colors, fonts, radius, space } from '@/theme';

const DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function dateLabel(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

export default function ShareWodScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { member } = useAuth();
  const memberId = member!.id;
  const result = useMyResult(memberId, date);
  const wod = useDayWod(date);
  const records = useDayRecords(memberId, date);
  const home = useHome(memberId);
  const cardRef = useRef<View>(null);
  const [design, setDesign] = useState<CardDesign>('full');
  const [showStreak, setShowStreak] = useState(true);
  const [showRecords, setShowRecords] = useState(true);
  const [showWarmup, setShowWarmup] = useState(true);
  const { busy, save, copy, share } = useCardExport(cardRef, 'Compartir mi WOD');

  if (result.isPending || wod.isPending || records.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const saved = result.data?.parts ?? [];
  const all = wodSections(wod.data ?? undefined);
  const hasWarmup = all.some((s) => s.warmup);
  const visible = all.filter((s) => showWarmup || !s.warmup);
  let sections: CardSection[] = visible.map((s) => ({
    title: s.title,
    lines: s.lines,
    score: saved.find((p) => p.label === s.title) ?? null,
  }));
  // Resultado sin parte asignada (WOD sin títulos o registro antiguo): va en la
  // primera sección que no sea calentamiento.
  if (result.data && !sections.some((s) => s.score)) {
    const main = { ...result.data, label: '' };
    const target = visible.findIndex((s) => !s.warmup);
    sections = target >= 0 ? sections.map((s, i) => (i === target ? { ...s, score: main } : s)) : [{ title: 'Mi resultado', lines: [], score: main }];
  }
  const dayRecords = records.data ?? [];
  const streak = home.data?.stats.currentStreak ?? null;

  const data: CardData = {
    dateLabel: dateLabel(date),
    sections,
    records: showRecords ? dayRecords : [],
    streak: showStreak ? streak : null,
    rx: result.data ? result.data.rx : null,
  };

  return (
    <Screen>
      <Segmented<CardDesign>
        value={design}
        onChange={setDesign}
        options={[
          { value: 'full', label: 'Completo' },
          { value: 'min', label: 'Mínimo' },
        ]}
      />

      {/* El gris es solo para ver la tarjeta: la imagen sale sin fondo. */}
      <View style={styles.preview}>
        <ShareCard ref={cardRef} data={data} design={design} />
      </View>
      <Text style={styles.note}>La imagen se guarda sin fondo para ponerla encima de tu foto.</Text>

      <Card style={styles.options}>
        {hasWarmup && design === 'full' && (
          <View style={styles.option}>
            <Text style={styles.optionText}>Incluir calentamiento</Text>
            <Switch value={showWarmup} onValueChange={setShowWarmup} trackColor={{ true: colors.accent, false: colors.line2 }} thumbColor="#fff" />
          </View>
        )}
        {streak != null && streak > 0 && (
          <View style={styles.option}>
            <Text style={styles.optionText}>Mostrar racha</Text>
            <Switch value={showStreak} onValueChange={setShowStreak} trackColor={{ true: colors.accent, false: colors.line2 }} thumbColor="#fff" />
          </View>
        )}
        {dayRecords.length > 0 && (
          <View style={styles.option}>
            <Text style={styles.optionText}>Mostrar récords del día</Text>
            <Switch value={showRecords} onValueChange={setShowRecords} trackColor={{ true: colors.accent, false: colors.line2 }} thumbColor="#fff" />
          </View>
        )}
        {!saved.length && !result.data && (
          <Text style={styles.optionText}>Tip: anota tus resultados para que salgan al lado de cada parte.</Text>
        )}
      </Card>

      <Button label="Guardar en fotos" onPress={save} loading={busy === 'save'} disabled={!!busy} />
      <Button label="Copiar para pegar en mi historia" variant="secondary" onPress={copy} loading={busy === 'copy'} disabled={!!busy} />
      <Button label="Compartir…" variant="ghost" onPress={share} loading={busy === 'share'} disabled={!!busy} />
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
  options: { gap: space.sm },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { fontFamily: fonts.body, fontSize: 14, color: colors.fgDim, flexShrink: 1 },
});
