// ============================================
// APP.JS - StudySync (Punto de entrada)
// Reemplaza el export default StudySyncApp()
// ============================================

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AccessibilityProvider } from './src/contexts/AccessibilityContext';
import { FileStorageProvider } from './src/contexts/FileStorageContext';
import AccessibilityMenu from './src/components/AccessibilityMenu';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'react-native';

export default function App() {
  return (
    <SafeAreaProvider>
      <AccessibilityProvider>
        <ThemeProvider>
          <AuthProvider>
            <FileStorageProvider>
              <NavigationContainer>
                <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
                <AppNavigator />
                <AccessibilityMenu />
              </NavigationContainer>
            </FileStorageProvider>
          </AuthProvider>
        </ThemeProvider>
      </AccessibilityProvider>
    </SafeAreaProvider>
  );
}
