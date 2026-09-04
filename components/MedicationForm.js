import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DOSE_UNITS, FREQUENCY_PRESETS } from '../services/medicationFormat';

export default function MedicationForm({
  formData,
  errors,
  onChange,
  onSubmit,
  onCancel,
  onAddPhoto,
  photoBusy,
  editingId,
  saving,
}) {
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);

  const selectedUnit =
    DOSE_UNITS.find((unit) => unit.value === formData.dose_unit) || DOSE_UNITS[0];

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

  const isOtherFrequency = formData.freq_mode === 'other';

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.heading}>
          {editingId ? 'Edit Medication' : 'Add Medication'}
        </Text>

        <Text style={styles.label}>
          Medication Name <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, errors.med_name && styles.inputError]}
          placeholder="e.g. Panadol"
          placeholderTextColor="#94a3b8"
          value={formData.med_name}
          onChangeText={(value) => onChange('med_name', value)}
        />
        {renderError('med_name')}

        <Text style={styles.label}>
          Dosage <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.dosageRow}>
          <TextInput
            style={[
              styles.input,
              styles.amountInput,
              errors.dose_amount && styles.inputError,
            ]}
            placeholder="0"
            placeholderTextColor="#94a3b8"
            value={formData.dose_amount}
            onChangeText={(value) => onChange('dose_amount', value)}
            // decimal-pad, not number-pad: half tablets are common.
            keyboardType="decimal-pad"
          />

          {/*
            A Pressable that opens a modal, not a <Picker>. The native picker
            renders as an inline wheel on iOS, so a one-line box clips it to a
            sliver that cannot be scrolled or tapped. This behaves identically on
            both platforms and matches the selectors in ProfileEditForm.
          */}
          <Pressable
            style={styles.unitButton}
            onPress={() => setUnitPickerVisible(true)}
          >
            <Text style={styles.unitButtonText}>{selectedUnit.label}</Text>
            <Text style={styles.unitArrow}>▼</Text>
          </Pressable>
        </View>
        {renderError('dose_amount')}

        <View style={styles.spacer} />

        <Text style={styles.label}>
          Frequency <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.chipRow}>
          {FREQUENCY_PRESETS.map((times) => {
            const selected =
              formData.freq_mode === 'preset' &&
              Number(formData.freq_times) === times;

            return (
              <Pressable
                key={times}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => onChange('freq_preset', String(times))}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {times}x/day
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            style={[styles.chip, isOtherFrequency && styles.chipSelected]}
            onPress={() => onChange('freq_preset', 'other')}
          >
            <Text
              style={[
                styles.chipText,
                isOtherFrequency && styles.chipTextSelected,
              ]}
            >
              Other
            </Text>
          </Pressable>
        </View>

        {isOtherFrequency ? (
          <View style={styles.otherRow}>
            <TextInput
              style={[
                styles.input,
                styles.otherInput,
                errors.freq_times && styles.inputError,
              ]}
              placeholder="4"
              placeholderTextColor="#94a3b8"
              value={formData.freq_times}
              onChangeText={(value) => onChange('freq_times', value)}
              keyboardType="number-pad"
            />
            <Text style={styles.otherSuffix}>times per day</Text>
          </View>
        ) : null}
        {renderError('freq_times')}

        <Text style={styles.label}>
          Photo <Text style={styles.optional}>(optional)</Text>
        </Text>
        {formData.med_photo ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: formData.med_photo }} style={styles.photo} />

            <View style={styles.photoActions}>
              <Pressable
                style={[styles.photoButton, photoBusy && styles.disabledButton]}
                onPress={onAddPhoto}
                disabled={photoBusy}
              >
                <Text style={styles.photoButtonText}>Change</Text>
              </Pressable>

              <Pressable
                style={styles.photoRemove}
                onPress={() => onChange('med_photo', '')}
                disabled={photoBusy}
              >
                <Text style={styles.photoRemoveText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          // One button; the camera-or-gallery choice is made in the sheet it
          // opens, which keeps the form from growing a second control that most
          // users only ever tap one of.
          <Pressable
            style={[styles.addPhotoButton, photoBusy && styles.disabledButton]}
            onPress={onAddPhoto}
            disabled={photoBusy}
          >
            <Text style={styles.addPhotoText}>
              {photoBusy ? 'Working...' : '+  Add Photo'}
            </Text>
          </Pressable>
        )}

        <Text style={styles.label}>
          Description <Text style={styles.optional}>(optional)</Text>
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What is it for, and anything to remember"
          placeholderTextColor="#94a3b8"
          value={formData.med_desc}
          onChangeText={(value) => onChange('med_desc', value)}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <View style={styles.spacer} />

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

      <Modal
        visible={unitPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUnitPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Unit</Text>

            <ScrollView
              style={styles.optionsList}
              showsVerticalScrollIndicator={false}
            >
              {DOSE_UNITS.map((unit) => {
                const selected = unit.value === formData.dose_unit;

                return (
                  <Pressable
                    key={unit.value}
                    style={[
                      styles.optionButton,
                      selected && styles.optionButtonSelected,
                    ]}
                    onPress={() => {
                      onChange('dose_unit', unit.value);
                      setUnitPickerVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selected && styles.optionTextSelected,
                      ]}
                    >
                      {unit.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => setUnitPickerVisible(false)}
            >
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
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  required: {
    color: '#dc2626',
  },
  optional: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  spacer: {
    height: 6,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  photo: {
    width: 92,
    height: 92,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  photoActions: {
    flex: 1,
    gap: 8,
  },
  photoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  addPhotoButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  addPhotoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  photoRemove: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fee2e2',
  },
  photoRemoveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 8,
  },
  inputError: {
    borderColor: '#dc2626',
    borderWidth: 2,
  },
  textArea: {
    minHeight: 110,
  },
  dosageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  amountInput: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 18,
  },
  unitButton: {
    width: 130,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
    paddingHorizontal: 14,
    // Matches the amount box beside it, so the two line up exactly.
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
  },
  unitArrow: {
    fontSize: 12,
    color: '#64748b',
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
  optionButtonSelected: {
    backgroundColor: '#eff6ff',
  },
  optionText: {
    fontSize: 16,
    color: '#0f172a',
    textAlign: 'center',
  },
  optionTextSelected: {
    fontWeight: '700',
    color: '#1d4ed8',
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  otherInput: {
    width: 90,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 18,
  },
  otherSuffix: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 8,
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
