import { sendPasswordResetEmail } from 'firebase/auth';
import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const usersCollection = collection(db, 'users');
const passwordResetsCollection = collection(db, 'password_resets');

async function findUserByEmail(email) {
  const usersQuery = query(usersCollection, where('email', '==', email));
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

export async function sendResetEmailAndLog(email) {
  const matchedUser = await findUserByEmail(email);
  const userId = matchedUser?.user_id || matchedUser?.userId || matchedUser?.id || '';

  // Firebase handles the real secure password reset email.
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    // An unregistered address must fail silently. Letting this error reach the
    // screen would tell an attacker exactly which emails have accounts, which
    // is the enumeration hole the caller's uniform message exists to close.
    // Every other failure is real and still propagates.
    if (error?.code !== 'auth/user-not-found') {
      throw error;
    }
  }

  // Approximate expiry time for ERD logging: 1 hour from request time.
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

  return resetDocRef.id;
}
