import { useAppTheme } from '../contexts/ThemeContext';

export function useColorScheme() {
  return useAppTheme().theme as 'light' | 'dark';
}
