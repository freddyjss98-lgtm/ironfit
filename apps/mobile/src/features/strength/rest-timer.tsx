import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { colors, fonts, radius, space } from '@/theme';

const PRESETS = [60, 90, 120, 180];
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Temporizador de descanso entre series (vibra al terminar), como en la web. */
export function RestTimer() {
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  function start(seconds: number) {
    if (timer.current) clearInterval(timer.current);
    setLeft(seconds);
    timer.current = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          if (timer.current) clearInterval(timer.current);
          Vibration.vibrate([0, 400, 200, 400]);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    setLeft(0);
  }

  return (
    <View style={styles.box}>
      <Text style={styles.label}>Descanso</Text>
      {left > 0 ? (
        <Pressable onPress={stop} style={styles.running} accessibilityRole="button" accessibilityLabel="Detener descanso">
          <Text style={styles.time}>{mmss(left)}</Text>
          <Text style={styles.stop}>Detener</Text>
        </Pressable>
      ) : (
        <View style={styles.presets}>
          {PRESETS.map((s) => (
            <Pressable key={s} onPress={() => start(s)} style={styles.preset} accessibilityRole="button">
              <Text style={styles.presetText}>{mmss(s)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  label: { fontFamily: fonts.condSemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.fgMute },
  presets: { flex: 1, flexDirection: 'row', gap: space.sm },
  preset: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line2 },
  presetText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.fgDim },
  running: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(232,75,31,0.15)', borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  time: { fontFamily: fonts.display, fontSize: 24, color: colors.accent },
  stop: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.fgDim },
});
