import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import MedicationForm from '../components/MedicationForm';
import MedicationItem from '../components/MedicationItem';
import { auth } from '../firebaseConfig';
import {
  DEFAULT_DOSE_UNIT,
  FREQUENCY_PRESETS,
  composeDosage,
  composeFrequency,
  parseDosage,
  parseFrequency,
  validateDoseAmount,
  validateTimesPerDay,
} from '../services/medicationFormat';
import {
  createMedication,
  deleteMedicationById,
  subscribeToUserMedications,
  updateMedicationById,
} from '../services/medicationService';
import {
  captureMedicationPhoto,
  pickMedicationPhoto,
} from '../services/medicationPhoto';

const emptyForm = {
  med_name: '',
  dose_amount: '',
  dose_unit: DEFAULT_DOSE_UNIT,
  freq_mode: 'preset',
  freq_times: '1',
  med_desc: '',
  med_photo: '',
};

// Description is optional, so it has no error slot.
const emptyErrors = {
  med_name: '',
  dose_amount: '',
  freq_times: '',
};

export default function MedicationsScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  const [medications, setMedications] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState(emptyErrors);
  const [editingId, setEditingId] = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const scrollRef = useRef(null);

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = subscribeToUserMedications(
      currentUser.uid,
      (items) => {
        setMedications(items);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to load medications:', error);
        Alert.alert(t('error'), t('unableLoadMedications'));
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const validateForm = () => {
    const newErrors = {
      med_name: formData.med_name.trim() ? '' : 'Please fill this box',
      dose_amount: validateDoseAmount(formData.dose_amount),
      freq_times: validateTimesPerDay(formData.freq_times),
    };

    setErrors(newErrors);

    return !Object.values(newErrors).some((error) => error !== '');
  };

  const hasChanges = () => {
    if (!originalData) {
      return true;
    }

    return (
      formData.med_name.trim() !== originalData.med_name.trim() ||
      formData.dose_amount.trim() !== originalData.dose_amount.trim() ||
      formData.dose_unit !== originalData.dose_unit ||
      formData.freq_times.trim() !== originalData.freq_times.trim() ||
      formData.med_desc.trim() !== originalData.med_desc.trim() ||
      formData.med_photo !== originalData.med_photo
    );
  };

  const handleChange = (field, value) => {
    // The frequency chips write through a pseudo-field so one handler can set
    // both the mode and the number.
    if (field === 'freq_preset') {
      setFormData((prev) => ({
        ...prev,
        freq_mode: value === 'other' ? 'other' : 'preset',
        freq_times: value === 'other' ? '' : value,
      }));

      setErrors((prev) => ({ ...prev, freq_times: '' }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [field]: String(value).trim() ? '' : prev[field],
    }));
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setErrors(emptyErrors);
    setEditingId(null);
    setOriginalData(null);
  };

  // Both photo sources share the same handling: a null result means the user
  // backed out, and a throw carries a message worth showing (permission
  // refused, or an image too large even after compression).
  // One "Add Photo" button on the form; the camera-or-gallery choice happens
  // here rather than by giving the form a second control.
  const handleAddPhoto = () => {
    Alert.alert(t('addPhoto'), t('choosePhotoSource'), [
      {
        text: t('takePhoto'),
        onPress: () => runPhotoPicker(captureMedicationPhoto),
      },
      {
        text: t('chooseGallery'),
        onPress: () => runPhotoPicker(pickMedicationPhoto),
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const runPhotoPicker = async (picker) => {
    setPhotoBusy(true);

    try {
      const dataUri = await picker();

      if (dataUri) {
        setFormData((prev) => ({ ...prev, med_photo: dataUri }));
      }
    } catch (error) {
      console.error('Failed to attach medication photo:', error);
      Alert.alert(t('photo'), error?.message || t('photoUnavailable'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSubmit = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      Alert.alert(t('loginRequired'), t('manageMedicationsLogin'));
      return;
    }

    if (!validateForm()) {
      return;
    }

    if (editingId && !hasChanges()) {
      Alert.alert(t('noChanges'), t('updateOneField'));
      return;
    }

    setSaving(true);

    try {
      // Structured inputs are composed back into the single strings the rest
      // of the app already reads, so nothing downstream needs changing.
      const payload = {
        med_name: formData.med_name.trim(),
        dosage: composeDosage(formData.dose_amount, formData.dose_unit),
        frequency: composeFrequency(Number(formData.freq_times)),
        med_desc: formData.med_desc.trim(),
        med_photo: formData.med_photo || '',
        user_id: currentUser.uid,
      };

      if (editingId) {
        await updateMedicationById(editingId, payload);
        Alert.alert(t('updated'), t('medicationUpdated'));
      } else {
        await createMedication(payload);
        Alert.alert(t('added'), t('medicationAdded'));
      }

      resetForm();
    } catch (error) {
      console.error('Failed to save medication:', error);
      Alert.alert(t('error'), t('unableSaveMedication'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    const parsedDose = parseDosage(item.dosage);
    const parsedTimes = parseFrequency(item.frequency);

    // parseFrequency returns null for older free-text values such as
    // "Twice daily after meals". Guessing a number there would quietly change
    // the user's data, so the choice is left blank and validation asks for it.
    const isPreset =
      parsedTimes !== null && FREQUENCY_PRESETS.includes(parsedTimes);

    const selectedData = {
      med_name: item.med_name || '',
      dose_amount: parsedDose.amount,
      dose_unit: parsedDose.unit,
      freq_mode: parsedTimes !== null && !isPreset ? 'other' : 'preset',
      freq_times: parsedTimes !== null ? String(parsedTimes) : '',
      med_desc: item.med_desc || '',
      med_photo: item.med_photo || '',
    };

    setEditingId(item.id);
    setOriginalData(selectedData);
    setErrors(emptyErrors);
    setFormData(selectedData);

    // The form lives at the top of this scroll view. Without this, tapping
    // Edit on a medication further down the list changes the form off-screen
    // and reads as a button that does nothing.
    scrollRef.current?.scrollTo({ y: 0, animated: true });

    if (!parsedDose.matched || parsedTimes === null) {
      Alert.alert(
        'Check the dosage and frequency',
        'This medication was saved in the older free-text format, so some fields could not be filled in automatically. Please re-select them before updating.'
      );
    }
  };

  const handleDelete = (id) => {
    Alert.alert(
      t('deleteMedication'),
      t('deleteMedicationQuestion'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMedicationById(id);

              if (editingId === id) {
                resetForm();
              }

              Alert.alert(t('deleted'), t('medicationDeleted'));
            } catch (error) {
              console.error('Failed to delete medication:', error);
              Alert.alert(t('error'), t('unableDeleteMedication'));
            }
          },
        },
      ]
    );
  };

  const currentUser = auth.currentUser;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t('back')}</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>{t('medicationManager')}</Text>
        <Text style={styles.subtitle}>
          {t('medicationSubtitle')}
        </Text>

        {!currentUser ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t('noUser')}</Text>
          </View>
        ) : (
          <>
            <MedicationForm
              formData={formData}
              errors={errors}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onCancel={resetForm}
              onAddPhoto={handleAddPhoto}
              photoBusy={photoBusy}
              editingId={editingId}
              saving={saving}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('yourMedications')}</Text>
              <Text style={styles.countText}>{medications.length} item(s)</Text>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
            ) : medications.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>{t('noMedications')}</Text>
              </View>
            ) : (
              medications.map((item) => (
                <MedicationItem
                  key={item.id}
                  item={item}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 0,
  },
  container: {
    padding: 18,
    paddingBottom: 36,
  },
  topBar: {
    marginTop: 6,
    marginBottom: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: '#475569',
    marginBottom: 24,
    lineHeight: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
  },
  countText: {
    fontSize: 15,
    color: '#64748b',
  },
  loader: {
    marginTop: 24,
  },
  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
});
