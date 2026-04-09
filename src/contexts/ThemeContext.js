import React, { createContext, useState, useContext } from 'react';

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

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const theme = isDark ? dark : light;
  const toggleTheme = () => setIsDark((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
