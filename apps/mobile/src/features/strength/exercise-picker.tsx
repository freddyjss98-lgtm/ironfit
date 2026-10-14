// Selector de ejercicio (catálogo + propios) con búsqueda y "crear ejercicio".

import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Choice } from '@/components/choice';
import { Notice } from '@/components/notice';
import { colors, fonts, radius, space } from '@/theme';

import { MUSCLES, muscleLabel, useCreateExercise, type Exercise } from './use-strength';

export function ExercisePicker({
  visible,
  exercises,
  memberId,
  userId,
  onPick,
  onClose,
}: {
  visible: boolean;
  exercises: Exercise[];
  memberId: string;
  userId: string;
  onPick: (e: Exercise) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<string>('otros');
  const create = useCreateExercise(memberId, userId);

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = exercises
    .filter((e) => !q || norm(e.name).includes(norm(q)) || norm(muscleLabel(e.muscle_group)).includes(norm(q)))
    .sort((a, b) => a.muscle_group.localeCompare(b.muscle_group) || a.name.localeCompare(b.name));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{creating ? 'Nuevo ejercicio' : 'Elegir ejercicio'}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>Cerrar</Text>
          </Pressable>
        </View>

        {creating ? (
          <View style={styles.body}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nombre del ejercicio"
              placeholderTextColor={colors.fgMute}
              style={styles.input}
              autoFocus
            />
            <Choice
              label="Grupo muscular"
              value={muscle}
              onChange={setMuscle}
              options={MUSCLES.map((m) => ({ value: m.key, label: m.label }))}
            />
            {create.error && <Notice message={create.error.message} />}
            <Button
              label="Crear y usar"
              loading={create.isPending}
              onPress={() =>
                create.mutate(
                  { name, muscle },
                  {
                    onSuccess: (ex) => {
                      setCreating(false);
                      setName('');
                      onPick(ex);
                    },
                  }
                )
              }
            />
            <Button label="Volver a la lista" variant="ghost" onPress={() => setCreating(false)} />
          </View>
        ) : (
          <>
            <View style={styles.body}>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Buscar (ej. sentadilla, espalda)"
                placeholderTextColor={colors.fgMute}
                style={styles.input}
              />
            </View>
            <FlatList
              data={list}
              keyExtractor={(e) => e.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listPad}
              renderItem={({ item }) => (
                <Pressable onPress={() => onPick(item)} style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMuscle}>
                    {muscleLabel(item.muscle_group)}
                    {item.is_global ? '' : ' · propio'}
                  </Text>
                </Pressable>
              )}
              ListFooterComponent={
                <Button label="+ Crear un ejercicio nuevo" variant="secondary" onPress={() => setCreating(true)} />
              }
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.fg, textTransform: 'uppercase' },
  close: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.accent },
  body: { padding: space.lg, gap: space.md },
  input: {
    minHeight: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm + 2,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.fg,
  },
  listPad: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: 2 },
  item: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: 'rgba(36,36,36,0.6)' },
  itemName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.fg },
  itemMuscle: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, marginTop: 2 },
});
