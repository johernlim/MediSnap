import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

export default function MedicationItem({ item, onEdit, onDelete }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {item.med_photo ? (
          <Image source={{ uri: item.med_photo }} style={styles.photo} />
        ) : null}

        <View style={styles.headerText}>
          <Text style={styles.name}>{item.med_name}</Text>
          <Text style={styles.detail}>{t('dosage')}: {item.dosage}</Text>
          <Text style={styles.detail}>{t('frequency')}: {item.frequency}</Text>
        </View>
      </View>

      {item.med_desc ? (
        <Text style={styles.description}>{item.med_desc}</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={[styles.editButton, styles.actionButtonSpacing]}
          onPress={() => onEdit(item)}
        >
          <Text style={styles.editButtonText}>{t('edit')}</Text>
        </Pressable>

        <Pressable style={styles.deleteButton} onPress={() => onDelete(item.id)}>
          <Text style={styles.deleteButtonText}>{t('delete')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  header: {
    flexDirection: 'row',
    gap: 14,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  detail: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 14,
  },
  actionButtonSpacing: {
    marginRight: 10,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#dc2626',
    fontWeight: '600',
  },
});
