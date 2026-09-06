import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { auth, db } from '../firebaseConfig';
import {
  describeSnoozeBudget,
  formatClock,
  isFinalSnooze,
  nextSnoozeAt,
  SNOOZE_MINUTES,
} from '../services/doseChainUtils';

import {
  logDoseMissed,
  logDoseSnoozed,
  logDoseTaken,
} from '../services/doseLogService';
import {
  cancelReminderNotifications,
  scheduleManualSnooze,
  scheduleMissedNotice,
} from '../services/reminderService';

/**
 * Opened by tapping a reminder, or by its "Remind me later" button.
 *
 * There is nothing to configure here any more: a snooze is a fixed 30 minutes
 * and there are three of them. The photo is the reason the screen exists, since
 * expo-notifications cannot put a picture inside an Android notification.
 */
export default function DoseScreen() {
  const { t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  const params = useLocalSearchParams();

  const medId = typeof params.medId === 'string' ? params.medId : '';
  const scheduledTime =
    typeof params.scheduledTime === 'string' ? params.scheduledTime : '';

  // How many reminders this dose has already used up.
  const attemptsUsed = Number(params.attempt) || 0;

  // The remaining chain notifications, so answering here cancels them.
  const chainIds =
    typeof params.chainIds === 'string' && params.chainIds
      ? params.chainIds.split(',').filter(Boolean)
      : [];

  const reminderTimes =
    typeof params.reminderTimes === 'string' && params.reminderTimes
      ? params.reminderTimes.split(',').map((item) => item.trim()).filter(Boolean)
      : [];

  const [medication, setMedication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const currentUser = auth.currentUser;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!medId) {
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, 'medications', medId));

        if (!cancelled) {
          setMedication(snapshot.exists() ? snapshot.data() : null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load medication:', error);

        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [medId]);

  // Falls back to what the notification carried, so the screen still reads
  // correctly if the medication has since been deleted.
  const medName =
    medication?.med_name ||
    (typeof params.medName === 'string' ? params.medName : 'Medication');
  const dosage =
    medication?.dosage || (typeof params.dosage === 'string' ? params.dosage : '');

  const outOfSnoozes = isFinalSnooze(attemptsUsed);

  const handleTaken = async () => {
    if (!currentUser) {
      Alert.alert('Login required', 'Please log in first.');
      return;
    }

    setWorking(true);

    try {
      // Cancelled first: if logging fails the user should still not be chased
      // about a dose they have taken.
      await cancelReminderNotifications(chainIds);

      await logDoseTaken({
        userId: currentUser.uid,
        medId,
        medName,
        dosage,
        scheduledTime,
      });

      Alert.alert('Recorded', `${medName} marked as taken.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to log dose:', error);
      Alert.alert('Error', 'Unable to record that right now.');
    } finally {
      setWorking(false);
    }
  };

  const handleSnooze = async () => {
    if (!currentUser) {
      Alert.alert('Login required', 'Please log in first.');
      return;
    }

    setWorking(true);

    try {
      await cancelReminderNotifications(chainIds);

      // The budget is spent. Rather than offering a separate "mark as missed"
      // control, the same button quietly records the dose as missed — the
      // notification that follows is what tells the user.
      if (outOfSnoozes) {
        const at = new Date(Date.now() + 1000);

        await scheduleMissedNotice({ medName, dosage, scheduledTime, at });

        await logDoseMissed({
          userId: currentUser.uid,
          medId,
          medName,
          dosage,
          scheduledTime,
        });

        Alert.alert(
          'Recorded as missed',
          `${medName} scheduled for ${scheduledTime} has been recorded as missed. No further reminders will be sent for this dose.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );

        return;
      }

      const attempt = attemptsUsed + 1;
      const remindAt = nextSnoozeAt(new Date());

      const notificationId = await scheduleManualSnooze({
        medId,
        medName,
        dosage,
        reminderTimes,
        scheduledTime,
        attempt,
        remindAt,
      });

      await logDoseSnoozed({
        userId: currentUser.uid,
        medId,
        medName,
        dosage,
        scheduledTime,
        minutes: SNOOZE_MINUTES,
        remindAt,
        notificationId,
      });

      Alert.alert(
        'Reminder set',
        `We will remind you again at ${formatClock(remindAt)}.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Failed to snooze:', error);
      Alert.alert('Error', 'Unable to set that reminder.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t('close')}</Text>
          </Pressable>
        </View>

        <Text style={styles.eyebrow}>
          {scheduledTime ? `Scheduled for ${scheduledTime}` : 'Medication reminder'}
        </Text>
        <Text style={styles.title}>{t('timeToTake')}</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
        ) : (
          <>
            {medication?.med_photo ? (
              <Image
                source={{ uri: medication.med_photo }}
                style={styles.photo}
                resizeMode="cover"
              />
            ) : null}

            <View style={styles.card}>
              <Text style={styles.medName}>{medName}</Text>
              {dosage ? <Text style={styles.dosage}>{dosage}</Text> : null}
              {medication?.med_desc ? (
                <Text style={styles.desc}>{medication.med_desc}</Text>
              ) : null}
            </View>

            <Pressable
              style={[styles.takenButton, working && styles.disabled]}
              onPress={handleTaken}
              disabled={working}
            >
              <Text style={styles.takenButtonText}>
                {working ? 'Saving...' : "I've taken it"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.snoozeButton, working && styles.disabled]}
              onPress={handleSnooze}
              disabled={working}
            >
              <Text style={styles.snoozeButtonText}>{t('remindLater')}</Text>
            </Pressable>

            <Text
              style={[styles.budget, outOfSnoozes && styles.budgetSpent]}
            >
              {describeSnoozeBudget(attemptsUsed)}
            </Text>
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
  container: { padding: 18, paddingBottom: 40 },
  topBar: { marginTop: 6, marginBottom: 14 },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: { color: '#0f172a', fontSize: 16, fontWeight: '600' },
  eyebrow: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 18,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    marginBottom: 18,
    backgroundColor: '#e2e8f0',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  medName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  dosage: { fontSize: 20, color: '#1d4ed8', fontWeight: '600' },
  desc: { fontSize: 15, color: '#64748b', lineHeight: 22, marginTop: 10 },
  takenButton: {
    backgroundColor: '#16a34a',
    borderRadius: 16,
    paddingVertical: 22,
    alignItems: 'center',
    marginBottom: 12,
  },
  takenButtonText: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  snoozeButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  snoozeButtonText: { color: '#334155', fontSize: 18, fontWeight: '700' },
  budget: {
    fontSize: 13.5,
    color: '#64748b',
    lineHeight: 20,
    marginTop: 12,
    textAlign: 'center',
  },
  budgetSpent: { color: '#b91c1c', fontWeight: '600' },
  disabled: { opacity: 0.7 },
  loader: { marginTop: 40 },
});
