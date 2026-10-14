import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { colors, fonts } from '@/theme';

/** Gráfico de línea simple (peso en el tiempo). Puntos de más antiguo a más reciente. */
export function LineChart({
  points,
  target,
  height = 140,
  unit = 'kg',
}: {
  points: { label: string; value: number }[];
  target?: number | null;
  height?: number;
  unit?: string;
}) {
  const [width, setWidth] = useState(0);
  const values = points.map((p) => p.value).concat(target != null ? [target] : []);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => (points.length === 1 ? width / 2 : (i / (points.length - 1)) * (width - 16) + 8);
  const y = (v: number) => height - 8 - ((v - lo) / (hi - lo)) * (height - 16);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {target != null && (
            <Line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke={colors.ok} strokeDasharray="4 4" strokeWidth={1} />
          )}
          <Path d={path} stroke={colors.accent} strokeWidth={2.5} fill="none" />
          {points.map((p, i) => (
            <Circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 3} fill={colors.accent} />
          ))}
        </Svg>
      )}
      <View style={styles.axis}>
        <Text style={styles.axisText}>{points[0]?.label}</Text>
        {target != null && <Text style={[styles.axisText, { color: colors.ok }]}>Meta {target} {unit}</Text>}
        <Text style={styles.axisText}>{points[points.length - 1]?.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisText: { fontFamily: fonts.body, fontSize: 11, color: colors.fgMute },
});
