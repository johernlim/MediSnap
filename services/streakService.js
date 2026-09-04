import { doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { collection } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  computeStreak,
  MAX_LOOKBACK_DAYS,
  pendingMilestone,
  summarizeDays,
} from './streakUtils';

const doseLogsCollection = collection(db, 'dose_logs');
const remindersCollection = collection(db, 'reminders');

/**
 * Reads what is needed to work out the user's current streak.
 *
 * Both queries filter on user_id only, so no composite index is required. The
 * arithmetic all lives in streakUtils, which is why this function stays thin.
 */
export async function getStreak(userId, today = new Date()) {
  if (!userId) {
    return { streak: 0, summaries: [] };
  }

  const [logsSnapshot, remindersSnapshot] = await Promise.all([
    getDocs(query(doseLogsCollection, where('user_id', '==', userId))),
    getDocs(query(remindersCollection, where('user_id', '==', userId))),
  ]);

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - MAX_LOOKBACK_DAYS);

  const logs = logsSnapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        status: data.status,
        loggedAt: data.logged_at?.toDate?.() || null,
      };
    })
    // A log still waiting on its server timestamp has no date yet, and an old
    // one is beyond any streak worth reconstructing.
    .filter((entry) => entry.loggedAt && entry.loggedAt >= cutoff);

  const reminders = remindersSnapshot.docs.map((item) => item.data());

  const summaries = summarizeDays(reminders, logs, today, MAX_LOOKBACK_DAYS);

  return { streak: computeStreak(summaries), summaries };
}

/**
 * The milestone to celebrate on this app open, if any.
 *
 * Milestones are recorded on the user document so each one is shown once, not
 * every time the app is opened while the streak sits above the threshold.
 */
export async function getPendingMilestone(userId, streak) {
  if (!userId || !streak) return null;

  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);
  const celebrated = snapshot.exists()
    ? snapshot.data().celebrated_milestones || []
    : [];

  return pendingMilestone(streak, celebrated);
}

/** Marks a milestone as shown so the popup does not repeat. */
export async function markMilestoneCelebrated(userId, milestone) {
  if (!userId || !milestone) return;

  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);
  const celebrated = snapshot.exists()
    ? snapshot.data().celebrated_milestones || []
    : [];

  if (celebrated.map(Number).includes(Number(milestone))) return;

  await setDoc(
    userRef,
    { celebrated_milestones: [...celebrated.map(Number), Number(milestone)] },
    { merge: true }
  );
}
