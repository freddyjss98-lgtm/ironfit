import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/theme';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Date (local) → 'YYYY-MM-DD'. */
function toYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function pretty(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

type Props = {
  label: string;
  /** 'YYYY-MM-DD' o vacío. */
  value: string;
  onChange: (ymd: string) => void;
  /** Fecha que se muestra al abrir el selector si aún no hay valor. */
  initial?: string;
  maximumDate?: Date;
};

export function DateField({ label, value, onChange, initial = '2000-01-01', maximumDate }: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const current = fromYmd(value || initial);

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        maximumDate,
        onValueChange: (_event, date) => onChange(toYmd(date)),
      });
    } else {
      setIosOpen((o) => !o);
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? pretty(value) : 'sin elegir'}`}
        style={[styles.box, iosOpen && styles.boxFocused]}>
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? pretty(value) : 'Elegir fecha'}</Text>
      </Pressable>
      {Platform.OS === 'ios' && iosOpen && (
        <DateTimePicker
          value={current}
          mode="date"
          display="spinner"
          themeVariant="dark"
          locale="es-EC"
          maximumDate={maximumDate}
          onValueChange={(_event, date) => onChange(toYmd(date))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs + 2 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.fgDim },
  box: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm + 2,
  },
  boxFocused: { borderColor: colors.accent },
  value: { fontFamily: fonts.body, fontSize: 15, color: colors.fg },
  placeholder: { color: colors.fgMute },
});
