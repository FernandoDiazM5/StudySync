// ============================================
// AUTH CONTEXT - StudySync
// Provee usuario actual y funciones de auth a toda la app
// Reemplaza el estado currentUser del componente principal
// ============================================

import React, { createContext, useState, useEffect, useContext } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthChange, getUserProfile, signOut } from '../services/authService';
import { registerForPushNotifications } from '../services/notificationService';
import { auth } from '../services/firebaseConfig';

const AuthContext = createContext(null);

/** Marca de tiempo al pasar la app a segundo plano (ms desde epoch). */
const BG_SESSION_AT_KEY = '@studysync_session_background_at';

/**
 * Tiempo máximo en segundo plano con la sesión conservada.
 * Pasado este intervalo desde la última vez que la app quedó en background,
 * al volver a primer plano (o al arrancar con sesión restaurada) se cierra sesión.
 * Ajusta aquí el límite (p. ej. 3 días: 3 * 24 * 60 * 60 * 1000).
 */
const BACKGROUND_SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000;

async function clearBackgroundSessionMarker() {
  try {
    await AsyncStorage.removeItem(BG_SESSION_AT_KEY);
  } catch {
    /* noop */
  }
}

async function isBackgroundSessionExpired() {
  try {
    const raw = await AsyncStorage.getItem(BG_SESSION_AT_KEY);
    if (raw == null) return false;
    const t = parseInt(raw, 10);
    if (!Number.isFinite(t)) return false;
    return Date.now() - t > BACKGROUND_SESSION_MAX_MS;
  } catch {
    return false;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);          // Firebase Auth user
  const [userProfile, setUserProfile] = useState(null); // Firestore user data
  const [loading, setLoading] = useState(true);     // Loading state inicial

  useEffect(() => {
    // Escuchar cambios de autenticación
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        if (await isBackgroundSessionExpired()) {
          await clearBackgroundSessionMarker();
          await signOut();
          setLoading(false);
          return;
        }

        setUser(firebaseUser);
        // Perfil: Firestore + fallback Auth (nombre/email) y doc users si faltaba
        const result = await getUserProfile(firebaseUser.uid, firebaseUser);
        if (result.success) {
          setUserProfile(result.data);
        }
        // Registrar token de notificaciones push
        registerForPushNotifications(firebaseUser.uid).catch(() => {});
      } else {
        await clearBackgroundSessionMarker();
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Marca al ir a segundo plano; al volver, cierra sesión si superó el límite.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') {
        try {
          if (auth.currentUser) {
            await AsyncStorage.setItem(BG_SESSION_AT_KEY, String(Date.now()));
          }
        } catch {
          /* noop */
        }
        return;
      }
      if (state !== 'active') return;

      try {
        const raw = await AsyncStorage.getItem(BG_SESSION_AT_KEY);
        if (raw == null) return;
        const t = parseInt(raw, 10);
        if (!Number.isFinite(t)) {
          await clearBackgroundSessionMarker();
          return;
        }
        const elapsed = Date.now() - t;
        await clearBackgroundSessionMarker();
        if (elapsed > BACKGROUND_SESSION_MAX_MS && auth.currentUser) {
          await signOut();
        }
      } catch {
        /* noop */
      }
    });
    return () => sub.remove();
  }, []);

  /**
   * Actualizar el perfil local después de editar
   */
  const refreshProfile = async () => {
    if (!user) return;
    const result = await getUserProfile(user.uid, user);
    if (result.success) {
      setUserProfile(result.data);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,           // Firebase Auth user (uid, email, etc.)
      userProfile,    // Firestore profile data (name, phone, role, etc.)
      loading,        // true mientras se verifica la sesión
      refreshProfile  // función para refrescar datos del perfil
    }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook para acceder al contexto de autenticación
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
