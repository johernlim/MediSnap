import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

export default function ProfileViewCard({ profile, onEdit }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  const renderRow = (label, value) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value ? String(value) : '-'}</Text>
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('profileInformation')}</Text>

      {renderRow(t('username'), profile.username)}
      {renderRow(t('email'), profile.email)}
      {renderRow(t('fullName'), profile.full_name)}
      {renderRow(t('age'), profile.age)}
      {renderRow(t('gender'), profile.gender)}
      {renderRow(t('height'), profile.height ? `${profile.height} cm` : '')}
      {renderRow(t('weight'), profile.weight ? `${profile.weight} kg` : '')}

      <Pressable style={styles.editButton} onPress={onEdit}>
        <Text style={styles.editButtonText}>{t('editProfile')}</Text>
      </Pressable>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14,
  },
  row: {
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
  },
  editButton: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
