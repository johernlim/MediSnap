import { StyleSheet, Switch, Text, View } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

export default function NotificationSettingsCard({
  enabled,
  saving,
  onToggle,
}) {
  const { t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('notifications')}</Text>
      <Text style={styles.description}>
        {t('notificationHelp')}
      </Text>

      <View style={styles.row}>
        <View style={styles.textBox}>
          <Text style={styles.label}>{t('reminderNotifications')}</Text>
          <Text style={styles.statusText}>
            {enabled ? t('enabled') : t('disabled')}
            {saving ? ` • ${t('saving')}` : ''}
          </Text>
        </View>

        <Switch
          value={enabled}
          onValueChange={onToggle}
          disabled={saving}
          trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
          thumbColor={enabled ? '#2563eb' : '#f8fafc'}
        />
      </View>
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
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textBox: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  statusText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
});
