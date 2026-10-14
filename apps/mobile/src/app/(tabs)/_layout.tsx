import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors, fonts } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return <Ionicons name={name} color={color} size={size} />;
}

// Mismo orden que la barra inferior del portal web (PortalShell).
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.fgMute,
        tabBarLabelStyle: { fontFamily: fonts.condSemi, fontSize: 12, letterSpacing: 0.5 },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Membresía', tabBarIcon: (p) => <TabIcon name="card-outline" {...p} /> }}
      />
      <Tabs.Screen
        name="progreso"
        options={{ title: 'Progreso', tabBarIcon: (p) => <TabIcon name="stats-chart-outline" {...p} /> }}
      />
      <Tabs.Screen
        name="clases"
        options={{ title: 'Entrenar', tabBarIcon: (p) => <TabIcon name="barbell-outline" {...p} /> }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: (p) => <TabIcon name="person-outline" {...p} /> }}
      />
    </Tabs>
  );
}
