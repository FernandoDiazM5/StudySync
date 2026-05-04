import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAccessibility } from './AccessibilityContext';

const THEME_STORAGE_KEY = '@studysync_theme';

const light = {
  dark: false,
  bg: '#F9FAFB',
  card: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  input: '#F9FAFB',
  inputBorder: '#D1D5DB',
  headerBg: '#4F46E5',
  /** expo-status-bar: 'light' = iconos/hora claros sobre cabecera oscura (el morado no es fondo claro). */
  statusBarStyle: 'light',
  tabBg: '#FFFFFF',
  tabBorder: '#E5E7EB',
  divider: '#F3F4F6',
};

const dark = {
  dark: true,
  bg: '#111827',
  card: '#1F2937',
  text: '#F9FAFB',
  textSecondary: '#D1D5DB',
  textMuted: '#6B7280',
  border: '#374151',
  input: '#374151',
  inputBorder: '#4B5563',
  headerBg: '#312E81',
  tabBg: '#1F2937',
  tabBorder: '#374151',
  divider: '#374151',
};

const highContrastDark = {
  dark: true,
  bg: '#000000',
  card: '#0a0a0a',
  text: '#F59E0B',
  textSecondary: '#D97706',
  textMuted: '#F5A623', // Improved: WCAG AA compliant (~15:1 contrast)
  border: '#D97706',
  input: '#000000',
  inputBorder: '#F59E0B',
  headerBg: '#111111',
  statusBarStyle: 'light',
  tabBg: '#000000',
  tabBorder: '#D97706',
  divider: '#92400e',
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  // Cargar preferencia guardada
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved !== null) setIsDark(saved === 'true');
      } catch (e) {
        console.warn('Error loading theme preference:', e);
      }
    })();
  }, []);

  // Access Accessibility Context to check if contrast mode is on
  // Safe fallback if ThemeProvider is used without AccessibilityProvider
  let isHighContrast = false;
  try {
    const accessibility = useAccessibility();
    isHighContrast = accessibility?.contrastActive ?? false;
  } catch (error) {
    console.warn('AccessibilityContext not found, using default theme');
  }

  let theme = light;
  if (isHighContrast) {
    theme = highContrastDark;
  } else if (isDark) {
    theme = dark;
  }

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(THEME_STORAGE_KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);

  const contextValue = useMemo(
    () => ({ theme, isDark, toggleTheme }),
    [theme, isDark, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
