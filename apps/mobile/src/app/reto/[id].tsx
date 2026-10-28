import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, SectionLabel } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { goalText } from '@/features/community/challenge-card';
import type { PickedPhoto } from '@/features/community/photo';
import { ShareFields } from '@/features/community/share-fields';
import { useChallenges, useCompleteChallenge } from '@/features/community/use-community';
import { fmtDistance, fmtDuration, sportEmoji, sportLabel } from '@/features/sports/sports';
import { useActivities } from '@/features/sports/use-activities';
import { ecuadorDateOf, fmtShort } from '@/lib/dates';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius, space } from '@/theme';

// "Reto cumplido": todo es opcional. Basta con tocar el botón; si quiere, el
// socio suma una foto, un comentario o la actividad con la que lo cumplió.
export default function CompleteChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member, session } = useAuth();
  const router = useRouter();
  const challenges = useChallenges(true);
  const activities = useActivities(member!.id);
  const complete = useCompleteChallenge(session!.user.id);
  const [note, setNote] = useState('');
  const [share, setShare] = useState(true);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [activityId, setActivityId] = useState<string | null>(null);

  const c = challenges.data?.find((x) => x.id === id);
  if (challenges.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  if (!c) {
    return (
      <Screen>
        <Notice message="Este reto ya no está disponible." />
      </Screen>
    );
  }

  // Actividades del socio dentro de las fechas del reto (y del deporte, si aplica).
  const candidates = (activities.data ?? []).filter((a) => {
    const day = ecuadorDateOf(a.started_at);
    return day >= c.starts_on && day <= c.ends_on && (c.sport === 'any' || c.sport === a.sport);
  });

  function submit() {
    complete.mutate(
      { challengeId: c!.id, activityId, note, share, photo },
      {
        onSuccess: () => {
          router.back();
          Alert.alert('¡Reto cumplido! 🔥', share ? 'Ya está en la comunidad.' : undefined);
        },
      }
    );
  }

  return (
    <Screen>
      <Card style={styles.head}>
        <Text style={styles.title}>
          {c.sport === 'any' ? '🏆' : sportEmoji(c.sport)} {c.title}
        </Text>
        <Text style={styles.goal}>{goalText(c)}</Text>
        {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}
      </Card>

      {complete.error && <Notice message={complete.error.message} />}

      {candidates.length > 0 && (
        <View style={styles.gap}>
          <SectionLabel>¿Con cuál actividad? (opcional)</SectionLabel>
          {candidates.map((a) => {
            const on = a.id === activityId;
            return (
              <Pressable
                key={a.id}
                onPress={() => setActivityId(on ? null : a.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.activity, on && styles.activityOn]}>
                <Text style={styles.activityText}>
                  {sportEmoji(a.sport)} {sportLabel(a.sport)} · {fmtShort(ecuadorDateOf(a.started_at))}
                </Text>
                <Text style={styles.activityStats}>
                  {[fmtDistance(a.distance_m, a.sport), fmtDuration(a.duration_seconds)].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <TextField
        label="Comentario (opcional)"
        value={note}
        onChangeText={setNote}
        placeholder="Ej. ¡Primera vez en el Pichincha!"
        maxLength={300}
      />

      <ShareFields share={share} onShare={setShare} photo={photo} onPhoto={setPhoto} />

      <Button label="¡Reto cumplido!" onPress={submit} loading={complete.isPending} />
      <Text style={styles.hint}>
        ¿Lo hiciste con km y tiempo? Registra la actividad y el reto se marca solo.
      </Text>
      <Button label="Registrar actividad" variant="ghost" onPress={() => router.replace('/deportes/registrar')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.sm },
  gap: { gap: space.sm },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.fg, textTransform: 'uppercase' },
  goal: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.accent },
  desc: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fgDim },
  activity: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.sm + 2,
    padding: space.md,
    gap: 2,
  },
  activityOn: { borderColor: colors.accent, backgroundColor: 'rgba(232,75,31,0.15)' },
  activityText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fg },
  activityStats: { fontFamily: fonts.body, fontSize: 13, color: colors.fgDim },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.fgMute, textAlign: 'center' },
});
