// ============================================
// GROUP DETAILS SCREEN - StudySync
// Migración de líneas 682-883 del frontend React
// Tabs: Tareas, Archivos, Miembros
// ============================================

import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  StatusBar,
  Modal,
} from "react-native";
import Text from "../../components/AppText";
import { useAccessibility } from "../../contexts/AccessibilityContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  MessageSquare,
  Plus,
  UserPlus,
  FileText,
  CheckSquare,
  Pencil,
} from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useFileStorage } from "../../contexts/FileStorageContext";
import * as firestoreService from "../../services/firestoreService";
import TaskItem from "../../components/TaskItem";
import EmptyState from "../../components/EmptyState";

export default function GroupDetailsScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useAccessibility();
  const { uploadGroupFile, deleteGroupFile } = useFileStorage();
  const insets = useSafeAreaInsets();
  const [group, setGroup] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [files, setFiles] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState("tareas");
  const [loading, setLoading] = useState(true);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

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
          const memberData = await firestoreService.getUsersByIds(
            groupData.members,
          );
          if (cancelled) return;
          setMembers(memberData);
        }
      } catch (e) {
        console.error("Error cargando grupo:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadGroup();

    // Escuchar tareas en tiempo real
    const unsubTasks = firestoreService.getGroupTasks(
      groupId,
      (fetchedTasks) => {
        if (!cancelled) setTasks(fetchedTasks);
      },
    );

    // Escuchar archivos en tiempo real
    const unsubFiles = firestoreService.getGroupFiles(
      groupId,
      (fetchedFiles) => {
        if (!cancelled) setFiles(fetchedFiles);
      },
    );

    return () => {
      cancelled = true;
      unsubTasks();
      unsubFiles();
    };
  }, [groupId]);

  const handleInviteMember = () => {
    setInviteEmail("");
    setInviteModalVisible(true);
  };

  const handleSendInvitation = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      Alert.alert(t('error'), t('enterValidEmail'));
      return;
    }
    setInviting(true);
    try {
      const target = await firestoreService.getUserByEmail(email);
      if (!target) {
        Alert.alert(
          t('userNotFound'),
          t('userNotFoundMsg'),
        );
        setInviting(false);
        return;
      }
      if (target.id === user.uid) {
        Alert.alert(t('error'), t('cantInviteSelf'));
        setInviting(false);
        return;
      }
      await firestoreService.inviteUserToGroup({
        groupId,
        groupName: group.name,
        invitedUserId: target.id,
        invitedBy: user.uid,
        invitedByName: user.displayName || user.email || "Un compañero",
      });
      setInviteModalVisible(false);
      Alert.alert(
        t('invitationSent'),
        t('invitationSentMsg'),
      );
    } catch (e) {
      Alert.alert("Error", e.message || "No se pudo enviar la invitación");
    } finally {
      setInviting(false);
    }
  };

  const isLeader = group?.leaderId === user?.uid;

  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    let nextStatus = "Pendiente";
    if (currentStatus === "Pendiente") nextStatus = "En progreso";
    else if (currentStatus === "En progreso") nextStatus = "Completada";
    else if (currentStatus === "Completada") nextStatus = "Pendiente";

    try {
      await firestoreService.updateTaskStatus(taskId, nextStatus);
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar la tarea.");
    }
  };

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setUploading(true);

      // Subir archivo a Supabase
      const uploadedFile = await uploadGroupFile(
        groupId,
        file.uri,
        file.name,
      );

      // Guardar metadatos en Firestore
      await firestoreService.addGroupFile({
        groupId,
        fileName: uploadedFile.fileName,
        filePath: uploadedFile.filePath,
        publicUrl: uploadedFile.publicUrl,
        uploadedBy: user.uid,
        uploadedByName: user.displayName || user.email,
        uploadedAt: new Date(),
        fileSize: file.size || 0,
      });

      Alert.alert(t('success'), t('uploadSuccess'));
    } catch (e) {
      console.error('Error uploading file:', e);
      Alert.alert(t('error'), t('uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveMember = (memberId, memberName) => {
    Alert.alert(
      t('confirm'),
      t('kickMemberMsg'),
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('kickMember'),
          style: "destructive",
          onPress: async () => {
            await firestoreService.removeMemberFromGroup(groupId, memberId);
            setMembers((prev) => prev.filter((m) => m.id !== memberId));
          },
        },
      ],
    );
  };

  const handleOpenEditModal = () => {
    setEditName(group.name || "");
    setEditDescription(group.description || "");
    setEditModalVisible(true);
  };

  const handleSaveGroup = async () => {
    if (!editName.trim()) {
      Alert.alert(t('error'), t('groupNameRequiredAlert'));
      return;
    }
    setSaving(true);
    try {
      await firestoreService.updateGroup(groupId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setGroup((prev) => ({ ...prev, name: editName.trim(), description: editDescription.trim() }));
      setEditModalVisible(false);
      Alert.alert(t('success'), t('groupUpdated'));
    } catch (e) {
      Alert.alert(t('error'), t('groupUpdateError'));
    } finally {
      setSaving(false);
    }
  };

  const getMemberName = (memberId) => {
    const member = members.find((m) => m.id === memberId);
    return member ? member.name.split(" ")[0] : "Sin asignar";
  };

  if (loading || !group) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{t('loading')}</Text>
      </View>
    );
  }

  const leaderName =
    members.find((m) => m.id === group.leaderId)?.name?.split(" ")[0] ||
    "Líder";

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.card} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">{group.name}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {group.members?.length || 0} {t('members')} | {t('admin')}: {leaderName}
          </Text>
        </View>
        {isLeader ? (
          <TouchableOpacity
            onPress={handleOpenEditModal}
            style={[styles.editHeaderBtn, { backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF" }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Pencil color="#4F46E5" size={20} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {["tareas", "archivos", "miembros"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                { color: theme.textSecondary },
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab === "tareas"
                ? `${t('tasks').toUpperCase()} (${tasks.length})`
                : tab === "archivos" ? t('attachFile').toUpperCase() : t('members').toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* TAREAS TAB */}
        {activeTab === "tareas" && (
          <>
            {tasks.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title={t('allTasksDone')}
                message={t('noTasksAssigned')}
                actionText={isLeader ? t('addNewTask') : null}
                onAction={() => navigation.navigate("CreateTask", { groupId })}
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
                    isLeader={isLeader}
                    onEdit={(task) => navigation.navigate("CreateTask", { groupId, task })}
                  />
                )}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: insets.bottom + 100 },
                ]}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                  isLeader && (
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() =>
                        navigation.navigate("CreateTask", { groupId })
                      }
                      activeOpacity={0.7}
                    >
                      <Plus color="#4F46E5" size={16} />
                      <Text style={styles.addButtonText}>
                        {t('createTask')}
                      </Text>
                    </TouchableOpacity>
                  )
                }
              />
            )}
          </>
        )}

        {/* ARCHIVOS TAB */}
        {activeTab === "archivos" && (
          <>
            {files.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={t('noDocuments')}
                message={t('noFilesShared')}
                actionText={uploading ? t('uploading') : t('uploadFile')}
                onAction={uploading ? null : handleFileUpload}
              />
            ) : (
              <FlatList
                data={files}
                keyExtractor={(item) => item.id}
                renderItem={({ item: file }) => (
                  <View style={[styles.fileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.fileInfo}>
                      <View style={styles.fileIcon}>
                        <Text style={styles.fileIconText}>
                          {file.fileName?.split('.').pop()?.toUpperCase() || "FILE"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fileName, { color: theme.text }]}>{file.fileName}</Text>
                        <Text style={[styles.fileDate, { color: theme.textMuted }]}>
                          {t('uploadedBy')}: {file.uploadedByName}
                        </Text>
                        <Text style={[styles.fileDate, { color: theme.textMuted }]}>
                          {t('uploadedOn')}{" "}
                          {file.uploadedAt
                            ? new Date(file.uploadedAt).toLocaleDateString(
                                "es-ES",
                                { day: "2-digit", month: "2-digit" },
                              )
                            : ""}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.fileActions}>
                      <TouchableOpacity
                        onPress={() => {
                          // Aquí iría la lógica de descargar
                          console.log('Descargando:', file.publicUrl);
                          Alert.alert(t('success'), t('downloadFile'));
                        }}
                        style={[styles.actionButton, { backgroundColor: isDark ? "#312E81" : "#EEF2FF" }]}
                      >
                        <Text style={{ color: '#4F46E5', fontSize: 12 }}>↓</Text>
                      </TouchableOpacity>
                      {isLeader && (
                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert(
                              t('confirm'),
                              t('deleteFileConfirm'),
                              [
                                { text: t('cancel'), style: 'cancel' },
                                {
                                  text: t('delete'),
                                  style: 'destructive',
                                  onPress: async () => {
                                    try {
                                      await deleteGroupFile(file.filePath);
                                      await firestoreService.deleteGroupFile(groupId, file.id);
                                      Alert.alert(t('success'), t('fileDeleted'));
                                    } catch (error) {
                                      Alert.alert(t('error'), error.message);
                                    }
                                  },
                                },
                              ]
                            );
                          }}
                          style={[styles.actionButton, { backgroundColor: '#FEE2E2' }]}
                        >
                          <Text style={{ color: '#DC2626', fontSize: 12 }}>🗑</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: insets.bottom + 100 },
                ]}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                  <TouchableOpacity
                    style={[styles.addButtonDashed, { borderColor: theme.border }]}
                    onPress={uploading ? null : handleFileUpload}
                    activeOpacity={0.7}
                    disabled={uploading}
                  >
                    <Text style={[styles.addButtonDashedText, { color: theme.textSecondary }]}>
                      {uploading ? t('uploading') : t('uploadFile')}
                    </Text>
                  </TouchableOpacity>
                }
              />
            )}
          </>
        )}

        {/* MIEMBROS TAB */}
        {activeTab === "miembros" && (
          <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            renderItem={({ item: member }) => (
              <View style={[styles.memberCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.memberInfo}>
                  <View style={[styles.memberAvatar, { backgroundColor: isDark ? "#312E81" : "#EEF2FF" }]}>
                    <Text style={styles.memberAvatarText}>
                      {member.name.trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join("")}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.memberName, { color: theme.text }]}>{member.name}</Text>
                    <View style={member.id === group.leaderId ? styles.badgeLeader : styles.badgeMember}>
                      <Text style={member.id === group.leaderId ? styles.badgeLeaderText : styles.badgeMemberText}>
                        {member.id === group.leaderId ? t('admin') : t('member')}
                      </Text>
                    </View>
                  </View>
                </View>
                {isLeader && member.id !== user.uid && (
                  <TouchableOpacity
                    onPress={() => handleRemoveMember(member.id, member.name)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeButtonText}>{t('removeMember')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              isLeader && (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleInviteMember}
                  activeOpacity={0.7}
                >
                  <UserPlus color="#4F46E5" size={16} />
                  <Text style={styles.addButtonText}>{t('inviteMembers')}</Text>
                </TouchableOpacity>
              )
            }
          />
        )}
      </View>

      {/* Bottom Action */}
      <View
        style={[styles.bottomAction, { paddingBottom: insets.bottom + 16, backgroundColor: theme.card, borderTopColor: theme.border }]}
      >
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => navigation.navigate("Chat", { groupId })}
          activeOpacity={0.8}
        >
          <MessageSquare color="#FFFFFF" size={20} />
          <Text style={styles.chatButtonText}>{t('chat')}</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Group Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t('editGroup')}</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {t('editGroupDesc')}
            </Text>
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>{t('groupNameLabel')}</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
              value={editName}
              onChangeText={setEditName}
              placeholder={t('groupNamePlaceholder2')}
              placeholderTextColor={theme.textMuted}
              editable={!saving}
            />
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>{t('groupDescLabel')}</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 80, textAlignVertical: "top", backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder={t('groupDescPlaceholder')}
              placeholderTextColor={theme.textMuted}
              multiline
              editable={!saving}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: isDark ? "#374151" : "#F3F4F6" }]}
                onPress={() => setEditModalVisible(false)}
                disabled={saving}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSendBtn, saving && { opacity: 0.6 }]}
                onPress={handleSaveGroup}
                disabled={saving}
              >
                <Text style={styles.modalSendText}>{saving ? t('loading') : t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite Modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t('inviteMemberTitle')}</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {t('enterEmailInvite')}
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder={t('emailExamplePlaceholder')}
              placeholderTextColor={theme.textMuted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!inviting}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: isDark ? "#374151" : "#F3F4F6" }]}
                onPress={() => setInviteModalVisible(false)}
                disabled={inviting}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalSendBtn,
                  inviting && { opacity: 0.6 },
                ]}
                onPress={handleSendInvitation}
                disabled={inviting}
              >
                <Text style={styles.modalSendText}>
                  {inviting ? t('loading') : t('send')}
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
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    color: "#6B7280",
    fontSize: 14,
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#4F46E5",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#4F46E5",
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  fileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  fileIconText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#DC2626",
  },
  fileName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  fileDate: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  fileActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  // Member Card
  memberCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4F46E5",
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  memberRole: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  badgeLeader: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#312E81",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 3,
  },
  badgeLeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E0E7FF",
  },
  badgeMember: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 3,
  },
  badgeMemberText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4338CA",
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#EF4444",
  },
  // Buttons
  addButton: {
    width: "100%",
    marginTop: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#A5B4FC",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4F46E5",
  },
  addButtonDashed: {
    width: "100%",
    marginTop: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDashedText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  bottomAction: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  chatButton: {
    width: "100%",
    backgroundColor: "#4F46E5",
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  chatButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  editHeaderBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },
  // Invite Modal
  modalOverlay: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCancelBtn: {
    backgroundColor: "#F3F4F6",
  },
  modalCancelText: {
    color: "#4B5563",
    fontWeight: "600",
    fontSize: 14,
  },
  modalSendBtn: {
    backgroundColor: "#4F46E5",
  },
  modalSendText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
