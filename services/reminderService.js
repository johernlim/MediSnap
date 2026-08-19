import * as Notifications from 'expo-notifications';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../firebaseConfig';

const remindersCollection = collection(db, 'reminders');
const medicationsCollection = collection(db, 'medications');

const weekdayMap = {
  Sunday: 1,
  Monday: 2,
  Tuesday: 3,
  Wednesday: 4,
  Thursday: 5,
  Friday: 6,
  Saturday: 7,
};

function parseTimeString(timeValue) {
  const [hourText, minuteText] = String(timeValue).split(':');
  return {
    hour: Number(hourText),
    minute: Number(minuteText),
  };
}

function addAndroidChannel(trigger) {
  if (Platform.OS === 'android') {
    return {
      ...trigger,
      channelId: 'reminders',
    };
  }

  return trigger;
}

export async function setupReminderNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Medication Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    });
  }

  return true;
}

export async function scheduleReminderNotifications({
  medName,
  dosage,
  repeatType,
  reminderTimes,
  weeklyDay,
  monthlyDay,
}) {
  const notificationIds = [];
  const bodyText = dosage
    ? `Time to take ${medName} with Dosage: ${dosage}.`
    : `Time to take ${medName}.`;

  for (const timeValue of reminderTimes) {
    const trimmedTime = String(timeValue).trim();

    if (!trimmedTime) {
      continue;
    }

    const { hour, minute } = parseTimeString(trimmedTime);
    let trigger = null;

    if (repeatType === 'Daily') {
      trigger = addAndroidChannel({
        type: 'daily',
        hour,
        minute,
      });
    }

    if (repeatType === 'Weekly') {
      const weekday = weekdayMap[weeklyDay] || 1;

      trigger = addAndroidChannel({
        type: 'weekly',
        weekday,
        hour,
        minute,
      });
    }

    if (repeatType === 'Monthly') {
      trigger = addAndroidChannel({
        type: 'monthly',
        day: Number(monthlyDay) || 1,
        hour,
        minute,
      });
    }

    if (!trigger) {
      continue;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Medication Reminder',
        body: bodyText,
        sound: true,
      },
      trigger,
    });

    notificationIds.push(notificationId);
  }

  return notificationIds;
}

export async function cancelReminderNotifications(notificationIds) {
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    return;
  }

  for (const notificationId of notificationIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Failed to cancel notification:', notificationId, error);
    }
  }
}

export async function createReminderRecord(reminderData) {
  return addDoc(remindersCollection, {
    ...reminderData,
    created_at: serverTimestamp(),
  });
}

export async function updateReminderRecord(id, reminderData) {
  const reminderDoc = doc(db, 'reminders', id);

  return updateDoc(reminderDoc, {
    ...reminderData,
    updated_at: serverTimestamp(),
  });
}

export async function deleteReminderRecord(id) {
  const reminderDoc = doc(db, 'reminders', id);
  return deleteDoc(reminderDoc);
}

export function subscribeToUserReminders(userId, onSuccess, onError) {
  const remindersQuery = query(remindersCollection, where('user_id', '==', userId));

  return onSnapshot(
    remindersQuery,
    (snapshot) => {
      const reminderList = snapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data(),
        }))
        .sort((a, b) => {
          const aSeconds = a.created_at?.seconds || 0;
          const bSeconds = b.created_at?.seconds || 0;
          return bSeconds - aSeconds;
        });

      onSuccess(reminderList);
    },
    onError
  );
}

export function subscribeToUserMedications(userId, onSuccess, onError) {
  const medicationsQuery = query(medicationsCollection, where('user_id', '==', userId));

  return onSnapshot(
    medicationsQuery,
    (snapshot) => {
      const medicationList = snapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data(),
        }))
        .sort((a, b) => {
          const aSeconds = a.created_at?.seconds || 0;
          const bSeconds = b.created_at?.seconds || 0;
          return bSeconds - aSeconds;
        });

      onSuccess(medicationList);
    },
    onError
  );
}

export async function getUserNotificationPreference(userId) {
  const userDocRef = doc(db, 'users', userId);
  const userSnapshot = await getDoc(userDocRef);

  if (!userSnapshot.exists()) {
    return true;
  }

  const userData = userSnapshot.data();
  return userData.notifications_enabled !== false;
}

export async function disableAllUserReminderNotifications(userId) {
  const remindersQuery = query(remindersCollection, where('user_id', '==', userId));
  const snapshot = await getDocs(remindersQuery);

  for (const reminderDocItem of snapshot.docs) {
    const reminderData = reminderDocItem.data();

    if (Array.isArray(reminderData.notification_ids) && reminderData.notification_ids.length > 0) {
      await cancelReminderNotifications(reminderData.notification_ids);
    }

    await updateDoc(doc(db, 'reminders', reminderDocItem.id), {
      notification_ids: [],
      updated_at: serverTimestamp(),
    });
  }
}

export async function rescheduleAllUserReminderNotifications(userId) {
  const remindersQuery = query(remindersCollection, where('user_id', '==', userId));
  const medicationsQuery = query(medicationsCollection, where('user_id', '==', userId));

  const [remindersSnapshot, medicationsSnapshot] = await Promise.all([
    getDocs(remindersQuery),
    getDocs(medicationsQuery),
  ]);

  const medicationMap = {};

  medicationsSnapshot.docs.forEach((item) => {
    const data = item.data();
    medicationMap[item.id] = {
      med_name: data.med_name || 'Medication',
      dosage: data.dosage || '',
    };
  });

  for (const reminderDocItem of remindersSnapshot.docs) {
    const reminderData = reminderDocItem.data();

    if (reminderData.reminder_status !== 'Active') {
      continue;
    }

    if (Array.isArray(reminderData.notification_ids) && reminderData.notification_ids.length > 0) {
      await cancelReminderNotifications(reminderData.notification_ids);
    }

    const medicationInfo = medicationMap[reminderData.med_id] || {
      med_name: 'Medication',
      dosage: '',
    };

    const newNotificationIds = await scheduleReminderNotifications({
      medName: medicationInfo.med_name,
      dosage: medicationInfo.dosage,
      repeatType: reminderData.repeat_type,
      reminderTimes: reminderData.reminder_times || [],
      weeklyDay: reminderData.weekly_day || '',
      monthlyDay: reminderData.monthly_day || 0,
    });

    await updateDoc(doc(db, 'reminders', reminderDocItem.id), {
      notification_ids: newNotificationIds,
      updated_at: serverTimestamp(),
    });
  }
}
