import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const repeatTypeOptions = ['Daily', 'Weekly', 'Monthly'];
const statusOptions = ['Active', 'Inactive'];
const weekdayOptions = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const timesPerPeriodOptions = [1, 2, 3, 4, 5];

function formatDateToYMD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseYMDToDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date();
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatTimeToHM(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function parseHMToDate(value) {
  const base = new Date();
  base.setSeconds(0);
  base.setMilliseconds(0);

  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return base;
  }

  const [hours, minutes] = value.split(':').map(Number);
  base.setHours(hours);
  base.setMinutes(minutes);
  return base;
}

function formatTimeDisplay(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return 'Select time';
  }

  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours);
  date.setMinutes(minutes);
  date.setSeconds(0);
  date.setMilliseconds(0);

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ReminderForm({
  medications,
  formData,
  errors,
  editingId,
  saving,
  onChange,
  onTimeChange,
  onSubmit,
  onCancel,
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(parseYMDToDate(formData.start_date));

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(null);
  const [tempTime, setTempTime] = useState(parseHMToDate('08:00'));

  const renderError = (message) => {
    if (!message) {
      return null;
    }

    return <Text style={styles.errorText}>{message}</Text>;
  };

  const openDatePicker = () => {
    setTempDate(parseYMDToDate(formData.start_date));
    setShowDatePicker(true);
  };

  const handleDateChange = (_, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);

      if (selectedDate) {
        onChange('start_date', formatDateToYMD(selectedDate));
      }

      return;
    }

    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const handleIOSConfirmDate = () => {
    onChange('start_date', formatDateToYMD(tempDate));
    setShowDatePicker(false);
  };

  const handleIOSCancelDate = () => {
    setTempDate(parseYMDToDate(formData.start_date));
    setShowDatePicker(false);
  };

  const openTimePicker = (index) => {
    setSelectedTimeIndex(index);
    setTempTime(parseHMToDate(formData.reminder_times[index]));
    setShowTimePicker(true);
  };

  const handleTimePickerChange = (_, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);

      if (selectedDate && selectedTimeIndex !== null) {
        onTimeChange(selectedTimeIndex, formatTimeToHM(selectedDate));
      }

      return;
    }

    if (selectedDate) {
      setTempTime(selectedDate);
    }
  };

  const handleIOSConfirmTime = () => {
    if (selectedTimeIndex !== null) {
      onTimeChange(selectedTimeIndex, formatTimeToHM(tempTime));
    }

    setShowTimePicker(false);
    setSelectedTimeIndex(null);
  };

  const handleIOSCancelTime = () => {
    setShowTimePicker(false);
    setSelectedTimeIndex(null);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>
        {editingId ? 'Edit Reminder' : 'Add Reminder'}
      </Text>

      <Text style={styles.label}>Choose Medication</Text>
      <View style={styles.medicationList}>
        {medications.length === 0 ? (
          <View style={styles.emptyMedicationBox}>
            <Text style={styles.emptyMedicationText}>
              No medications found. Add medication first.
            </Text>
          </View>
        ) : (
          medications.map((item) => {
            const isSelected = formData.med_id === item.id;

            return (
              <Pressable
                key={item.id}
                style={[
                  styles.medicationChip,
                  isSelected && styles.medicationChipSelected,
                ]}
                onPress={() => onChange('med_id', item.id)}
              >
                <Text
                  style={[
                    styles.medicationChipText,
                    isSelected && styles.medicationChipTextSelected,
                  ]}
                >
                  {item.med_name}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>
      {renderError(errors.med_id)}

      <Text style={styles.label}>Repeat Type</Text>
      <View style={styles.optionRowWrap}>
        {repeatTypeOptions.map((option) => {
          const isSelected = formData.repeat_type === option;

          return (
            <Pressable
              key={option}
              style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
              onPress={() => onChange('repeat_type', option)}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  isSelected && styles.optionButtonTextSelected,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {renderError(errors.repeat_type)}

      <Text style={styles.label}>Times Per Period</Text>
      <View style={styles.optionRowWrap}>
        {timesPerPeriodOptions.map((option) => {
          const isSelected = Number(formData.times_per_period) === option;

          return (
            <Pressable
              key={option}
              style={[styles.smallOptionButton, isSelected && styles.optionButtonSelected]}
              onPress={() => onChange('times_per_period', option)}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  isSelected && styles.optionButtonTextSelected,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {renderError(errors.times_per_period)}

      <Text style={styles.label}>Reminder Times</Text>
      {formData.reminder_times.map((time, index) => (
        <View key={index}>
          <Pressable
            style={[
              styles.input,
              styles.dateInputButton,
              errors.reminder_times?.[index] && styles.inputError,
            ]}
            onPress={() => openTimePicker(index)}
          >
            <Text
              style={[
                styles.dateInputText,
                !time && styles.datePlaceholderText,
              ]}
            >
              {time ? formatTimeDisplay(time) : `Select time ${index + 1}`}
            </Text>
          </Pressable>
          {renderError(errors.reminder_times?.[index])}
        </View>
      ))}

      <Text style={styles.helperText}>Tap each field to choose the reminder time.</Text>

      <Text style={styles.label}>Start Date</Text>
      <Pressable
        style={[styles.input, styles.dateInputButton, errors.start_date && styles.inputError]}
        onPress={openDatePicker}
      >
        <Text
          style={[
            styles.dateInputText,
            !formData.start_date && styles.datePlaceholderText,
          ]}
        >
          {formData.start_date || 'Select start date'}
        </Text>
      </Pressable>
      {renderError(errors.start_date)}

      {showDatePicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parseYMDToDate(formData.start_date)}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={handleDateChange}
        />
      ) : null}

      {showTimePicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={tempTime}
          mode="time"
          display="default"
          is24Hour
          onChange={handleTimePickerChange}
        />
      ) : null}

      <Modal
        visible={showDatePicker && Platform.OS === 'ios'}
        transparent
        animationType="slide"
        onRequestClose={handleIOSCancelDate}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Start Date</Text>

            <DateTimePicker
              value={tempDate}
              mode="date"
              display="inline"
              minimumDate={new Date()}
              onChange={handleDateChange}
              themeVariant="light"
              accentColor="#2563eb"
            />

            <View style={styles.modalButtonRow}>
              <Pressable style={styles.modalCancelButton} onPress={handleIOSCancelDate}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable style={styles.modalDoneButton} onPress={handleIOSConfirmDate}>
                <Text style={styles.modalDoneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTimePicker && Platform.OS === 'ios'}
        transparent
        animationType="slide"
        onRequestClose={handleIOSCancelTime}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Reminder Time</Text>

            <DateTimePicker
              value={tempTime}
              mode="time"
              display="spinner"
              onChange={handleTimePickerChange}
              themeVariant="light"
              textColor="#000000"
              accentColor="#2563eb"
            />

            <View style={styles.modalButtonRow}>
              <Pressable style={styles.modalCancelButton} onPress={handleIOSCancelTime}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable style={styles.modalDoneButton} onPress={handleIOSConfirmTime}>
                <Text style={styles.modalDoneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {formData.repeat_type === 'Weekly' ? (
        <>
          <Text style={styles.label}>Weekly Day</Text>
          <View style={styles.optionRowWrap}>
            {weekdayOptions.map((option) => {
              const isSelected = formData.weekly_day === option;

              return (
                <Pressable
                  key={option}
                  style={[styles.weekdayButton, isSelected && styles.optionButtonSelected]}
                  onPress={() => onChange('weekly_day', option)}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      isSelected && styles.optionButtonTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {renderError(errors.weekly_day)}
        </>
      ) : null}

      {formData.repeat_type === 'Monthly' ? (
        <>
          <Text style={styles.label}>Day Of Month</Text>
          <TextInput
            style={[styles.input, errors.monthly_day && styles.inputError]}
            placeholder="Enter day between 1 and 31"
            placeholderTextColor="#6b7280"
            value={String(formData.monthly_day || '')}
            onChangeText={(value) => onChange('monthly_day', value)}
            keyboardType="number-pad"
          />
          {renderError(errors.monthly_day)}
        </>
      ) : null}

      <Text style={styles.label}>Reminder Status</Text>
      <View style={styles.optionRow}>
        {statusOptions.map((option) => {
          const isSelected = formData.reminder_status === option;

          return (
            <Pressable
              key={option}
              style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
              onPress={() => onChange('reminder_status', option)}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  isSelected && styles.optionButtonTextSelected,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {renderError(errors.reminder_status)}

      <Pressable
        style={[styles.primaryButton, saving && styles.disabledButton]}
        onPress={onSubmit}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>
          {saving ? 'Saving...' : editingId ? 'Update Reminder' : 'Save Reminder'}
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
  label: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 10,
  },
  medicationList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  medicationChip: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 10,
    marginBottom: 10,
  },
  medicationChipSelected: {
    backgroundColor: '#2563eb',
  },
  medicationChipText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  medicationChipTextSelected: {
    color: '#ffffff',
  },
  emptyMedicationBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyMedicationText: {
    color: '#64748b',
    fontSize: 15,
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
    marginBottom: 6,
  },
  dateInputButton: {
    justifyContent: 'center',
  },
  dateInputText: {
    fontSize: 18,
    color: '#0f172a',
  },
  datePlaceholderText: {
    color: '#6b7280',
  },
  inputError: {
    borderColor: '#dc2626',
    borderWidth: 2,
  },
  helperText: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  optionRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 10,
    minWidth: 100,
  },
  smallOptionButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 10,
  },
  weekdayButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 10,
  },
  optionButtonSelected: {
    backgroundColor: '#2563eb',
  },
  optionButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  optionButtonTextSelected: {
    color: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
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
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    marginBottom: 12,
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  modalCancelButton: {
    flex: 1,
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
  modalDoneButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDoneText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
