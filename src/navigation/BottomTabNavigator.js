// BOTTOM TAB NAVIGATOR - StudySync (Migración de BottomNavBar L397-411)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Users, MessageSquare, User, ClipboardList, Bell } from 'lucide-react-native';
import GroupsScreen from '../screens/main/GroupsScreen';
import MessagesListScreen from '../screens/main/MessagesListScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import TaskInboxScreen from '../screens/main/TaskInboxScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { getMyInvitations, getMyAssignedTasks, getMyNotifications, getMyGroups, fetchLastMessagesForGroups, migrateGroupLastMessage } from '../services/firestoreService';

const Tab = createBottomTabNavigator();

/** El `Label` por defecto usa 1 línea → textos largos se cortan con 5 tabs; 2 líneas en Android. */
function androidTabBarLabel(text) {
  return function AndroidTabBarLabel({ color }) {
    return (
      <Text
        numberOfLines={2}
        ellipsizeMode="tail"
        style={{
          color,
          fontSize: 10,
          fontWeight: '600',
          textAlign: 'center',
          lineHeight: 12,
          marginTop: 2,
          paddingHorizontal: 1,
        }}
      >
        {text}
      </Text>
    );
  };
}

export default function BottomTabNavigator() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useAccessibility();

  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: theme.tabBg,
      borderTopWidth: 1,
      borderTopColor: theme.tabBorder,
      ...(Platform.OS === 'android'
        ? {
            // Sin `height` fijo: la tab bar suma el inset inferior al alto por defecto
            // (coherente con edge-to-edge). Evita franja entre pestañas y barra del sistema.
            paddingTop: 2,
            elevation: 0,
            shadowOpacity: 0,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 0,
          }
        : { paddingTop: 8 }),
    }),
    [theme.tabBg, theme.tabBorder],
  );
  const [invitationCount, setInvitationCount] = useState(0);
  const [pendingTaskCount, setPendingTaskCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  // Mantiene la última lista de grupos para que los callbacks de onLastMessage
  // puedan rehacer el recuento sin necesitar un re-render del getMyGroups.
  const latestGroupsRef = useRef({});

  // Listener global para invitaciones pendientes (badge en tab Grupos)
  useEffect(() => {
    if (!user) {
      setInvitationCount(0);
      return;
    }
    const unsub = getMyInvitations(user.uid, (invitations) => {
      setInvitationCount(invitations.length);
    });
    return () => unsub();
  }, [user]);

  // Listener global para tareas pendientes (badge en tab Tareas)
  useEffect(() => {
    if (!user) {
      setPendingTaskCount(0);
      return;
    }
    const unsub = getMyAssignedTasks(user.uid, (tasks) => {
      const pending = tasks.filter(
        (t) => t.status === 'Pendiente' || t.status === 'En progreso',
      ).length;
      setPendingTaskCount(pending);
    });
    return () => unsub();
  }, [user]);

  // Listener global para notificaciones no leídas (badge en tab Notificaciones)
  useEffect(() => {
    if (!user) { setUnreadNotifCount(0); return; }
    const unsub = getMyNotifications(user.uid, (notifs) => {
      setUnreadNotifCount(notifs.filter((n) => !n.read).length);
    });
    return () => unsub();
  }, [user]);

  // Listener global para mensajes no leídos (badge en tab Mensajes)
  //
  // Estrategia:
  //  1. getMyGroups (ya activo) → para grupos CON `lastMessage` el recuento
  //     es inmediato, igual que notificaciones/tareas.
  //  2. Para grupos SIN `lastMessage` (datos anteriores al cambio de código)
  //     se hace UNA sola ronda de red con Promise.all (paralelo), no N rondas
  //     secuenciales. Al terminar se escribe `lastMessage` en cada grupo
  //     (migración fire-and-forget) → próximo arranque es instantáneo.
  useEffect(() => {
    if (!user) { setUnreadMsgCount(0); return; }
    let cancelled = false;
    // Cache local para últimos mensajes de grupos aún sin `lastMessage` en Firestore
    const legacyCache = {};

    const recount = (groups) => {
      if (cancelled) return;
      let count = 0;
      groups.forEach((g) => {
        const lm = g.lastMessage !== undefined ? g.lastMessage : legacyCache[g.id];
        if (lm && lm.readBy && !lm.readBy.includes(user.uid)) count++;
      });
      setUnreadMsgCount(count);
    };

    const unsub = getMyGroups(user.uid, (groups) => {
      if (cancelled) return;
      latestGroupsRef.current = groups;

      // Recuento inmediato con lo que ya tenemos (grupos con lastMessage)
      recount(groups);

      // Grupos que aún no tienen `lastMessage` y no están en el cache local
      const needFetch = groups.filter(
        (g) => g.lastMessage === undefined && legacyCache[g.id] === undefined
      );
      if (needFetch.length === 0) return;

      // Marcar como "en proceso" para no lanzar doble fetch si getMyGroups
      // vuelve a dispararse antes de que Promise.all resuelva
      needFetch.forEach((g) => { legacyCache[g.id] = null; });

      fetchLastMessagesForGroups(needFetch.map((g) => g.id)).then((results) => {
        if (cancelled) return;
        results.forEach(({ groupId, msg }) => {
          legacyCache[groupId] = msg;
          // Migrar en Firestore: próximo arranque usará el camino rápido
          if (msg) migrateGroupLastMessage(groupId, msg).catch(() => {});
        });
        recount(latestGroupsRef.current);
      });
    });

    return () => { cancelled = true; unsub(); };
  }, [user]);

  return (
    <Tab.Navigator
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { flex: 1, backgroundColor: theme.bg },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle,
        tabBarLabelStyle:
          Platform.OS === 'android'
            ? undefined
            : {
                fontSize: 11,
                fontWeight: '600',
              },
      }}
    >
      <Tab.Screen
        name="Grupos"
        component={GroupsScreen}
        options={{
          tabBarLabel: Platform.OS === 'android' ? androidTabBarLabel(t('groups')) : t('groups'),
          tabBarIcon: ({ color, size }) => (
            <Users color={color} size={Platform.OS === 'android' ? Math.round(size * 0.92) : size} />
          ),
          tabBarBadge: invitationCount > 0 ? invitationCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700',
          },
          tabBarAccessibilityLabel: invitationCount > 0
            ? t('tabBarGroupsA11yWithInvites', { n: invitationCount })
            : t('groups'),
        }}
      />
      <Tab.Screen
        name="Mensajes"
        component={MessagesListScreen}
        options={{
          tabBarLabel: Platform.OS === 'android' ? androidTabBarLabel(t('messages')) : t('messages'),
          tabBarIcon: ({ color, size }) => (
            <MessageSquare color={color} size={Platform.OS === 'android' ? Math.round(size * 0.92) : size} />
          ),
          tabBarBadge: unreadMsgCount > 0 ? unreadMsgCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700',
          },
          tabBarAccessibilityLabel: unreadMsgCount > 0
            ? t('tabBarMessagesA11yUnread', { n: unreadMsgCount })
            : t('messages'),
        }}
      />
      <Tab.Screen
        name="Tareas"
        component={TaskInboxScreen}
        options={{
          tabBarLabel: Platform.OS === 'android' ? androidTabBarLabel(t('tasks')) : t('tasks'),
          tabBarIcon: ({ color, size }) => (
            <ClipboardList color={color} size={Platform.OS === 'android' ? Math.round(size * 0.92) : size} />
          ),
          tabBarBadge: pendingTaskCount > 0 ? pendingTaskCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700',
          },
          tabBarAccessibilityLabel: pendingTaskCount > 0
            ? t('tabBarTasksA11yWithPending', { n: pendingTaskCount })
            : t('tasks'),
        }}
      />
      <Tab.Screen
        name="Notificaciones"
        component={NotificationsScreen}
        options={{
          tabBarLabel:
            Platform.OS === 'android' ? androidTabBarLabel(t('notifications')) : t('notifications'),
          tabBarIcon: ({ color, size }) => (
            <Bell color={color} size={Platform.OS === 'android' ? Math.round(size * 0.92) : size} />
          ),
          tabBarBadge: unreadNotifCount > 0 ? unreadNotifCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700',
          },
          tabBarAccessibilityLabel: unreadNotifCount > 0
            ? t('tabBarNotificationsA11yUnread', { n: unreadNotifCount })
            : t('notifications'),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{
          tabBarLabel: Platform.OS === 'android' ? androidTabBarLabel(t('profile')) : t('profile'),
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={Platform.OS === 'android' ? Math.round(size * 0.92) : size} />
          ),
          tabBarAccessibilityLabel: t('profile'),
        }}
      />
    </Tab.Navigator>
  );
}
