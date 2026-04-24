// BOTTOM TAB NAVIGATOR - StudySync (Migración de BottomNavBar L397-411)
import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, MessageSquare, User } from 'lucide-react-native';
import GroupsScreen from '../screens/main/GroupsScreen';
import MessagesListScreen from '../screens/main/MessagesListScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getMyInvitations } from '../services/firestoreService';

const Tab = createBottomTabNavigator();

export default function BottomTabNavigator() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [invitationCount, setInvitationCount] = useState(0);

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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: theme.tabBg,
          borderTopWidth: 1,
          borderTopColor: theme.tabBorder,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          height: 60 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Grupos"
        component={GroupsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
          tabBarBadge: invitationCount > 0 ? invitationCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700',
          },
          tabBarAccessibilityLabel: invitationCount > 0
            ? `Grupos, ${invitationCount} invitaciones pendientes`
            : 'Grupos',
        }}
      />
      <Tab.Screen
        name="Mensajes"
        component={MessagesListScreen}
        options={{
          tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
          tabBarAccessibilityLabel: 'Mensajes',
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          tabBarAccessibilityLabel: 'Perfil',
        }}
      />
    </Tab.Navigator>
  );
}
