import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

/** Foto del socio o sus iniciales, como el Avatar del perfil web. */
export function Avatar({ name, url, size = 80 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        accessibilityLabel={`Foto de ${name}`}
      />
    );
  }
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initialsText, { fontSize: size * 0.36 }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initials: { backgroundColor: 'rgba(232,75,31,0.2)', alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontFamily: fonts.bodySemi, color: colors.accent },
});
