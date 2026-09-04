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
import { isFinalSnooze, planDoseChain } from './doseChainUtils';
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

/**
 * Deliberately a new channel id rather than the old 'reminders'.
 *
 * Android freezes a channel's importance and sound the moment it is created;
 * calling setNotificationChannelAsync again on an existing channel silently
 * does nothing. Reusing 'reminders' would leave every existing install on the
 * old quiet settings forever.
 */
const ALARM_CHANNEL_ID = 'medication-alarms';

function addAndroidChannel(trigger) {
  if (Platform.OS === 'android') {
    return {
      ...trigger,
      channelId: ALARM_CHANNEL_ID,
    };
  }

  return trigger;
}

/**
 * Content shared by scheduled and snoozed reminders.
 *
 * `sticky` plus `autoDismiss: false` is what keeps the notification on screen:
 * it cannot be swiped away, and only disappears when the user picks one of the
 * two actions.
 */
function reminderContent({ title, body, data }) {
  return {
    title,
    body,
    sound: true,
    vibrate: [0, 500, 500, 500, 500, 500],
    priority: Notifications.AndroidNotificationPriority.MAX,
    sticky: true,
    autoDismiss: false,
    categoryIdentifier: REMINDER_CATEGORY,
    data,
  };
}

/** Identifies a medication reminder so taps can be routed to the dose screen. */
export const REMINDER_CATEGORY = 'medication-reminder';
export const ACTION_TAKEN = 'TAKEN';
export const ACTION_SNOOZE = 'SNOOZE';

/**
 * Attaches the two action buttons to medication reminders.
 *
 * "Remind me later" opens the app because the user has to choose how long.
 * "I've taken it" is handled without opening the app, which is the nicer
 * behaviour but only works while the app is running or backgrounded — if it
 * has been swiped away, Android may not deliver the response to JavaScript.
 * The dose screen carries the same button so there is always a path that logs.
 */
export async function registerReminderCategory() {
  await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
    {
      identifier: ACTION_TAKEN,
      buttonTitle: "I've taken it",
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: 'Remind me later',
      options: { opensAppToForeground: true },
    },
  ]);
}

export async function setupReminderNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: 'Medication Alarms',
      description: 'Loud reminders for medication doses.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 500, 500, 500, 500],
      lightColor: '#2563eb',
      // Routes the sound through the alarm stream instead of the notification
      // stream, so it plays at alarm volume, and enforceAudibility asks the
      // system to sound it even when the phone is set to silent.
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
      bypassDnd: true,
    });
  }

  await registerReminderCategory();

  return true;
}


export async function scheduleReminderNotifications({
  medId,
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
      content: reminderContent({
        title: 'Medication Reminder',
        body: bodyText,
        // Carried on the notification itself so the dose screen can render
        // without looking the reminder up, and so the snooze clash check has
        // the schedule to compare against.
        data: {
          type: REMINDER_CATEGORY,
          medId: medId || '',
          medName: medName || '',
          dosage: dosage || '',
          reminderTimes: reminderTimes || [],
          scheduledTime: trimmedTime,
        },
      }),
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
      medId: reminderData.med_id,
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

/**
 * Schedules a single notification at an exact moment.
 *
 * Used for both halves of a shift: the moved dose today, and the backups that
 * keep the normal time firing on the days after. Both are one-offs, because a
 * repeating trigger cannot be told to skip an occurrence.
 */
async function scheduleOneOff({ date, title, body, data }) {
  return Notifications.scheduleNotificationAsync({
    content: reminderContent({ title, body, data }),
    trigger: addAndroidChannel({ type: 'date', date }),
  });
}

function reminderBody(medName, dosage) {
  return dosage
    ? `Time to take ${medName} with Dosage: ${dosage}.`
    : `Time to take ${medName}.`;
}

function notificationData({ medId, medName, dosage, reminderTimes, scheduledTime }) {
  return {
    type: REMINDER_CATEGORY,
    medId: medId || '',
    medName: medName || '',
    dosage: dosage || '',
    reminderTimes: reminderTimes || [],
    scheduledTime: scheduledTime || '',
  };
}



/* ------------------------------------------------------------------------ *
 * The follow-up chain
 * ------------------------------------------------------------------------ */

/**
 * Schedules everything that should happen if a dose alarm goes unanswered.
 *
 * All of it is handed to the OS at once, so the chain runs whether or not the
 * app is ever opened. Answering the alarm cancels whatever is left.
 */
export async function scheduleDoseChain({
  medId,
  medName,
  dosage,
  reminderTimes,
  scheduledTime,
  alarmAt,
}) {
  const chain = planDoseChain(alarmAt);
  const ids = [];

  for (const step of chain) {
    const isMissed = step.kind === 'missed';

    const body = isMissed
      ? dosage
        ? `You did not take ${medName} (${dosage}), scheduled for ${scheduledTime}.`
        : `You did not take ${medName}, scheduled for ${scheduledTime}.`
      : dosage
        ? `Reminder ${step.attempt}: Time to take ${medName} with Dosage: ${dosage}.`
        : `Reminder ${step.attempt}: Time to take ${medName}.`;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        ...reminderContent({
          title: isMissed ? 'Missed dose' : 'Medication Reminder',
          body,
          data: {
            ...notificationData({
              medId,
              medName,
              dosage,
              reminderTimes,
              scheduledTime,
            }),
            attempt: step.attempt,
            missed: isMissed,
          },
        }),
        // A missed notice is a statement, not a prompt — it carries no action
        // buttons and can be swiped away like any ordinary notification.
        ...(isMissed
          ? { categoryIdentifier: undefined, sticky: false, autoDismiss: true }
          : {}),
      },
      trigger: addAndroidChannel({ type: 'date', date: step.at }),
    });

    ids.push(id);
  }

  return ids;
}

/** One manual "Remind me later", a fixed 30 minutes from the tap. */
export async function scheduleManualSnooze({
  medId,
  medName,
  dosage,
  reminderTimes,
  scheduledTime,
  attempt,
  remindAt,
}) {
  const final = isFinalSnooze(attempt);

  const body = dosage
    ? `Reminder ${attempt}: Time to take ${medName} with Dosage: ${dosage}.`
    : `Reminder ${attempt}: Time to take ${medName}.`;

  return Notifications.scheduleNotificationAsync({
    content: reminderContent({
      title: 'Medication Reminder',
      body,
      data: {
        ...notificationData({ medId, medName, dosage, reminderTimes, scheduledTime }),
        attempt,
        // Tells the next screen this is the last chance before the dose is
        // recorded as missed.
        lastChance: final,
      },
    }),
    trigger: addAndroidChannel({ type: 'date', date: remindAt }),
  });
}

/** The closing notification when the snooze budget runs out. */
export async function scheduleMissedNotice({ medName, dosage, scheduledTime, at }) {
  const body = dosage
    ? `You did not take ${medName} (${dosage}), scheduled for ${scheduledTime}.`
    : `You did not take ${medName}, scheduled for ${scheduledTime}.`;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Missed dose',
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      sticky: false,
      autoDismiss: true,
      data: { type: REMINDER_CATEGORY, missed: true },
    },
    trigger: addAndroidChannel({ type: 'date', date: at }),
  });
}
