// APP NAVIGATOR - StudySync
// Reemplaza el sistema currentView + goTo() del frontend React
import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../contexts/AuthContext';
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
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
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
  const intervalRef = useRef(null);

  // Ocultar el splash nativo en cuanto Firebase resuelva la sesión.
  // Mientras loading=true el splash sigue visible → sin parpadeo de interfaz vacía.
  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {});
    }
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

  // Mientras loading=true el splash sigue visible (preventAutoHideAsync),
  // así que no hace falta renderizar nada — el usuario solo ve el splash.
  if (loading) return null;

  return user ? <MainStack /> : <AuthStack />;
}
