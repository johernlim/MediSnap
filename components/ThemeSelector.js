import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import { THEME_OPTIONS } from '../services/themeService';

export default function ThemeSelector({ value, onChange, disabled = false }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  return <View style={styles.container}>
    {THEME_OPTIONS.map((option) => {
      const selected = option.code === value;
      return <Pressable key={option.code} disabled={disabled} onPress={() => onChange(option.code)}
        style={[styles.option, selected && styles.selected, disabled && styles.disabled]}>
        <Text style={styles.icon}>{option.icon}</Text>
        <Text style={[styles.label, selected && styles.selectedLabel]}>{t(option.code)}</Text>
      </Pressable>;
    })}
  </View>;
}

const baseStyles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 10 },
  option: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, backgroundColor: '#ffffff' },
  selected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  disabled: { opacity: 0.6 }, icon: { fontSize: 24, marginBottom: 5 },
  label: { color: '#0f172a', fontSize: 16, fontWeight: '600' }, selectedLabel: { color: '#1d4ed8' },
});
