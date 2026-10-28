import { HeaderShownContext } from 'expo-router/react-navigation';
import { useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';

type Props = {
  children: ReactNode;
  /** Formularios: centra el contenido y evita que el teclado lo tape. */
  centered?: boolean;
  /** Deslizar hacia abajo para recargar. */
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function Screen({ children, centered = false, onRefresh, refreshing = false }: Props) {
  // Las pantallas con barra de título ya quedan debajo del notch: sumar el
  // margen superior otra vez dejaba un hueco vacío arriba.
  const hasHeader = useContext(HeaderShownContext);
  return (
    <SafeAreaView style={styles.safe} edges={hasHeader ? ['left', 'right'] : ['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, centered && styles.centered]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
            ) : undefined
          }>
          <View style={styles.inner}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: space.xl, paddingVertical: space.xl },
  centered: { justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: space.lg },
});
