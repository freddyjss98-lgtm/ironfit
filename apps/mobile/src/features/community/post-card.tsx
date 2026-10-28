// Una publicación de la comunidad: quién, el reto o la actividad, la foto, los
// datos y el 🔥. El menú ⋯ permite reportar o bloquear (o borrar la propia).

import { Image } from 'expo-image';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { fmtDistance, fmtDuration, fmtPace, sportEmoji, sportLabel } from '@/features/sports/sports';
import { fmtAgo } from '@/lib/dates';
import { colors, fonts, radius, space } from '@/theme';

import { useBlockAuthor, useDeletePost, useReportPost, useToggleFire, type Post } from './use-community';

export function PostCard({ post, memberId }: { post: Post; memberId: string }) {
  const fire = useToggleFire(memberId);
  const report = useReportPost();
  const block = useBlockAuthor();
  const del = useDeletePost();

  const fail = (title: string) => (e: Error) => Alert.alert(title, e.message);

  function menu() {
    if (post.is_mine) {
      Alert.alert('Tu publicación', undefined, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Eliminar publicación', 'Se borra de la comunidad. Tu reto o actividad sigue guardado.', [
              { text: 'No', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: () => del.mutate(post, { onError: fail('No se pudo eliminar') }) },
            ]),
        },
      ]);
      return;
    }
    Alert.alert(post.display_name, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reportar',
        onPress: () =>
          Alert.alert(
            'Reportar publicación',
            'El equipo de Iron Fit la revisará. Dejarás de verla desde ahora.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Reportar',
                style: 'destructive',
                onPress: () =>
                  report.mutate(
                    { post, reason: 'Contenido inapropiado' },
                    { onSuccess: () => Alert.alert('Gracias', 'Recibimos tu reporte.'), onError: fail('No se pudo reportar') }
                  ),
              },
            ]
          ),
      },
      {
        text: 'Bloquear',
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Bloquear a ${post.display_name}`, 'No verás más sus publicaciones.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Bloquear', style: 'destructive', onPress: () => block.mutate(post, { onError: fail('No se pudo bloquear') }) },
          ]),
      },
    ]);
  }

  const stats = post.sport
    ? [
        fmtDistance(post.distance_m, post.sport),
        post.duration_seconds ? fmtDuration(post.duration_seconds) : null,
        post.duration_seconds ? fmtPace(post.sport, post.duration_seconds, post.distance_m) : null,
        post.elevation_m ? `↑ ${post.elevation_m} m` : null,
        post.calories ? `${post.calories} kcal` : null,
      ].filter(Boolean)
    : [];

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Avatar name={post.display_name} url={post.avatar_url} size={38} />
        <View style={styles.flex}>
          <Text style={styles.name}>{post.is_mine ? `${post.display_name} (tú)` : post.display_name}</Text>
          <Text style={styles.when}>{fmtAgo(post.created_at)}</Text>
        </View>
        <Pressable onPress={menu} hitSlop={12} accessibilityRole="button" accessibilityLabel="Opciones de la publicación">
          <Text style={styles.more}>⋯</Text>
        </Pressable>
      </View>

      {post.challenge_title ? (
        <Text style={styles.badge}>🏆 Cumplió el reto «{post.challenge_title}»</Text>
      ) : post.sport ? (
        <Text style={styles.badge}>
          {sportEmoji(post.sport)} {sportLabel(post.sport)}
        </Text>
      ) : null}

      {post.photo_url ? (
        <Image source={{ uri: post.photo_url }} style={styles.photo} contentFit="cover" transition={150} accessibilityLabel="Foto de la publicación" />
      ) : null}

      {stats.length > 0 && (
        <View style={styles.stats}>
          {post.challenge_title && post.sport ? <Text style={styles.stat}>{sportEmoji(post.sport)}</Text> : null}
          {stats.map((s) => (
            <Text key={s} style={styles.stat}>
              {s}
            </Text>
          ))}
        </View>
      )}

      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}

      <Pressable
        onPress={() => fire.mutate(post)}
        accessibilityRole="button"
        accessibilityState={{ selected: post.fired }}
        accessibilityLabel={post.fired ? 'Quitar fuego' : 'Dar fuego'}
        style={[styles.fire, post.fired && styles.fireOn]}>
        <Text style={styles.fireText}>🔥 {post.fire_count > 0 ? post.fire_count : ''}</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.fg },
  when: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute },
  more: { fontSize: 22, color: colors.fgDim, paddingHorizontal: space.xs },
  badge: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.accent },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.md, backgroundColor: colors.bg2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stat: {
    fontFamily: fonts.cond,
    fontSize: 16,
    color: colors.fg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  caption: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fg },
  fire: {
    alignSelf: 'flex-start',
    minWidth: 56,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line2,
    paddingHorizontal: space.md,
  },
  fireOn: { borderColor: colors.accent, backgroundColor: 'rgba(232,75,31,0.15)' },
  fireText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.fg },
});
