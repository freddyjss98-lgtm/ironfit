// "Aparecer en la pizarra": el socio decide si sus resultados se ven en la
// pizarra del box (members.hide_from_board vía RPC set_board_visibility).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/theme';

export function BoardPrivacy({ memberId }: { memberId: string }) {
  const queryClient = useQueryClient();
  const hidden = useQuery({
    queryKey: ['board-hidden', memberId],
    queryFn: async () => {
      const { data, error } = await supabase.from('members').select('hide_from_board').eq('id', memberId).single();
      if (error) throw error;
      return !!data.hide_from_board;
    },
    retry: false,
  });
  const toggle = useMutation({
    mutationFn: async (hide: boolean) => {
      const { error } = await supabase.rpc('set_board_visibility', { p_hidden: hide });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-hidden', memberId] });
      queryClient.invalidateQueries({ queryKey: ['wod-board'] });
    },
  });

  // Si la opción aún no existe en el servidor, no se muestra.
  if (hidden.isError || hidden.data === undefined) return null;
  const visible = !hidden.data;

  return (
    <Card style={styles.row}>
      <View style={styles.flex}>
        <Text style={styles.title}>Aparecer en la pizarra</Text>
        <Text style={styles.text}>Tus compañeros ven tu nombre, la inicial de tu apellido y tu resultado del WOD.</Text>
      </View>
      <Switch
        value={visible}
        disabled={toggle.isPending}
        onValueChange={(v) => toggle.mutate(!v)}
        trackColor={{ true: colors.accent, false: colors.line2 }}
        thumbColor="#fff"
        accessibilityLabel="Aparecer en la pizarra"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  title: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.fg },
  text: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.fgMute, marginTop: 2 },
});
