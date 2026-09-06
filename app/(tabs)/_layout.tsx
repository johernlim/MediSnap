import { Tabs } from 'expo-router';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function TabLayout() {
  const { t } = useLanguage();
  const { dark } = useAppTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      sceneStyle: { backgroundColor: dark ? '#0f172a' : '#f8fafc' },
      tabBarStyle: { backgroundColor: dark ? '#1e293b' : '#ffffff', borderTopColor: dark ? '#334155' : '#e2e8f0' },
      tabBarActiveTintColor: dark ? '#93c5fd' : '#2563eb',
      tabBarInactiveTintColor: dark ? '#94a3b8' : '#64748b',
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
