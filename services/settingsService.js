import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export function getDefaultProfile() {
  return {
    username: '',
    email: '',
    full_name: '',
    age: '',
    gender: '',
    height: '',
    weight: '',
    notifications_enabled: true,
    preferred_language: null,
    preferred_theme: null,
  };
}

export async function getUserProfile(uid, fallbackEmail = '') {
  const userDocRef = doc(db, 'users', uid);
  const snapshot = await getDoc(userDocRef);
  const defaultProfile = getDefaultProfile();

  if (!snapshot.exists()) {
    return {
      ...defaultProfile,
      email: fallbackEmail || '',
    };
  }

  const data = snapshot.data();

  return {
    ...defaultProfile,
    ...data,
    email: data.email || fallbackEmail || '',
    age: data.age ?? '',
    height: data.height ?? '',
    weight: data.weight ?? '',
    notifications_enabled:
      typeof data.notifications_enabled === 'boolean'
        ? data.notifications_enabled
        : true,
    preferred_language: data.preferred_language || null,
    preferred_theme: data.preferred_theme || null,
  };
}

export async function updateUserProfile(uid, data) {
  const userDocRef = doc(db, 'users', uid);
  return setDoc(userDocRef, data, { merge: true });
}

export function validateProfileData(profile) {
  if (!profile.username.trim()) {
    return 'Username is required.';
  }

  if (!profile.gender) {
    return 'Please select gender.';
  }

  if (!profile.age) {
    return 'Please select age.';
  }

  if (!profile.height) {
    return 'Please select height.';
  }

  if (!profile.weight) {
    return 'Please select weight.';
  }

  return '';
}
