import { useMemo } from 'react';
import { useAppTheme } from '../contexts/ThemeContext';

const backgroundMap = {
  '#fff': '#1e293b', '#ffffff': '#1e293b', '#f8fafc': '#0f172a', '#f1f5f9': '#1e293b',
  '#e2e8f0': '#334155', '#eff6ff': '#172554', '#dbeafe': '#1e3a8a', '#fff7ed': '#431407',
  '#fffbeb': '#422006', '#fef2f2': '#450a0a', '#fee2e2': '#450a0a', '#dcfce7': '#052e16',
};
const textMap = {
  '#0f172a': '#f8fafc', '#111827': '#f8fafc', '#1e293b': '#e2e8f0', '#334155': '#e2e8f0',
  '#475569': '#cbd5e1', '#64748b': '#94a3b8', '#6b7280': '#9ca3af', '#808080': '#a1a1aa',
  '#94a3b8': '#cbd5e1', '#1e3a8a': '#93c5fd', '#1d4ed8': '#93c5fd', '#9a3412': '#fdba74',
  '#92400e': '#fcd34d', '#991b1b': '#fca5a5', '#b91c1c': '#fca5a5', '#dc2626': '#f87171',
};
const borderMap = {
  '#d1d5db': '#475569', '#cbd5e1': '#475569', '#dbe4f0': '#334155', '#e2e8f0': '#334155',
  '#bfdbfe': '#1d4ed8', '#fdba74': '#9a3412', '#dc2626': '#ef4444',
};

function transformStyle(value) {
  if (Array.isArray(value)) return value.map(transformStyle);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (typeof item !== 'string') return [key, transformStyle(item)];
    const normalized = item.toLowerCase();
    if (key === 'backgroundColor') return [key, backgroundMap[normalized] || item];
    if (key === 'color') return [key, textMap[normalized] || item];
    if (key === 'borderColor') return [key, borderMap[normalized] || item];
    return [key, item];
  }));
}

export function themeStyleObject(baseStyles, dark) {
  return dark ? transformStyle(baseStyles) : baseStyles;
}

export function useThemedStyles(baseStyles) {
  const { dark } = useAppTheme();
  return useMemo(() => themeStyleObject(baseStyles, dark), [baseStyles, dark]);
}
