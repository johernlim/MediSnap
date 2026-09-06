import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const DEFAULT_LANGUAGE = 'en';

export const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English', nativeLabel: 'English', speechCode: 'en-MY' },
  { code: 'ms', label: 'Bahasa Melayu', nativeLabel: 'Bahasa Melayu', speechCode: 'ms-MY' },
  { code: 'zh', label: 'Simplified Chinese', nativeLabel: '简体中文', speechCode: 'zh-CN' },
];

const validCodes = new Set(LANGUAGE_OPTIONS.map((language) => language.code));
const cacheKey = (uid) => `@medisnap/preferred_language/${uid}`;
const deviceCacheKey = '@medisnap/app_language';

export function isSupportedLanguage(code) {
  return validCodes.has(code);
}

export function getLanguageOption(code) {
  return LANGUAGE_OPTIONS.find((language) => language.code === code) || LANGUAGE_OPTIONS[0];
}

export function getSystemLanguage(locale = Intl.DateTimeFormat().resolvedOptions().locale) {
  const normalized = String(locale || '').toLowerCase();
  if (normalized.startsWith('ms')) return 'ms';
  if (normalized.startsWith('zh')) return 'zh';
  return DEFAULT_LANGUAGE;
}

export async function getDeviceLanguage() {
  const saved = await AsyncStorage.getItem(deviceCacheKey);
  return isSupportedLanguage(saved) ? saved : getSystemLanguage();
}

export async function saveDeviceLanguage(code) {
  if (!isSupportedLanguage(code)) throw new Error('Choose a supported language.');
  await AsyncStorage.setItem(deviceCacheKey, code);
  return code;
}

export async function getPreferredLanguage(uid) {
  if (!uid) return null;

  try {
    const snapshot = await getDoc(doc(db, 'users', uid));
    const saved = snapshot.exists() ? snapshot.data()?.preferred_language : null;
    if (!isSupportedLanguage(saved)) return null;
    await AsyncStorage.setItem(cacheKey(uid), saved);
    await AsyncStorage.setItem(deviceCacheKey, saved);
    return saved;
  } catch (error) {
    const cached = await AsyncStorage.getItem(cacheKey(uid));
    if (isSupportedLanguage(cached)) return cached;
    throw error;
  }
}

export async function savePreferredLanguage(uid, code) {
  if (!uid) throw new Error('A signed-in account is required.');
  if (!isSupportedLanguage(code)) throw new Error('Choose a supported language.');

  await setDoc(doc(db, 'users', uid), { preferred_language: code }, { merge: true });
  await AsyncStorage.setItem(cacheKey(uid), code);
  await AsyncStorage.setItem(deviceCacheKey, code);
  return code;
}
