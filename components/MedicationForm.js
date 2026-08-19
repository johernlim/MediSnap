import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function MedicationForm({
  formData,
  errors,
  onChange,
  onSubmit,
  onCancel,
  editingId,
  saving,
}) {
  const renderError = (field) => {
    if (!errors[field]) {
      return null;
    }

    return (
      <View style={styles.errorRow}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorText}>{errors[field]}</Text>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>
        {editingId ? 'Edit Medication' : 'Add Medication'}
      </Text>

      <TextInput
        style={[styles.input, errors.med_name && styles.inputError]}
        placeholder="Medication name"
        placeholderTextColor="#6b7280"
        value={formData.med_name}
        onChangeText={(value) => onChange('med_name', value)}
      />
      {renderError('med_name')}

      <TextInput
        style={[styles.input, errors.dosage && styles.inputError]}
        placeholder="Dosage"
        placeholderTextColor="#6b7280"
        value={formData.dosage}
        onChangeText={(value) => onChange('dosage', value)}
      />
      {renderError('dosage')}

      <TextInput
        style={[styles.input, errors.frequency && styles.inputError]}
        placeholder="Frequency"
        placeholderTextColor="#6b7280"
        value={formData.frequency}
        onChangeText={(value) => onChange('frequency', value)}
      />
      {renderError('frequency')}

      <TextInput
        style={[
          styles.input,
          styles.textArea,
          errors.med_desc && styles.inputError,
        ]}
        placeholder="Description"
        placeholderTextColor="#6b7280"
        value={formData.med_desc}
        onChangeText={(value) => onChange('med_desc', value)}
        multiline
        numberOfLines={5}
        textAlignVertical="top"
      />
      {renderError('med_desc')}

      <Pressable
        style={[styles.primaryButton, saving && styles.disabledButton]}
        onPress={onSubmit}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>
          {saving ? 'Saving...' : editingId ? 'Update Medication' : 'Add Medication'}
        </Text>
      </Pressable>

      {editingId ? (
        <Pressable style={styles.secondaryButton} onPress={onCancel}>
          <Text style={styles.secondaryButtonText}>Cancel Edit</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 8,
  },
  inputError: {
    borderColor: '#dc2626',
    borderWidth: 2,
  },
  textArea: {
    minHeight: 130,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginLeft: 4,
  },
  errorIcon: {
    color: '#dc2626',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 6,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 17,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
});
