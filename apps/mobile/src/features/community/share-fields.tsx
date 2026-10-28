// "Compartir en la comunidad" + foto opcional, igual en "Reto cumplido" y en
// "Registrar actividad". La foto solo se sube si se comparte.

import { Image } from 'expo-image';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { colors, fonts, radius, space } from '@/theme';

import { choosePhoto, type PickedPhoto } from './photo';

type Props = {
  share: boolean;
  onShare: (v: boolean) => void;
  photo: PickedPhoto | null;
  onPhoto: (p: PickedPhoto | null) => void;
  /** Aclaración bajo la foto (p. ej. que las de los retos son temporales). */
  photoNote?: string;
};

export function ShareFields({ share, onShare, photo, onPhoto, photoNote }: Props) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.title}>Compartir en la comunidad</Text>
          <Text style={styles.text}>Lo ven los socios activos de Iron Fit.</Text>
        </View>
        <Switch
          value={share}
          onValueChange={onShare}
          trackColor={{ true: colors.accent, false: colors.line2 }}
          thumbColor="#fff"
          accessibilityLabel="Compartir en la comunidad"
        />
      </View>

      {share &&
        (photo ? (
          <View style={styles.preview}>
            <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
            <View style={styles.actions}>
              <Pressable onPress={() => choosePhoto(onPhoto)} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.link}>Cambiar</Text>
              </Pressable>
              <Pressable onPress={() => onPhoto(null)} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.link, styles.remove]}>Quitar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => choosePhoto(onPhoto)} accessibilityRole="button" style={styles.add}>
            <Text style={styles.addText}>📷 Agregar foto (opcional)</Text>
          </Pressable>
        ))}
      {share && photoNote ? <Text style={styles.text}>{photoNote}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.fg },
  text: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, marginTop: 2 },
  preview: { gap: space.sm },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.md },
  actions: { flexDirection: 'row', gap: space.xl, justifyContent: 'center' },
  link: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.accent },
  remove: { color: colors.fgDim },
  add: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line2,
  },
  addText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fgDim },
});
