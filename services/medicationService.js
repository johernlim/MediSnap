import * as Notifications from 'expo-notifications';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { getPendingSnoozeNotificationIds } from './doseLogService';

const medicationsCollection = collection(db, 'medications');
const remindersCollection = collection(db, 'reminders');

export async function createMedication(medicationData) {
  return addDoc(medicationsCollection, {
    ...medicationData,
    created_at: serverTimestamp(),
  });
}

export function subscribeToUserMedications(userId, onSuccess, onError) {
  const medicationsQuery = query(
    medicationsCollection,
    where('user_id', '==', userId)
  );

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

export async function updateMedicationById(id, medicationData) {
  const medicationDoc = doc(db, 'medications', id);

  return updateDoc(medicationDoc, {
    ...medicationData,
    updated_at: serverTimestamp(),
  });
}

async function cancelScheduledNotifications(notificationIds) {
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

export async function deleteMedicationById(id) {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('No authenticated user found.');
  }

  const medicationDoc = doc(db, 'medications', id);

  const relatedRemindersQuery = query(
    remindersCollection,
    where('med_id', '==', id),
    where('user_id', '==', currentUser.uid)
  );

  const relatedRemindersSnapshot = await getDocs(relatedRemindersQuery);

  for (const reminderItem of relatedRemindersSnapshot.docs) {
    const reminderData = reminderItem.data();

    await cancelScheduledNotifications(reminderData.notification_ids || []);
    await deleteDoc(doc(db, 'reminders', reminderItem.id));
  }

  // A snooze is a one-off notification that never belonged to a reminder's
  // notification_ids, so deleting the reminders above cannot have cancelled
  // it. Without this, a deleted medication could still buzz an hour later.
  try {
    const pendingSnoozeIds = await getPendingSnoozeNotificationIds(
      currentUser.uid,
      id
    );

    await cancelScheduledNotifications(pendingSnoozeIds);
  } catch (error) {
    console.error('Failed to cancel pending snooze notifications:', error);
  }

  return deleteDoc(medicationDoc);
}
