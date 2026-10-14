import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

// logo-horizontal.png mide 2256×355.
const RATIO = 2256 / 355;

export function Logo({ width = 200 }: { width?: number }) {
  return (
    <Image
      source={require('@/assets/images/logo-horizontal.png')}
      style={[styles.logo, { width, height: width / RATIO }]}
      contentFit="contain"
      accessibilityLabel="Iron Fit Club"
    />
  );
}

const styles = StyleSheet.create({ logo: { alignSelf: 'center' } });
