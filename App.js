// ============================================
// APP.JS - StudySync (Punto de entrada)
// Reemplaza el export default StudySyncApp()
// ============================================

import React, { useCallback, useEffect, useMemo } from 'react';
import { AppState, Platform, View } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import * as NavigationBar from 'expo-navigation-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AccessibilityProvider } from './src/contexts/AccessibilityContext';
import { FileStorageProvider } from './src/contexts/FileStorageContext';
import AppNavigator from './src/navigation/AppNavigator';
import AppStatusBar from './src/components/AppStatusBar';
import * as SplashScreen from 'expo-splash-screen';

// Mantener el splash nativo visible hasta que Firebase resuelva la sesión.
// Debe llamarse ANTES del primer render para que no haya parpadeo.
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppNavigation() {
  const { theme } = useTheme();

  const applyNativeShell = useCallback(() => {
    SystemUI.setBackgroundColorAsync(theme.bg).catch(() => {});
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        // Con edge-to-edge activo, `setPositionAsync` / `setBackgroundColorAsync` no aplican
        // (ver docs Expo). El modo `relative` va en app.json → plugin expo-navigation-bar.
        await NavigationBar.setVisibilityAsync('visible');
        await NavigationBar.setButtonStyleAsync(theme.dark ? 'light' : 'dark');
        await NavigationBar.setBackgroundColorAsync(theme.tabBg);
      } catch {
        /* noop */
      }
    })();
  }, [theme.bg, theme.dark]);

  // Shell nativo en montaje y al volver a primer plano (2.ª apertura rápida a veces dejaba
  // barras por defecto hasta un frame tarde o no reaplicaba tras resume).
  useEffect(() => {
    applyNativeShell();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') applyNativeShell();
    });
    return () => sub.remove();
  }, [applyNativeShell]);

  const navigationTheme = useMemo(
    () => ({
      ...(theme.dark ? DarkTheme : DefaultTheme),
      colors: {
        ...(theme.dark ? DarkTheme.colors : DefaultTheme.colors),
        background: theme.bg,
        card: theme.card,
        text: theme.text,
        border: theme.border,
        primary: '#4F46E5',
        notification: '#DC2626',
      },
    }),
    [theme],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <NavigationContainer theme={navigationTheme}>
        <AppStatusBar />
        <AppNavigator />
      </NavigationContainer>
    </View>
  );
}

/** Relleno bajo KeyboardProvider: evita que el window nativo (blanco) se vea en los bordes. */
function ThemedAppTree({ children }) {
  const { theme } = useTheme();
  return (
    <KeyboardProvider
      statusBarTranslucent
      navigationBarTranslucent={Platform.OS !== 'android'}
      preserveEdgeToEdge={Platform.OS !== 'android'}
    >
      <View style={{ flex: 1, backgroundColor: theme.bg }}>{children}</View>
    </KeyboardProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AccessibilityProvider>
        <ThemeProvider>
          <ThemedAppTree>
            <AuthProvider>
              <FileStorageProvider>
                <AppNavigation />
              </FileStorageProvider>
            </AuthProvider>
          </ThemedAppTree>
        </ThemeProvider>
      </AccessibilityProvider>
    </SafeAreaProvider>
  );
}
