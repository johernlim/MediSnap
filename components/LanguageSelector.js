import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGUAGE_OPTIONS } from '../services/languageService';
import { useThemedStyles } from '../hooks/use-themed-styles';

export default function LanguageSelector({ value, onChange, disabled = false }) {
  const styles = useThemedStyles(baseStyles);
  return <View style={styles.options}>
    {LANGUAGE_OPTIONS.map((language) => {
      const selected = value === language.code;
      return <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, disabled }}
        key={language.code}
        disabled={disabled}
        onPress={() => onChange(language.code)}
        style={[styles.option, selected && styles.selected, disabled && styles.disabled]}
      >
        <View style={[styles.radio, selected && styles.radioSelected]} />
        <View style={styles.labelBlock}>
          <Text style={[styles.label, selected && styles.selectedLabel]}>{language.nativeLabel}</Text>
        </View>
      </Pressable>;
    })}
  </View>;
}

const baseStyles = StyleSheet.create({
  options: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, backgroundColor: '#fff' },
  selected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  disabled: { opacity: 0.65 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#94a3b8', marginRight: 12 },
  radioSelected: { borderWidth: 6, borderColor: '#2563eb' },
  labelBlock: { flex: 1 },
  label: { color: '#0f172a', fontSize: 17, fontWeight: '600' },
  selectedLabel: { color: '#1d4ed8' },
  secondary: { color: '#64748b', fontSize: 13, marginTop: 2 },
});
