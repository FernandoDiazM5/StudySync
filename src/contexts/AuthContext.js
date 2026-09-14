// ============================================
// AUTH CONTEXT - StudySync
// Provee usuario actual y funciones de auth a toda la app
// ============================================

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthChange, getUserProfile, signOut } from "../services/authService";
import { registerForPushNotifications } from "../services/notificationService";
import { auth } from "../services/firebaseConfig";
import {
  waitForSignInGate,
  isPending2faFor,
  clearPending2faMark,
  markPending2fa,
} from "../services/login2faGate";

const AuthContext = createContext(null);

/** Marca de tiempo al pasar la app a segundo plano (ms desde epoch). */
const BG_SESSION_AT_KEY = "@studysync_session_background_at";

/**
 * Tiempo máximo en segundo plano con la sesión conservada.
 * Pasado este intervalo desde la última vez que la app quedó en background,
 * al volver a primer plano (o al arrancar con sesión restaurada) se cierra sesión.
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
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  /** true mientras el login espera OTP de 2FA (no abrir MainStack). */
  const [pending2fa, setPending2fa] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        if (await isBackgroundSessionExpired()) {
          await clearBackgroundSessionMarker();
          await signOut();
          setLoading(false);
          return;
        }

        // Esperar a que signIn termine de marcar pending 2FA si aplica.
        await waitForSignInGate();

        const needs2fa = isPending2faFor(firebaseUser.uid);
        setPending2fa(needs2fa);
        setUser(firebaseUser);

        const result = await getUserProfile(firebaseUser.uid, firebaseUser);
        if (result.success) {
          setUserProfile(result.data);
        }

        if (!needs2fa) {
          registerForPushNotifications(firebaseUser.uid).catch(() => {});
        }
      } else {
        await clearBackgroundSessionMarker();
        clearPending2faMark();
        setPending2fa(false);
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "background") {
        try {
          if (auth.currentUser) {
            await AsyncStorage.setItem(BG_SESSION_AT_KEY, String(Date.now()));
          }
        } catch {
          /* noop */
        }
        return;
      }
      if (state !== "active") return;

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

  const refreshProfile = async () => {
    if (!user) return;
    const result = await getUserProfile(user.uid, user);
    if (result.success) {
      setUserProfile(result.data);
    }
  };

  const completePending2fa = useCallback(async () => {
    clearPending2faMark();
    setPending2fa(false);
    if (user?.uid) {
      registerForPushNotifications(user.uid).catch(() => {});
      const result = await getUserProfile(user.uid, user);
      if (result.success) setUserProfile(result.data);
    }
  }, [user]);

  const cancelPending2fa = useCallback(async () => {
    clearPending2faMark();
    setPending2fa(false);
    await signOut();
  }, []);

  /** Por si el OTP screen necesita reafirmar el gate (p. ej. tras remount). */
  const ensurePending2fa = useCallback((uid) => {
    if (!uid) return;
    markPending2fa(uid);
    setPending2fa(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        pending2fa,
        refreshProfile,
        completePending2fa,
        cancelPending2fa,
        ensurePending2fa,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
