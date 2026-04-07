// ============================================
// GROUP DETAILS SCREEN - StudySync
// Migración de líneas 682-883 del frontend React
// Tabs: Tareas, Archivos, Miembros
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  StatusBar,
  Modal,
} from 'react-native';
import {
  ChevronLeft,
  MessageSquare,
  Plus,
  UserPlus,
  FileText,
  CheckSquare,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import * as firestoreService from '../../services/firestoreService';
import { uploadFile } from '../../services/storageService';
import TaskItem from '../../components/TaskItem';
import EmptyState from '../../components/EmptyState';

export default function GroupDetailsScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [files, setFiles] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('tareas');
  const [loading, setLoading] = useState(true);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Cargar datos del grupo
    const loadGroup = async () => {
      try {
        const groupData = await firestoreService.getGroup(groupId);
        if (cancelled) return;
        setGroup(groupData);

        // Cargar miembros
        if (groupData?.members) {
          const memberData = await firestoreService.getUsersByIds(groupData.members);
          if (cancelled) return;
          setMembers(memberData);
        }
      } catch (e) {
        console.error('Error cargando grupo:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadGroup();

    // Escuchar tareas en tiempo real
    const unsubTasks = firestoreService.getGroupTasks(groupId, (fetchedTasks) => {
      if (!cancelled) setTasks(fetchedTasks);
    });

    // Escuchar archivos en tiempo real
    const unsubFiles = firestoreService.getGroupFiles(groupId, (fetchedFiles) => {
      if (!cancelled) setFiles(fetchedFiles);
    });

    return () => {
      cancelled = true;
      unsubTasks();
      unsubFiles();
    };
  }, [groupId]);

  const handleInviteMember = () => {
    setInviteEmail('');
    setInviteModalVisible(true);
  };

  const handleSendInvitation = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      Alert.alert('Error', 'Ingresa un correo electrónico');
      return;
    }
    setInviting(true);
    try {
      const target = await firestoreService.getUserByEmail(email);
      if (!target) {
        Alert.alert('No encontrado', 'No existe ningún usuario registrado con ese correo.');
        setInviting(false);
        return;
      }
      if (target.id === user.uid) {
        Alert.alert('Error', 'No puedes invitarte a ti mismo.');
        setInviting(false);
        return;
      }
      await firestoreService.inviteUserToGroup({
        groupId,
        groupName: group.name,
        invitedUserId: target.id,
        invitedBy: user.uid,
        invitedByName: user.displayName || user.email || 'Un compañero',
      });
      setInviteModalVisible(false);
      Alert.alert('Invitación enviada', `Se envió una invitación a ${target.name || email}.`);
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo enviar la invitación');
    } finally {
      setInviting(false);
    }
  };

  const isLeader = group?.leaderId === user?.uid;

  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    let nextStatus = 'Pendiente';
    if (currentStatus === 'Pendiente') nextStatus = 'En progreso';
    else if (currentStatus === 'En progreso') nextStatus = 'Completada';
    else if (currentStatus === 'Completada') nextStatus = 'Pendiente';

    try {
      await firestoreService.updateTaskStatus(taskId, nextStatus);
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar la tarea.');
    }
  };

  const handleFileUpload = () => {
    Alert.alert(
      'Función no disponible',
      'La carga de archivos requiere instalar "expo-document-picker". Ejecuta:\n\nnpx expo install expo-document-picker'
    );
  };

  const handleRemoveMember = (memberId, memberName) => {
    Alert.alert(
      'Confirmar',
      `¿Estás seguro de expulsar a ${memberName} del grupo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Expulsar',
          style: 'destructive',
          onPress: async () => {
            await firestoreService.removeMemberFromGroup(groupId, memberId);
            setMembers(prev => prev.filter(m => m.id !== memberId));
          },
        },
      ]
    );
  };

  const getMemberName = (memberId) => {
    const member = members.find(m => m.id === memberId);
    return member ? member.name.split(' ')[0] : 'Sin asignar';
  };

  if (loading || !group) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const leaderName = members.find(m => m.id === group.leaderId)?.name?.split(' ')[0] || 'Líder';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft color="#6B7280" size={24} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{group.name}</Text>
            <Text style={styles.headerSubtitle}>
              {group.members?.length || 0} miembros | Líder: {leaderName}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {['tareas', 'archivos', 'miembros'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'tareas' ? `TAREAS (${tasks.length})` : tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* TAREAS TAB */}
        {activeTab === 'tareas' && (
          <>
            {tasks.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title="¡Todo al día!"
                message="No hay tareas asignadas en este grupo actualmente."
                actionText={isLeader ? "Agregar Nueva Tarea" : null}
                onAction={() => navigation.navigate('CreateTask', { groupId })}
              />
            ) : (
              <FlatList
                data={tasks}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TaskItem
                    task={item}
                    assigneeName={getMemberName(item.assigneeId)}
                    onToggleStatus={handleToggleTaskStatus}
                  />
                )}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                  isLeader && (
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => navigation.navigate('CreateTask', { groupId })}
                      activeOpacity={0.7}
                    >
                      <Plus color="#4F46E5" size={16} />
                      <Text style={styles.addButtonText}>Agregar Nueva Tarea</Text>
                    </TouchableOpacity>
                  )
                }
              />
            )}
          </>
        )}

        {/* ARCHIVOS TAB */}
        {activeTab === 'archivos' && (
          <>
            {files.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Sin documentos"
                message="Aún no hay archivos compartidos en este grupo."
                actionText="Subir Archivo"
                onAction={handleFileUpload}
              />
            ) : (
              <FlatList
                data={files}
                keyExtractor={(item) => item.id}
                renderItem={({ item: file }) => (
                  <View style={styles.fileCard}>
                    <View style={styles.fileInfo}>
                      <View style={styles.fileIcon}>
                        <Text style={styles.fileIconText}>{file.type || 'FILE'}</Text>
                      </View>
                      <View>
                        <Text style={styles.fileName}>{file.name}</Text>
                        <Text style={styles.fileDate}>
                          Subido el {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                  <TouchableOpacity
                    style={styles.addButtonDashed}
                    onPress={handleFileUpload}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addButtonDashedText}>Subir Archivo</Text>
                  </TouchableOpacity>
                }
              />
            )}
          </>
        )}

        {/* MIEMBROS TAB */}
        {activeTab === 'miembros' && (
          <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            renderItem={({ item: member }) => (
              <View style={styles.memberCard}>
                <View style={styles.memberInfo}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {member.name.charAt(0)}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberRole}>
                      {member.id === group.leaderId ? 'Líder del Grupo' : 'Miembro'}
                    </Text>
                  </View>
                </View>
                {isLeader && member.id !== user.uid && (
                  <TouchableOpacity
                    onPress={() => handleRemoveMember(member.id, member.name)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeButtonText}>Expulsar</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              isLeader && (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleInviteMember}
                  activeOpacity={0.7}
                >
                  <UserPlus color="#4F46E5" size={16} />
                  <Text style={styles.addButtonText}>Invitar Miembro</Text>
                </TouchableOpacity>
              )
            }
          />
        )}
      </View>

      {/* Bottom Action */}
      <View style={styles.bottomAction}>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => navigation.navigate('Chat', { groupId })}
          activeOpacity={0.8}
        >
          <MessageSquare color="#FFFFFF" size={20} />
          <Text style={styles.chatButtonText}>Abrir Chat del Trabajo</Text>
        </TouchableOpacity>
      </View>

      {/* Invite Modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invitar Miembro</Text>
            <Text style={styles.modalSubtitle}>
              Ingresa el correo del usuario que quieres invitar al grupo.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="correo@ejemplo.com"
              placeholderTextColor="#9CA3AF"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!inviting}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setInviteModalVisible(false)}
                disabled={inviting}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSendBtn, inviting && { opacity: 0.6 }]}
                onPress={handleSendInvitation}
                disabled={inviting}
              >
                <Text style={styles.modalSendText}>
                  {inviting ? 'Enviando...' : 'Enviar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerInfo: {},
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#4F46E5',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#4F46E5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  listContent: {
    paddingBottom: 16,
  },
  // File Card
  fileCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileIconText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  fileDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  // Member Card
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  memberRole: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  // Buttons
  addButton: {
    width: '100%',
    marginTop: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#A5B4FC',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  addButtonDashed: {
    width: '100%',
    marginTop: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDashedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  bottomAction: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  chatButton: {
    width: '100%',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  chatButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Invite Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCancelBtn: {
    backgroundColor: '#F3F4F6',
  },
  modalCancelText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 14,
  },
  modalSendBtn: {
    backgroundColor: '#4F46E5',
  },
  modalSendText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
