// APP NAVIGATOR - StudySync
// Reemplaza el sistema currentView + goTo() del frontend React
import React, { useEffect, useRef } from 'react';
import { AppState, InteractionManager, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { setUserOnline, setUserOffline, checkTaskNotifications, checkLeaderNotifications } from '../services/firestoreService';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';

// Main tabs
import BottomTabNavigator from './BottomTabNavigator';

// Group screens (stack)
import GroupDetailsScreen from '../screens/group/GroupDetailsScreen';
import ChatScreen from '../screens/group/ChatScreen';
import CreateTaskScreen from '../screens/group/CreateTaskScreen';
import CreateGroupScreen from '../screens/group/CreateGroupScreen';

const Stack = createNativeStackNavigator();

function AuthStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { flex: 1, backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { flex: 1, backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const intervalRef = useRef(null);

  // Ocultar el splash cuando Firebase termine, pero después del layout (evita insets/colores
  // incorrectos cuando la 2.ª apertura resuelve auth casi al instante).
  useEffect(() => {
    if (loading) return undefined;
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (!cancelled) SplashScreen.hideAsync().catch(() => {});
        });
      });
    });
    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [loading]);

  // ── Presencia global: online cuando el app está activo ──────────────────
  useEffect(() => {
    if (!user?.uid) return;

    const uid = user.uid;

    const goOnline  = () => setUserOnline(uid).catch(() => {});
    const goOffline = () => setUserOffline(uid).catch(() => {});
    const checkNotifs = () => {
      checkTaskNotifications(uid).catch(() => {});
      checkLeaderNotifications(uid).catch(() => {});
    };

    // Marcar online y revisar notificaciones al entrar
    goOnline();
    checkNotifs();

    // Cada 60 s: keep-alive + revisar tareas (1d/2d/3d/vencida) sin tener que
    // reiniciar la app ni ir a segundo plano — el calendario “mañana” cambia
    // a medianoche con la sesión abierta.
    intervalRef.current = setInterval(() => {
      goOnline();
      checkNotifs();
    }, 60_000);

    // Solo `background` marca offline: evita `inactive` (iOS: control center,
    // notificación deslizada) que dejaría offline sin estar en segundo plano.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        goOnline();
        checkNotifs();
      } else if (state === 'background') {
        goOffline();
      }
    });

    return () => {
      clearInterval(intervalRef.current);
      sub.remove();
      goOffline();
    };
  }, [user]);

  // Mantener un árbol estable bajo NavigationContainer (evita medir insets mal con `null`).
  // El splash nativo sigue tapando hasta hideAsync.
  if (loading) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} collapsable={false} />;
  }

  return user ? <MainStack /> : <AuthStack />;
}
