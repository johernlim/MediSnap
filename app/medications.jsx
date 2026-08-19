import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import MedicationForm from '../components/MedicationForm';
import MedicationItem from '../components/MedicationItem';
import { auth } from '../firebaseConfig';
import {
  createMedication,
  deleteMedicationById,
  subscribeToUserMedications,
  updateMedicationById,
} from '../services/medicationService';

const emptyForm = {
  med_name: '',
  dosage: '',
  frequency: '',
  med_desc: '',
};

const emptyErrors = {
  med_name: '',
  dosage: '',
  frequency: '',
  med_desc: '',
};

export default function MedicationsScreen() {
  const [medications, setMedications] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState(emptyErrors);
  const [editingId, setEditingId] = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        Alert.alert('Error', 'Unable to load medications right now.');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const validateForm = () => {
    const newErrors = {
      med_name: formData.med_name.trim() ? '' : 'Please fill this box',
      dosage: formData.dosage.trim() ? '' : 'Please fill this box',
      frequency: formData.frequency.trim() ? '' : 'Please fill this box',
      med_desc: formData.med_desc.trim() ? '' : 'Please fill this box',
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
      formData.dosage.trim() !== originalData.dosage.trim() ||
      formData.frequency.trim() !== originalData.frequency.trim() ||
      formData.med_desc.trim() !== originalData.med_desc.trim()
    );
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [field]: value.trim() ? '' : prev[field],
    }));
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setErrors(emptyErrors);
    setEditingId(null);
    setOriginalData(null);
  };

  const handleSubmit = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      Alert.alert('Login required', 'Please log in to manage medications.');
      return;
    }

    const isValid = validateForm();

    if (!isValid) {
      return;
    }

    if (editingId && !hasChanges()) {
      Alert.alert('No Changes', 'Please update after edited the data!!!');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        med_name: formData.med_name.trim(),
        dosage: formData.dosage.trim(),
        frequency: formData.frequency.trim(),
        med_desc: formData.med_desc.trim(),
        user_id: currentUser.uid,
      };

      if (editingId) {
        await updateMedicationById(editingId, payload);
        Alert.alert('Updated', 'Medication updated successfully.');
      } else {
        await createMedication(payload);
        Alert.alert('Added', 'Medication added successfully.');
      }

      resetForm();
    } catch (error) {
      console.error('Failed to save medication:', error);
      Alert.alert('Error', 'Unable to save medication right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    const selectedData = {
      med_name: item.med_name || '',
      dosage: item.dosage || '',
      frequency: item.frequency || '',
      med_desc: item.med_desc || '',
    };

    setEditingId(item.id);
    setOriginalData(selectedData);
    setErrors(emptyErrors);
    setFormData(selectedData);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete medication', 'Are you sure you want to delete this medication? It will also delete the medication reminder!!!', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMedicationById(id);

            if (editingId === id) {
              resetForm();
            }

            Alert.alert('Deleted', 'Medication deleted successfully.');
          } catch (error) {
            console.error('Failed to delete medication:', error);
            Alert.alert('Error', 'Unable to delete medication right now.');
          }
        },
      },
    ]);
  };

  const currentUser = auth.currentUser;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Medication Manager</Text>
        <Text style={styles.subtitle}>
          Add, update, and track medications for the current logged-in user.
        </Text>

        {!currentUser ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No authenticated user found.</Text>
          </View>
        ) : (
          <>
            <MedicationForm
              formData={formData}
              errors={errors}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onCancel={resetForm}
              editingId={editingId}
              saving={saving}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Medications</Text>
              <Text style={styles.countText}>{medications.length} item(s)</Text>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
            ) : medications.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No medications added yet.</Text>
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

const styles = StyleSheet.create({
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
