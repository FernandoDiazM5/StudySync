// ============================================
// GROUPS SCREEN - StudySync
// Migración de líneas 198-271 del frontend React
// Vista principal de "Mis Grupos"
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { Search, Plus, Clock, CheckSquare, Mail, Check, X } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getMyGroups, getMyInvitations, acceptInvitation, declineInvitation } from '../../services/firestoreService';
import * as firestoreService from '../../services/firestoreService';

export default function GroupsScreen({ navigation }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [groupTasks, setGroupTasks] = useState({});
  const [invitations, setInvitations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // CASCADA: Invitaciones pendientes del usuario
  useEffect(() => {
    if (!user) {
      setInvitations([]);
      return;
    }
    const unsub = getMyInvitations(user.uid, setInvitations);
    return () => unsub();
  }, [user]);

  const handleAcceptInvitation = async (invitation) => {
    try {
      await acceptInvitation(invitation.id, invitation.groupId, user.uid);
      // El listener de getMyGroups detectará el nuevo grupo automáticamente.
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo aceptar la invitación');
    }
  };

  const handleDeclineInvitation = async (invitationId) => {
    try {
      await declineInvitation(invitationId);
    } catch (e) {
      Alert.alert('Error', 'No se pudo rechazar la invitación');
    }
  };

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setGroupTasks({});
      setLoading(false);
      return;
    }

    // Map para trackear unsubscribes de cada listener de tareas por grupo
    const taskUnsubs = new Map();

    // CASCADA NIVEL 1: Usuario → Grupos
    const unsubscribe = getMyGroups(user.uid, (fetchedGroups) => {
      setGroups(fetchedGroups);
      setLoading(false);

      const currentIds = new Set(fetchedGroups.map(g => g.id));

      // Limpiar listeners de grupos que ya no están
      for (const [groupId, unsub] of taskUnsubs.entries()) {
        if (!currentIds.has(groupId)) {
          unsub();
          taskUnsubs.delete(groupId);
          setGroupTasks(prev => {
            const next = { ...prev };
            delete next[groupId];
            return next;
          });
        }
      }

      // CASCADA NIVEL 2: Para cada grupo nuevo → escuchar sus tareas
      fetchedGroups.forEach(group => {
        if (!taskUnsubs.has(group.id)) {
          const unsubTasks = firestoreService.getGroupTasks(group.id, (tasks) => {
            setGroupTasks(prev => ({
              ...prev,
              [group.id]: tasks
            }));
          });
          taskUnsubs.set(group.id, unsubTasks);
        }
      });
    });

    return () => {
      unsubscribe();
      // Limpiar TODOS los listeners de tareas al desmontar
      for (const unsub of taskUnsubs.values()) unsub();
      taskUnsubs.clear();
    };
  }, [user]);

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.desc && g.desc.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderGroupCard = ({ item: group }) => {
    const tasks = groupTasks[group.id] || [];
    const pendingTasks = tasks.filter(t => t.status === 'Pendiente' || t.status === 'En progreso');
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Completada').length;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => navigation.navigate('GroupDetails', { groupId: group.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardContent}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.groupDesc}>{group.desc}</Text>

            <View style={styles.badgeContainer}>
              {pendingTasks.length > 0 ? (
                <View style={styles.pendingBadge}>
                  <Clock color="#D97706" size={12} />
                  <Text style={styles.pendingText}>
                    {pendingTasks.length} tarea(s) pendiente(s)
                  </Text>
                </View>
              ) : (
                <View style={styles.completedBadge}>
                  <CheckSquare color="#16A34A" size={12} />
                  <Text style={styles.completedText}>Todo al día</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{group.name.charAt(0)}</Text>
          </View>
        </View>

        {totalTasks > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progreso del trabajo</Text>
              <Text style={styles.progressValue}>
                {progressPercentage}% ({completedTasks}/{totalTasks})
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[styles.progressBarFill, { width: `${progressPercentage}%` }]}
              />
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>StudySync</Text>
          <Text style={styles.headerSubtitle}>Tu espacio de trabajo</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search color="#9CA3AF" size={16} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar grupo..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Groups List */}
      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          invitations.length > 0 ? (
            <View style={styles.invitationsSection}>
              <View style={styles.invitationsHeader}>
                <Mail color="#4F46E5" size={16} />
                <Text style={styles.invitationsTitle}>
                  Invitaciones pendientes ({invitations.length})
                </Text>
              </View>
              {invitations.map(inv => (
                <View key={inv.id} style={styles.invitationCard}>
                  <View style={styles.invitationContent}>
                    <Text style={styles.invitationGroupName}>{inv.groupName}</Text>
                    <Text style={styles.invitationText}>
                      {inv.invitedByName || 'Alguien'} te invitó a unirte
                    </Text>
                  </View>
                  <View style={styles.invitationActions}>
                    <TouchableOpacity
                      style={[styles.invitationBtn, styles.declineBtn]}
                      onPress={() => handleDeclineInvitation(inv.id)}
                      activeOpacity={0.7}
                    >
                      <X color="#DC2626" size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.invitationBtn, styles.acceptBtn]}
                      onPress={() => handleAcceptInvitation(inv)}
                      activeOpacity={0.7}
                    >
                      <Check color="#FFFFFF" size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'No se encontraron grupos' : 'No perteneces a ningún grupo aún'}
              </Text>
            </View>
          )
        }
      />

      {/* FAB - Create Group */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateGroup')}
        activeOpacity={0.8}
      >
        <Plus color="#FFFFFF" size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    position: 'relative',
  },
  header: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#C7D2FE',
    marginTop: 2,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
    gap: 12,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  groupDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  badgeContainer: {
    marginTop: 12,
    flexDirection: 'row',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#D97706',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  completedText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#16A34A',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
  },
  progressSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  progressValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#4F46E5',
    borderRadius: 3,
  },
  invitationsSection: {
    marginBottom: 16,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 12,
    padding: 12,
  },
  invitationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  invitationsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  invitationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  invitationContent: {
    flex: 1,
    marginRight: 8,
  },
  invitationGroupName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  invitationText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  invitationBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#16A34A',
  },
  declineBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
