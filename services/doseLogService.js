import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Record of what the user did when a reminder fired.
 *
 * This is what turns "I already took it" from a button that dismisses a
 * notification into adherence history: every dose is logged as taken or
 * snoozed, with the time it was scheduled for.
 */
const doseLogsCollection = collection(db, 'dose_logs');

export const DOSE_TAKEN = 'taken';
export const DOSE_SNOOZED = 'snoozed';
export const DOSE_MISSED = 'missed';

export async function logDoseTaken({
  userId,
  medId,
  medName,
  dosage,
  scheduledTime,
}) {
  return addDoc(doseLogsCollection, {
    user_id: userId,
    med_id: medId || '',
    med_name: medName || '',
    dosage: dosage || '',
    scheduled_time: scheduledTime || '',
    status: DOSE_TAKEN,
    logged_at: serverTimestamp(),
  });
}

export async function logDoseSnoozed({
  userId,
  medId,
  medName,
  dosage,
  scheduledTime,
  minutes,
  remindAt,
  notificationId,
}) {
  return addDoc(doseLogsCollection, {
    user_id: userId,
    med_id: medId || '',
    med_name: medName || '',
    dosage: dosage || '',
    scheduled_time: scheduledTime || '',
    status: DOSE_SNOOZED,
    snooze_minutes: Number(minutes) || 0,
    snooze_until: remindAt instanceof Date ? remindAt : null,
    // Kept so the pending one-off can be cancelled if the medication is
    // deleted before it fires.
    snooze_notification_id: notificationId || '',
    logged_at: serverTimestamp(),
  });
}

/**
 * Pending snooze notification ids for one medication.
 *
 * Used when a medication is deleted: its recurring notifications are cancelled
 * through the reminder record, but a one-off snooze lives only here.
 */
export async function getPendingSnoozeNotificationIds(userId, medId) {
  const pendingQuery = query(
    doseLogsCollection,
    where('user_id', '==', userId),
    where('med_id', '==', medId),
    where('status', '==', DOSE_SNOOZED)
  );

  const snapshot = await getDocs(pendingQuery);
  const now = Date.now();

  return snapshot.docs
    .map((item) => item.data())
    .filter((data) => {
      const until = data.snooze_until?.toDate?.() || data.snooze_until;
      return until instanceof Date ? until.getTime() > now : false;
    })
    .map((data) => data.snooze_notification_id)
    .filter(Boolean);
}

export function subscribeToUserDoseLogs(userId, onSuccess, onError) {
  const logsQuery = query(doseLogsCollection, where('user_id', '==', userId));

  return onSnapshot(
    logsQuery,
    (snapshot) => {
      const logs = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => (b.logged_at?.seconds || 0) - (a.logged_at?.seconds || 0));

      onSuccess(logs);
    },
    onError
  );
}

/** Written when the snooze budget runs out without the dose being taken. */
export async function logDoseMissed({
  userId,
  medId,
  medName,
  dosage,
  scheduledTime,
}) {
  return addDoc(doseLogsCollection, {
    user_id: userId,
    med_id: medId || '',
    med_name: medName || '',
    dosage: dosage || '',
    scheduled_time: scheduledTime || '',
    status: DOSE_MISSED,
    logged_at: serverTimestamp(),
  });
}
