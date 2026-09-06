import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../firebaseConfig';
import { getDeviceTheme, getPreferredTheme, saveDeviceTheme, savePreferredTheme } from '../services/themeService';

const ThemeContext = createContext({
  theme: 'light',
  dark: false,
  ready: false,
  changeTheme: async (value) => value,
});

export function AppThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    getDeviceTheme().then((saved) => {
      if (active) setTheme(saved);
    }).finally(() => {
      if (!active) return;
      setReady(true);
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!user) return;
        getPreferredTheme(user.uid).then((saved) => {
          if (active && saved) setTheme(saved);
        }).catch(() => {});
      });
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  const changeTheme = useCallback(async (value, userId = auth.currentUser?.uid) => {
    const previous = theme;
    setTheme(value);
    try {
      if (userId) await savePreferredTheme(userId, value);
      else await saveDeviceTheme(value);
      return value;
    } catch (error) {
      setTheme(previous);
      throw error;
    }
  }, [theme]);

  const contextValue = useMemo(() => ({
    theme,
    dark: theme === 'dark',
    ready,
    changeTheme,
  }), [changeTheme, ready, theme]);

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
