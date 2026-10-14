// "Llegué al gym": registra la asistencia del día con la RPC member_check_in
// (membresía activa y una vez por día, reglas de la base). Alimenta la racha,
// la meta semanal y los logros.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { colors, fonts, radius, space } from '@/theme';

export function CheckInCard({ memberId, checkedInToday }: { memberId: string; checkedInToday: boolean }) {
  const queryClient = useQueryClient();
  const checkIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('member_check_in');
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['home', memberId] }),
    onError: (e: Error) => Alert.alert('No se pudo registrar', e.message),
  });

  if (checkedInToday) {
    return (
      <View style={[styles.card, styles.done]}>
        <Text style={styles.doneText}>✓ Entrada de hoy registrada</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => checkIn.mutate()}
      disabled={checkIn.isPending}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, styles.cta, pressed && { opacity: 0.85 }]}>
      {checkIn.isPending ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View style={styles.row}>
          <Text style={styles.emoji}>📍</Text>
          <View style={styles.flex}>
            <Text style={styles.ctaTitle}>Llegué al gym</Text>
            <Text style={styles.ctaText}>Registra tu entrada y suma a tu racha</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  card: { borderRadius: radius.lg, padding: space.lg, minHeight: 64, justifyContent: 'center' },
  cta: { backgroundColor: colors.accent },
  emoji: { fontSize: 24 },
  ctaTitle: { fontFamily: fonts.display, fontSize: 20, color: '#fff', textTransform: 'uppercase' },
  ctaText: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  done: { backgroundColor: 'rgba(16,185,129,0.10)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', alignItems: 'center' },
  doneText: { fontFamily: fonts.bodySemi, fontSize: 14, color: '#34d399' },
});
