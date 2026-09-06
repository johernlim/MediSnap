import * as Notifications from 'expo-notifications';
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
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';
import ReminderForm from '../components/ReminderForm';
import ReminderItem from '../components/ReminderItem';
import { auth } from '../firebaseConfig';
import {
  cancelReminderNotifications,
  createReminderRecord,
  deleteReminderRecord,
  getUserNotificationPreference,
  scheduleReminderNotifications,
  setupReminderNotifications,
  subscribeToUserMedications,
  subscribeToUserReminders,
  updateReminderRecord,
} from '../services/reminderService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const emptyForm = {
  med_id: '',
  repeat_type: 'Daily',
  times_per_period: 1,
  reminder_times: [''],
  reminder_status: 'Active',
  start_date: '',
  weekly_day: '',
  monthly_day: '',
};

const emptyErrors = {
  med_id: '',
  repeat_type: '',
  times_per_period: '',
  reminder_times: [],
  reminder_status: '',
  start_date: '',
  weekly_day: '',
  monthly_day: '',
};

export default function RemindersScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  const [medications, setMedications] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState(emptyErrors);
  const [editingId, setEditingId] = useState(null);
  const [originalReminder, setOriginalReminder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initializeNotifications = async () => {
      const granted = await setupReminderNotifications();

      if (!granted) {
        Alert.alert(
          'Permission needed',
          'Notification permission is needed so reminder alerts can appear on your device.'
        );
      }
    };

    initializeNotifications();
  }, []);

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setLoading(false);
      return undefined;
    }

    const unsubscribeMedications = subscribeToUserMedications(
      currentUser.uid,
      (items) => {
        setMedications(items);
      },
      (error) => {
        console.error('Failed to load medications:', error);
        Alert.alert(t('error'), t('unableLoadMedications'));
      }
    );

    const unsubscribeReminders = subscribeToUserReminders(
      currentUser.uid,
      (items) => {
        setReminders(items);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to load reminders:', error);
        Alert.alert(t('error'), t('unableLoadReminders'));
        setLoading(false);
      }
    );

    return () => {
      unsubscribeMedications();
      unsubscribeReminders();
    };
  }, []);

  const validateTime = (value) => {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value).trim());
  };

  const validateDate = (value) => {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim());
  };

  const buildTimeErrors = () => {
    return formData.reminder_times.map((time) => {
      const trimmed = String(time).trim();

      if (!trimmed) {
        return 'Please fill this box';
      }

      if (!validateTime(trimmed)) {
        return 'Use HH:MM in 24-hour format';
      }

      return '';
    });
  };

  const validateForm = () => {
    const timeErrors = buildTimeErrors();
    const monthlyDayNumber = Number(formData.monthly_day);

    const newErrors = {
      med_id: formData.med_id ? '' : 'Please choose a medication',
      repeat_type: formData.repeat_type ? '' : 'Please choose repeat type',
      times_per_period: formData.times_per_period ? '' : 'Please choose times per period',
      reminder_times: timeErrors,
      reminder_status: formData.reminder_status ? '' : 'Please choose a status',
      start_date: formData.start_date.trim()
        ? validateDate(formData.start_date)
          ? ''
          : 'Use YYYY-MM-DD format'
        : 'Please choose a start date',
      weekly_day:
        formData.repeat_type === 'Weekly'
          ? formData.weekly_day
            ? ''
            : 'Please choose a weekday'
          : '',
      monthly_day:
        formData.repeat_type === 'Monthly'
          ? monthlyDayNumber >= 1 && monthlyDayNumber <= 31
            ? ''
            : 'Enter a value between 1 and 31'
          : '',
    };

    setErrors(newErrors);

    const hasTimeError = timeErrors.some((item) => item !== '');
    const hasOtherError = Object.entries(newErrors)
      .filter(([key]) => key !== 'reminder_times')
      .some(([, value]) => value !== '');

    return !hasTimeError && !hasOtherError;
  };

  const hasChanges = () => {
    if (!originalReminder) {
      return true;
    }

    return (
      JSON.stringify({
        med_id: formData.med_id,
        repeat_type: formData.repeat_type,
        times_per_period: Number(formData.times_per_period),
        reminder_times: formData.reminder_times.map((item) => item.trim()),
        reminder_status: formData.reminder_status,
        start_date: formData.start_date.trim(),
        weekly_day: formData.weekly_day,
        monthly_day: formData.monthly_day ? Number(formData.monthly_day) : '',
      }) !==
      JSON.stringify({
        med_id: originalReminder.med_id,
        repeat_type: originalReminder.repeat_type,
        times_per_period: Number(originalReminder.times_per_period),
        reminder_times: originalReminder.reminder_times.map((item) => item.trim()),
        reminder_status: originalReminder.reminder_status,
        start_date: String(originalReminder.start_date || '').trim(),
        weekly_day: originalReminder.weekly_day,
        monthly_day:
          originalReminder.monthly_day === 0 ? '' : originalReminder.monthly_day,
      })
    );
  };

  const handleChange = (field, value) => {
    if (field === 'repeat_type') {
      setFormData((prev) => ({
        ...prev,
        repeat_type: value,
        weekly_day: value === 'Weekly' ? prev.weekly_day : '',
        monthly_day: value === 'Monthly' ? prev.monthly_day : '',
      }));

      setErrors((prev) => ({
        ...prev,
        repeat_type: '',
        weekly_day: '',
        monthly_day: '',
      }));
      return;
    }

    if (field === 'times_per_period') {
      const count = Number(value);
      const nextTimes = Array.from({ length: count }, (_, index) => {
        return formData.reminder_times[index] || '';
      });

      setFormData((prev) => ({
        ...prev,
        times_per_period: count,
        reminder_times: nextTimes,
      }));

      setErrors((prev) => ({
        ...prev,
        times_per_period: '',
        reminder_times: Array.from({ length: count }, () => ''),
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [field]: '',
    }));
  };

  const handleTimeChange = (index, value) => {
    const updatedTimes = [...formData.reminder_times];
    updatedTimes[index] = value;

    const updatedTimeErrors = [...(errors.reminder_times || [])];
    updatedTimeErrors[index] = '';

    setFormData((prev) => ({
      ...prev,
      reminder_times: updatedTimes,
    }));

    setErrors((prev) => ({
      ...prev,
      reminder_times: updatedTimeErrors,
    }));
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setErrors(emptyErrors);
    setEditingId(null);
    setOriginalReminder(null);
  };

  const getMedication = (medId) => {
    return medications.find((item) => item.id === medId) || null;
  };

  const getMedicationName = (medId) => {
    const found = getMedication(medId);
    return found?.med_name || t('unknownMedication');
  };

  const handleSubmit = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      Alert.alert(t('loginRequired'), t('manageRemindersLogin'));
      return;
    }

    if (medications.length === 0) {
      Alert.alert(
        t('noMedicationsFound'),
        t('addMedicationFirst')
      );
      return;
    }

    const isValid = validateForm();

    if (!isValid) {
      return;
    }

    if (editingId && !hasChanges()) {
      Alert.alert(t('noChanges'), t('updateOneField'));
      return;
    }

    setSaving(true);

    try {
      const medication = getMedication(formData.med_id);
      const medicationName = medication?.med_name || 'Medication';
      const medicationDosage = medication?.dosage || '';

      if (editingId && originalReminder?.notification_ids?.length) {
        await cancelReminderNotifications(originalReminder.notification_ids);
      }

      let notificationIds = [];
      const notificationsEnabled = await getUserNotificationPreference(currentUser.uid);

      if (notificationsEnabled && formData.reminder_status === 'Active') {
        notificationIds = await scheduleReminderNotifications({
          medId: formData.med_id,
          medName: medicationName,
          dosage: medicationDosage,
          repeatType: formData.repeat_type,
          reminderTimes: formData.reminder_times.map((item) => item.trim()),
          weeklyDay: formData.weekly_day,
          monthlyDay: formData.monthly_day ? Number(formData.monthly_day) : 0,
        });
      }

      const payload = {
        med_id: formData.med_id,
        user_id: currentUser.uid,
        repeat_type: formData.repeat_type,
        times_per_period: Number(formData.times_per_period),
        reminder_times: formData.reminder_times.map((item) => item.trim()),
        reminder_status: formData.reminder_status,
        notification_ids: notificationIds,
        start_date: formData.start_date.trim(),
        weekly_day: formData.repeat_type === 'Weekly' ? formData.weekly_day : '',
        monthly_day: formData.repeat_type === 'Monthly' ? Number(formData.monthly_day) : 0,
      };

      if (editingId) {
        await updateReminderRecord(editingId, payload);
        Alert.alert(t('updated'), t('reminderUpdated'));
      } else {
        await createReminderRecord(payload);
        Alert.alert(t('saved'), t('reminderCreated'));
      }

      resetForm();
    } catch (error) {
      console.error('Failed to save reminder:', error);
      Alert.alert(t('error'), t('unableSaveReminder'));
    } finally {
      setSaving(false);
    }
  };

  const formatDateInput = (dateValue) => {
    if (!dateValue) {
      return '';
    }

    if (dateValue.seconds) {
      return new Date(dateValue.seconds * 1000).toISOString().slice(0, 10);
    }

    return String(dateValue);
  };

  const handleEdit = (item) => {
    const selectedData = {
      med_id: item.med_id || '',
      repeat_type: item.repeat_type || 'Daily',
      times_per_period: item.times_per_period || 1,
      reminder_times: item.reminder_times?.length ? item.reminder_times : [''],
      reminder_status: item.reminder_status || 'Active',
      start_date: formatDateInput(item.start_date),
      weekly_day: item.weekly_day || '',
      monthly_day: item.monthly_day || '',
      notification_ids: item.notification_ids || [],
    };

    setEditingId(item.id);
    setOriginalReminder(selectedData);
    setErrors({
      ...emptyErrors,
      reminder_times: Array.from(
        { length: selectedData.reminder_times.length },
        () => ''
      ),
    });
    setFormData(selectedData);
  };

  const handleDelete = (item) => {
    Alert.alert(t('deleteReminder'), t('deleteReminderQuestion'), [
      {
        text: t('cancel'),
        style: 'cancel',
      },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            if (item.notification_ids?.length) {
              await cancelReminderNotifications(item.notification_ids);
            }

            await deleteReminderRecord(item.id);

            if (editingId === item.id) {
              resetForm();
            }

            Alert.alert(t('deleted'), t('reminderDeleted'));
          } catch (error) {
            console.error('Failed to delete reminder:', error);
            Alert.alert(t('error'), t('unableDeleteReminder'));
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
            <Text style={styles.backButtonText}>{t('back')}</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>{t('reminderManagement')}</Text>
        <Text style={styles.subtitle}>
          Create medication reminders with one or more times, save them to Firestore,
          and schedule local notifications.
        </Text>

        {!currentUser ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t('noUser')}</Text>
          </View>
        ) : (
          <>
            <ReminderForm
              medications={medications}
              formData={formData}
              errors={errors}
              editingId={editingId}
              saving={saving}
              onChange={handleChange}
              onTimeChange={handleTimeChange}
              onSubmit={handleSubmit}
              onCancel={resetForm}
            />

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('yourReminders')}</Text>
              <Text style={styles.countText}>{reminders.length} item(s)</Text>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
            ) : reminders.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>{t('noReminders')}</Text>
              </View>
            ) : (
              reminders.map((item) => (
                <ReminderItem
                  key={item.id}
                  item={item}
                  medName={getMedicationName(item.med_id)}
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
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 22,
    lineHeight: 23,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  countText: {
    fontSize: 14,
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
