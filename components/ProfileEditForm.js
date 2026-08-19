import { useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

const ageOptions = Array.from({ length: 120 }, (_, index) => index + 1);
const heightOptions = Array.from({ length: 81 }, (_, index) => index + 140);
const weightOptions = Array.from({ length: 200 }, (_, index) => index + 1);
const genderOptions = ['Male', 'Female'];

export default function ProfileEditForm({
  formData,
  saving,
  onChange,
  onSave,
  onCancel,
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerField, setPickerField] = useState('');
  const [pickerOptions, setPickerOptions] = useState([]);
  const [pickerUnit, setPickerUnit] = useState('');

  const fieldDisplayValues = useMemo(
    () => ({
      age: formData.age ? String(formData.age) : 'Select age',
      gender: formData.gender || 'Select gender',
      height: formData.height ? `${formData.height} cm` : 'Select height',
      weight: formData.weight ? `${formData.weight} kg` : 'Select weight',
    }),
    [formData.age, formData.gender, formData.height, formData.weight]
  );

  const openPicker = (field, title, options, unit = '') => {
    setPickerField(field);
    setPickerTitle(title);
    setPickerOptions(options);
    setPickerUnit(unit);
    setPickerVisible(true);
  };

  const closePicker = () => {
    setPickerVisible(false);
    setPickerField('');
    setPickerTitle('');
    setPickerOptions([]);
    setPickerUnit('');
  };

  const handleSelectOption = (value) => {
    onChange(pickerField, value);
    closePicker();
  };

  const renderSelector = (label, value, onPress) => (
    <View style={styles.selectorBlock}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.selectorButton} onPress={onPress}>
        <Text
          style={[
            styles.selectorText,
            !value || value.toLowerCase().includes('select') ? styles.placeholderText : null,
          ]}
        >
          {value}
        </Text>
        <Text style={styles.selectorArrow}>▼</Text>
      </Pressable>
    </View>
  );

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.title}>Edit Profile</Text>

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={formData.username}
          onChangeText={(value) => onChange('username', value)}
          placeholder="Enter username"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value={formData.email}
          editable={false}
          placeholder="Email"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.helperText}>
          Email is shown from your account record and is not edited in this form.
        </Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={formData.full_name}
          onChangeText={(value) => onChange('full_name', value)}
          placeholder="Enter full name"
          placeholderTextColor="#94a3b8"
        />

        {renderSelector('Age', fieldDisplayValues.age, () =>
          openPicker('age', 'Select Age', ageOptions)
        )}

        {renderSelector('Gender', fieldDisplayValues.gender, () =>
          openPicker('gender', 'Select Gender', genderOptions)
        )}

        {renderSelector('Height (cm)', fieldDisplayValues.height, () =>
          openPicker('height', 'Select Height', heightOptions, 'cm')
        )}

        {renderSelector('Weight (kg)', fieldDisplayValues.weight, () =>
          openPicker('weight', 'Select Weight', weightOptions, 'kg')
        )}

        <Pressable
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
        </Pressable>

        <Pressable style={styles.cancelButton} onPress={onCancel} disabled={saving}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{pickerTitle}</Text>

            <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
              {pickerOptions.map((item) => {
                const label = pickerUnit ? `${item} ${pickerUnit}` : String(item);
                return (
                  <Pressable
                    key={String(item)}
                    style={styles.optionButton}
                    onPress={() => handleSelectOption(item)}
                  >
                    <Text style={styles.optionText}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.modalCancelButton} onPress={closePicker}>
              <Text style={styles.modalCancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
  label: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  readOnlyInput: {
    backgroundColor: '#f8fafc',
    color: '#64748b',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: -2,
    marginBottom: 12,
  },
  selectorBlock: {
    marginBottom: 12,
  },
  selectorButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    color: '#0f172a',
    fontSize: 16,
  },
  placeholderText: {
    color: '#94a3b8',
  },
  selectorArrow: {
    color: '#64748b',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14,
    textAlign: 'center',
  },
  optionsList: {
    marginBottom: 12,
  },
  optionButton: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  optionText: {
    fontSize: 16,
    color: '#0f172a',
    textAlign: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
});
