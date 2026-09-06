import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const THEME_OPTIONS = [
  { code: 'light', icon: '☀️' },
  { code: 'dark', icon: '🌙' },
];

const validThemes = new Set(THEME_OPTIONS.map((item) => item.code));
const deviceKey = '@medisnap/app_theme';
const accountKey = (uid) => `@medisnap/preferred_theme/${uid}`;

export function isSupportedTheme(value) {
  return validThemes.has(value);
}

export function getSystemTheme() {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export async function getDeviceTheme() {
  const saved = await AsyncStorage.getItem(deviceKey);
  return isSupportedTheme(saved) ? saved : getSystemTheme();
}

export async function saveDeviceTheme(value) {
  if (!isSupportedTheme(value)) throw new Error('Choose a supported appearance.');
  await AsyncStorage.setItem(deviceKey, value);
  return value;
}

export async function getPreferredTheme(uid) {
  if (!uid) return null;
  try {
    const snapshot = await getDoc(doc(db, 'users', uid));
    const saved = snapshot.exists() ? snapshot.data()?.preferred_theme : null;
    if (!isSupportedTheme(saved)) return null;
    await AsyncStorage.multiSet([[accountKey(uid), saved], [deviceKey, saved]]);
    return saved;
  } catch (error) {
    const cached = await AsyncStorage.getItem(accountKey(uid));
    if (isSupportedTheme(cached)) return cached;
    throw error;
  }
}

export async function savePreferredTheme(uid, value) {
  if (!uid) throw new Error('A signed-in account is required.');
  if (!isSupportedTheme(value)) throw new Error('Choose a supported appearance.');
  await setDoc(doc(db, 'users', uid), { preferred_theme: value }, { merge: true });
  await AsyncStorage.multiSet([[accountKey(uid), value], [deviceKey, value]]);
  return value;
}
