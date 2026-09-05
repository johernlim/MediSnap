import { sendPasswordResetEmail } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const usersCollection = collection(db, 'users');
const passwordResetsCollection = collection(db, 'password_resets');

async function findUserByEmail(email) {
  // limit(1) is required by the security rules; see the users/list rule.
  const usersQuery = query(
    usersCollection,
    where('email', '==', email),
    limit(1)
  );
  const snapshot = await getDocs(usersQuery);

  if (snapshot.empty) {
    return null;
  }

  const userDoc = snapshot.docs[0];

  return {
    id: userDoc.id,
    ...userDoc.data(),
  };
}

/**
 * Sends the reset email, but only for an address that actually has an account.
 *
 * Returns { registered: false } instead of throwing when there is no account,
 * so the screen can tell the user to sign up. Note that this deliberately
 * confirms whether an address is registered: the trade-off is a clearer flow
 * for a genuine user, at the cost of letting someone test addresses one at a
 * time to see which ones exist.
 *
 * Firebase Auth is checked through the users record rather than by catching
 * auth/user-not-found, because a project with email enumeration protection
 * turned on never raises that error in the first place.
 */
export async function sendResetEmailAndLog(email) {
  const matchedUser = await findUserByEmail(email);

  if (!matchedUser) {
    return { registered: false, resetId: '' };
  }

  const userId = matchedUser.user_id || matchedUser.userId || matchedUser.id || '';

  // Firebase handles the real secure password reset email.
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    // The account exists in Firestore but not in Firebase Auth. That is a
    // broken record rather than an unregistered user, so it is reported the
    // same way instead of surfacing a raw Firebase error code.
    if (error?.code === 'auth/user-not-found') {
      return { registered: false, resetId: '' };
    }

    throw error;
  }

  // Approximate expiry time for ERD logging: 1 hour from request time. Only
  // written once an email has actually gone out, so the table records real
  // resets rather than every address that was typed into the box.
  const approximateExpiry = new Date(Date.now() + 60 * 60 * 1000);
  const resetDocRef = doc(passwordResetsCollection);

  await setDoc(resetDocRef, {
    reset_id: resetDocRef.id,
    user_id: userId,
    reset_token: 'firebase_email_reset',
    expiry_time: approximateExpiry,
    used_flag: 0,
    requested_email: email,
    created_at: serverTimestamp(),
  });

  return { registered: true, resetId: resetDocRef.id };
}
