import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../firebaseConfig';
import { translate } from '../services/i18n';
import {
  DEFAULT_LANGUAGE,
  getDeviceLanguage,
  getPreferredLanguage,
  saveDeviceLanguage,
  savePreferredLanguage,
} from '../services/languageService';

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  ready: false,
  t: (key, params) => translate(DEFAULT_LANGUAGE, key, params),
  changeLanguage: async (code) => code,
});

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    getDeviceLanguage().then((saved) => {
      if (active) setLanguage(saved);
    }).finally(() => {
      if (!active) return;
      setReady(true);
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!user) return;
        getPreferredLanguage(user.uid).then((saved) => {
          if (active && saved) setLanguage(saved);
        }).catch(() => {});
      });
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const changeLanguage = useCallback(async (code, userId = auth.currentUser?.uid) => {
    const previous = language;
    setLanguage(code);
    try {
      if (userId) await savePreferredLanguage(userId, code);
      else await saveDeviceLanguage(code);
      return code;
    } catch (error) {
      setLanguage(previous);
      throw error;
    }
  }, [language]);

  const t = useCallback((key, params) => translate(language, key, params), [language]);
  const value = useMemo(() => ({ language, ready, t, changeLanguage }),
    [changeLanguage, language, ready, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
