// ============================================
// APP.JS - StudySync (Punto de entrada)
// Reemplaza el export default StudySyncApp()
// ============================================

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AccessibilityProvider } from './src/contexts/AccessibilityContext';
import { FileStorageProvider } from './src/contexts/FileStorageContext';
import AppNavigator from './src/navigation/AppNavigator';
import AppStatusBar from './src/components/AppStatusBar';
import * as SplashScreen from 'expo-splash-screen';

// Mantener el splash nativo visible hasta que Firebase resuelva la sesión.
// Debe llamarse ANTES del primer render para que no haya parpadeo.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <AccessibilityProvider>
          <ThemeProvider>
            <AuthProvider>
              <FileStorageProvider>
                <NavigationContainer>
                  <AppStatusBar />
                  <AppNavigator />
                </NavigationContainer>
              </FileStorageProvider>
            </AuthProvider>
          </ThemeProvider>
        </AccessibilityProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
