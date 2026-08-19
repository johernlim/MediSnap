import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function MedicationItem({ item, onEdit, onDelete }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.med_name}</Text>
      <Text style={styles.detail}>Dosage: {item.dosage}</Text>
      <Text style={styles.detail}>Frequency: {item.frequency}</Text>
      <Text style={styles.description}>
        {item.med_desc ? item.med_desc : 'No description provided.'}
      </Text>

      <View style={styles.actions}>
        <Pressable
          style={[styles.editButton, styles.actionButtonSpacing]}
          onPress={() => onEdit(item)}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>

        <Pressable style={styles.deleteButton} onPress={() => onDelete(item.id)}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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