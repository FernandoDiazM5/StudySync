// ============================================
// GROUPS SCREEN - StudySync
// Migración de líneas 198-271 del frontend React
// Vista principal de "Mis Grupos"
// ============================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  ActivityIndicator,
  InteractionManager,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Text from "../../components/AppText";
import GroupAvatar from "../../components/GroupAvatar";
import SwipeableRow from "../../components/SwipeableRow";
import { useAccessibility } from "../../contexts/AccessibilityContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Search,
  Plus,
  Clock,
  CheckSquare,
  Mail,
  Check,
  X,
  SlidersHorizontal,
  MessageSquare,
  Trash2,
  LogOut,
  Users,
  AlertTriangle,
  Crown,
} from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  getMyGroups,
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
  sortGroupsForUser,
} from "../../services/firestoreService";
import * as firestoreService from "../../services/firestoreService";

// ── Paleta del indicador de riesgo — familia indigo/violet de la app ─────────
// L1 suave → L4 violeta, coherente con #4F46E5 / #6366F1 / #7C3AED
const RISK_PALETTE = [
  { bar: '#818CF8', lightBg: '#EEF2FF', lightBorder: '#C7D2FE', darkBg: 'rgba(129,140,248,0.10)', darkBorder: 'rgba(129,140,248,0.22)' }, // bajo
  { bar: '#6366F1', lightBg: '#E0E7FF', lightBorder: '#A5B4FC', darkBg: 'rgba(99,102,241,0.12)',  darkBorder: 'rgba(99,102,241,0.26)'  }, // medio
  { bar: '#4F46E5', lightBg: '#EEF2FF', lightBorder: '#818CF8', darkBg: 'rgba(79,70,229,0.14)',   darkBorder: 'rgba(79,70,229,0.30)'   }, // alto
  { bar: '#7C3AED', lightBg: '#EDE9FE', lightBorder: '#C4B5FD', darkBg: 'rgba(124,58,237,0.14)',  darkBorder: 'rgba(124,58,237,0.30)'  }, // crítico
];

/**
 * Calcula el nivel de riesgo 0–4 del grupo usando una puntuación acumulada.
 * Cada tarea activa suma puntos según cuántos días faltan para su vencimiento;
 * el puntaje total determina el nivel, de modo que múltiples tareas próximas
 * a vencer elevan el riesgo incluso si ninguna está en estado crítico.
 *
 *   Puntos por tarea:
 *     Vencida          → +4   (sube a crítico de inmediato)
 *     Hoy              → +3
 *     Mañana           → +2
 *     2–3 días         → +1
 *     4–7 días         → +0.5
 *     8–14 días        → +0.2
 *     > 14 días        →  0   (no impacta)
 *
 *   Niveles (puntaje acumulado):
 *     ≥ 4  → 4 crítico · ≥ 2  → 3 alto
 *     ≥ 1  → 2 medio   · > 0  → 1 bajo   · 0 → oculto
 */
const getRiskLevel = (tasks) => {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const active = tasks.filter(
    (t) => t.status !== 'Completada' && t.dueDate && t.dueDate !== 'Sin fecha'
  );
  if (!active.length) return 0;

  let score = 0;

  active.forEach((task) => {
    const [y, m, d] = task.dueDate.split('-').map(Number);
    const daysLeft  = Math.floor((new Date(y, m - 1, d) - today) / 86400000);

    if      (daysLeft < 0)   score += 4;
    else if (daysLeft === 0) score += 3;
    else if (daysLeft === 1) score += 2;
    else if (daysLeft <= 3)  score += 1;
    else if (daysLeft <= 7)  score += 0.5;
    else if (daysLeft <= 14) score += 0.2;
  });

  if (score >= 3) return 4;  // vencida (4) o vence hoy (3) → crítico
  if (score >= 2) return 3;  // vence mañana, o 2 tareas en 2-3 días → alto
  if (score >= 1) return 2;  // vence en 2-3 días, o varias en la semana → medio
  if (score >  0) return 1;  // alguna tarea en ≤14 días → bajo
  return 0;
};

export default function GroupsScreen({ navigation, route }) {
  const { user, userProfile } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useAccessibility();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState([]);
  const [groupTasks, setGroupTasks] = useState({});
  const [invitations, setInvitations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [filterOpen, setFilterOpen] = useState(false);

  const flatListRef = useRef(null);
  const [highlightInvitationId, setHighlightInvitationId] = useState(null);
  // Almacena la función closeRow de la fila que está abierta en este momento.
  // Cuando una nueva fila se abre, cerramos la anterior automáticamente.
  const openRowCloseRef = useRef(null);

  const handleRowOpen = useCallback((closeFn) => {
    if (openRowCloseRef.current && openRowCloseRef.current !== closeFn) {
      openRowCloseRef.current();
    }
    openRowCloseRef.current = closeFn;
  }, []);

  // Al abrir la pestaña desde una notificación de invitación: subir la lista y resaltar la fila.
  useFocusEffect(
    useCallback(() => {
      if (!route?.params?.scrollToInvitations) return undefined;
      const highlightId = route.params?.highlightInvitationId ?? null;
      let cancelled = false;
      let timer;

      const run = () => {
        if (cancelled) return;
        if (highlightId) setHighlightInvitationId(highlightId);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        navigation.setParams({
          scrollToInvitations: undefined,
          _ts: undefined,
          highlightInvitationId: undefined,
        });
      };

      const task = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        timer = setTimeout(run, 200);
      });

      return () => {
        cancelled = true;
        task.cancel?.();
        if (timer) clearTimeout(timer);
      };
    }, [
      navigation,
      route?.params?.scrollToInvitations,
      route?.params?._ts,
      route?.params?.highlightInvitationId,
    ]),
  );

  useEffect(() => {
    if (!highlightInvitationId) return undefined;
    const t = setTimeout(() => setHighlightInvitationId(null), 3500);
    return () => clearTimeout(t);
  }, [highlightInvitationId]);

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
      // acceptInvitation hace el batch write Y retorna el objeto del grupo
      // construido desde el snapshot guardado en la invitación, sin necesitar
      // una lectura adicional al documento de grupo (evita posibles errores de
      // reglas de seguridad antes de que el listener onSnapshot se re-evalúe).
      const groupData = await acceptInvitation(invitation.id, invitation.groupId, user.uid);

      // Mostrar el grupo de inmediato sin esperar al listener de Firestore.
      // (El listener también actualizará eventualmente con los datos completos.)
      if (groupData) {
        setGroups((prev) =>
          prev.find((g) => g.id === invitation.groupId)
            ? prev
            : [groupData, ...prev],
        );
        // Si había un filtro activo, resetearlo para que el grupo recién unido sea visible.
        setStatusFilter('Todas');
      }
    } catch (e) {
      console.error('[handleAcceptInvitation]', e);
      Alert.alert("Error", e.message || "No se pudo aceptar la invitación");
    }
  };

  const handleDeclineInvitation = async (invitationId) => {
    try {
      await declineInvitation(invitationId);
    } catch (e) {
      Alert.alert("Error", "No se pudo rechazar la invitación");
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

      const currentIds = new Set(fetchedGroups.map((g) => g.id));

      // Limpiar listeners de grupos que ya no están
      for (const [groupId, unsub] of taskUnsubs.entries()) {
        if (!currentIds.has(groupId)) {
          unsub();
          taskUnsubs.delete(groupId);
          setGroupTasks((prev) => {
            const next = { ...prev };
            delete next[groupId];
            return next;
          });
        }
      }

      // CASCADA NIVEL 2: Para cada grupo nuevo → escuchar sus tareas
      fetchedGroups.forEach((group) => {
        if (!taskUnsubs.has(group.id)) {
          const unsubTasks = firestoreService.getGroupTasks(
            group.id,
            (tasks) => {
              setGroupTasks((prev) => ({
                ...prev,
                [group.id]: tasks,
              }));
            },
          );
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

  // Mismo criterio que getMyGroups (ms + desempate por id); useMemo evita reordenar en cada render.
  const sortedGroups = useMemo(
    () => sortGroupsForUser(groups, user?.uid),
    [groups, user?.uid],
  );

  // Helper: estado derivado de las tareas de un grupo
  const getGroupStatus = (groupId) => {
    const tasks = groupTasks[groupId] || [];
    if (tasks.length === 0) return 'sin_tareas';
    const pending = tasks.filter((t) => t.status === 'Pendiente' || t.status === 'En progreso').length;
    return pending > 0 ? 'pendiente' : 'al_dia';
  };

  const STATUS_FILTERS = useMemo(
    () => [
      { key: 'Todas', label: t('all') },
      { key: 'pendiente', label: t('groupsFilterWithPending') },
      { key: 'al_dia', label: t('workUpToDate') },
      { key: 'sin_tareas', label: t('workNotStarted') },
    ],
    [t],
  );

  const filteredGroups = sortedGroups.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.desc && g.desc.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'Todas' || getGroupStatus(g.id) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDeleteGroup = (group) => {
    Alert.alert(
      t('confirm') || 'Confirmar',
      `¿Estás seguro de que deseas eliminar el grupo "${group.name}"? Se borrarán todos los mensajes, tareas y archivos.`,
      [
        { text: t('cancel') || 'Cancelar', style: 'cancel' },
        {
          text: t('delete') || 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await firestoreService.deleteGroup(group.id);
            } catch (e) {
              Alert.alert('Error', 'No se pudo eliminar el grupo');
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = (group) => {
    Alert.alert(
      t('confirm') || 'Confirmar',
      `¿Deseas salir del grupo "${group.name}"?`,
      [
        { text: t('cancel') || 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            try {
              await firestoreService.leaveGroup(group.id, user.uid);
            } catch (e) {
              Alert.alert('Error', 'No se pudo salir del grupo');
            }
          },
        },
      ]
    );
  };

  const renderGroupCard = ({ item: group }) => {
    const tasks = groupTasks[group.id] || [];
    const pendingTasks = tasks.filter(
      (t) => t.status === "Pendiente" || t.status === "En progreso",
    );
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (t) => t.status === "Completada",
    ).length;
    const progressPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const isLeader = group.leaderId === user?.uid;
    const isPro = (userProfile?.plan || "free") === "personal";
    const leaderHasPersonal =
      (group.leaderPlan || "free") === "personal";
    // Barra: tareas de este grupo; visible si tú tienes Personal o el líder de este grupo (no cruza datos con otros grupos).
    const showProgressBar =
      totalTasks > 0 && (isPro || leaderHasPersonal);
    // Riesgo: solo líder suscrito (tu plan).
    const riskLevel = isLeader && isPro ? getRiskLevel(tasks) : 0;
    const riskPal = riskLevel > 0 ? RISK_PALETTE[riskLevel - 1] : null;

    const swipeActions = [
      {
        icon: <MessageSquare color="#FFFFFF" size={22} />,
        label: 'Chat',
        bgColor: '#4F46E5',
        onPress: () =>
          navigation.navigate("Chat", {
            groupId: group.id,
            groupName: group.name,
            groupPhotoURL: group.photoURL,
          }),
      },
      isLeader
        ? {
            icon: <Trash2 color="#FFFFFF" size={22} />,
            label: t('delete') || 'Eliminar',
            bgColor: '#312E81',
            onPress: () => handleDeleteGroup(group),
          }
        : {
            icon: <LogOut color="#FFFFFF" size={22} />,
            label: 'Salir',
            bgColor: '#7C3AED',
            onPress: () => handleLeaveGroup(group),
          },
    ];

    return (
      <SwipeableRow actions={swipeActions} onOpen={handleRowOpen}>
        <TouchableOpacity
          style={[
            styles.groupCard,
            { backgroundColor: theme.card, borderColor: theme.border },
            isLeader && styles.groupCardLeader,
          ]}
          onPress={() => {
            openRowCloseRef.current?.();
            openRowCloseRef.current = null;
            navigation.navigate("GroupDetails", { groupId: group.id });
          }}
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Grupo: ${group.name}`}
          accessibilityHint="Doble toque para ver el detalle del grupo. Desliza a la izquierda para más opciones"
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardContent}>
              <View style={styles.groupNameRow}>
                {isLeader && (
                  <Crown size={13} color="#4F46E5" strokeWidth={2.2} />
                )}
                <Text
                  style={[styles.groupName, { color: theme.text }, isLeader && { color: theme.dark ? '#A5B4FC' : '#3730A3' }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {group.name}
                </Text>
              </View>
              <Text style={[styles.groupDesc, { color: theme.textSecondary }]} numberOfLines={2} ellipsizeMode="tail">{group.desc}</Text>

              <View style={styles.badgeContainer}>
                {pendingTasks.length > 0 ? (
                  <View style={styles.pendingBadge}>
                    <Clock color="#D97706" size={12} />
                    <Text style={styles.pendingText}>
                      {`${pendingTasks.length} ${t('pendingTasksBadge')}`}
                    </Text>
                  </View>
                ) : totalTasks === 0 ? (
                  <View style={styles.notStartedBadge}>
                    <Clock color="#6B7280" size={12} />
                    <Text style={styles.notStartedText}>{t('workNotStarted')}</Text>
                  </View>
                ) : (
                  <View style={styles.completedBadge}>
                    <CheckSquare color="#16A34A" size={12} />
                    <Text style={styles.completedText}>{t('workUpToDate')}</Text>
                  </View>
                )}
              </View>
            </View>

            <GroupAvatar
              photoURL={group.photoURL}
              name={group.name}
              size={44}
              borderRadius={12}
            />
          </View>

          {showProgressBar && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: theme.textSecondary }]} numberOfLines={1}>{t('workProgress')}</Text>
                <View style={styles.progressHeaderRight}>
                  {riskLevel > 0 && (
                    <View style={[
                      styles.riskBadge,
                      riskLevel === 4
                        ? { backgroundColor: riskPal.bar, borderColor: riskPal.bar }
                        : {
                            backgroundColor: theme.dark ? riskPal.darkBg  : riskPal.lightBg,
                            borderColor:     theme.dark ? riskPal.darkBorder : riskPal.lightBorder,
                          },
                    ]}>
                      <AlertTriangle
                        color={riskLevel === 4 ? '#FFF' : riskPal.bar}
                        size={13 + riskLevel}
                        strokeWidth={2.2}
                      />
                    </View>
                  )}
                  <Text style={[styles.progressValue, { color: theme.text }, progressPercentage === 100 && { color: '#16A34A' }]} numberOfLines={1}>
                    {progressPercentage}% ({completedTasks}/{totalTasks})
                  </Text>
                </View>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${progressPercentage}%`,
                      backgroundColor: progressPercentage === 100 ? '#16A34A' : '#4F46E5',
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerTitle}>StudySync</Text>
          <Text style={styles.headerSubtitle}>{t('workspaceSubtitle')}</Text>
        </View>
      </View>

      {/* Search + Filter */}
      <View style={[styles.searchContainer, { backgroundColor: theme.bg }]}>
        <View style={styles.searchRow}>
          <View style={[styles.searchInputWrapper, { backgroundColor: theme.input, borderColor: theme.inputBorder, flex: 1 }]}>
            <Search color={theme.textMuted} size={16} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder={t('searchGroup')}
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              accessibilityLabel="Buscar grupo"
              accessibilityHint="Escribe el nombre del grupo que buscas"
            />
          </View>
          <TouchableOpacity
            style={[
              styles.filterBtn,
              { backgroundColor: statusFilter !== 'Todas' ? '#4F46E5' : theme.input, borderColor: statusFilter !== 'Todas' ? '#4F46E5' : theme.inputBorder },
            ]}
            onPress={() => setFilterOpen(true)}
            activeOpacity={0.75}
            accessibilityLabel="Filtrar grupos"
          >
            <SlidersHorizontal color={statusFilter !== 'Todas' ? '#FFF' : theme.textMuted} size={18} />
          </TouchableOpacity>
        </View>

        {/* Chip activo cuando hay filtro */}
        {statusFilter !== 'Todas' && (
          <View style={styles.activeFilterRow}>
            <View style={[styles.activeChip, { backgroundColor: '#EEF2FF', borderColor: '#A5B4FC' }]}>
              <Text style={styles.activeChipText}>
                {STATUS_FILTERS.find((f) => f.key === statusFilter)?.label}
              </Text>
              <TouchableOpacity onPress={() => setStatusFilter('Todas')} hitSlop={8}>
                <X color="#4F46E5" size={13} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Filter Modal */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setFilterOpen(false)}>
          <Pressable style={[styles.filterSheet, { backgroundColor: theme.card, paddingBottom: Math.max(16, insets.bottom) }]} onPress={() => {}}>
            <Text style={[styles.filterSheetTitle, { color: theme.text }]}>{t('filterByGroupStatus')}</Text>
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterOption, active && { backgroundColor: '#EEF2FF' }]}
                  onPress={() => { setStatusFilter(f.key); setFilterOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterOptionText, { color: active ? '#4F46E5' : theme.text }, active && { fontWeight: '700' }]}>
                    {f.label}
                  </Text>
                  {active && <Check color="#4F46E5" size={16} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Groups List */}
      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#4F46E5" size="large" />
        </View>
      ) : <FlatList
        ref={flatListRef}
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupCard}
        extraData={groupTasks}
        contentContainerStyle={[
          styles.listContainer,
          {
            flexGrow: 1,
            paddingBottom: Math.max(
              styles.listContainer.paddingBottom,
              insets.bottom + 100,
            ),
          },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          invitations.length > 0 ? (
            <View style={[
                styles.invitationsSection,
                isDark && { backgroundColor: 'rgba(79,70,229,0.15)', borderColor: '#4338CA' },
              ]}>
              <View style={styles.invitationsHeader}>
                <Mail color="#4F46E5" size={16} />
                <Text style={[styles.invitationsTitle, { color: theme.text }]}>
                  {t('pendingInvitations')} ({invitations.length})
                </Text>
              </View>
              {invitations.map((inv) => (
                <View
                  key={inv.id}
                  style={[
                    styles.invitationCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    highlightInvitationId === inv.id && {
                      borderWidth: 2,
                      borderColor: '#4F46E5',
                      shadowColor: '#4F46E5',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.35,
                      shadowRadius: 6,
                      elevation: 4,
                    },
                  ]}
                >
                  <View style={styles.invitationContent}>
                    <Text style={[styles.invitationGroupName, { color: theme.text }]}>
                      {inv.groupName}
                    </Text>
                    <Text style={[styles.invitationText, { color: theme.textMuted }]}>
                      {t('invitationInviteLine', { who: inv.invitedByName || t('someoneInvited') })}
                    </Text>
                  </View>
                  <View style={styles.invitationActions}>
                    <TouchableOpacity
                      style={[
                        styles.invitationBtn,
                        styles.declineBtn,
                        isDark && { backgroundColor: 'rgba(220,38,38,0.18)', borderColor: 'rgba(220,38,38,0.45)' },
                      ]}
                      onPress={() => handleDeclineInvitation(inv.id)}
                      activeOpacity={0.7}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Rechazar invitación a ${inv.groupName}`}
                      accessibilityHint="Doble toque para rechazar"
                    >
                      <X color="#DC2626" size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.invitationBtn, styles.acceptBtn]}
                      onPress={() => handleAcceptInvitation(inv)}
                      activeOpacity={0.7}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Aceptar invitación a ${inv.groupName}`}
                      accessibilityHint="Doble toque para aceptar y unirte al grupo"
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
            <View style={styles.emptyState}>
              <Users color={theme.textMuted} size={52} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {searchQuery ? 'Sin resultados' : 'Sin grupos'}
              </Text>
              <Text style={[styles.emptyHint, { color: theme.textMuted }]}>
                {searchQuery
                  ? `No se encontraron grupos para "${searchQuery}".`
                  : 'Crea un grupo de estudio o acepta una invitación para comenzar.'}
              </Text>
            </View>
          )
        }
      />}

      {/* FAB - Create Group */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          const isFree = (userProfile?.plan || 'free') === 'free';
          // Solo grupos que tú creas (líder): unirte por invitación no cuenta para el límite de 3.
          const activeLedGroupsCount = groups.filter(
            (g) =>
              g.status !== 'Completada' && g.leaderId === user?.uid,
          ).length;
          if (isFree && activeLedGroupsCount >= 3) {
            Alert.alert(
              t('limitReachedTitle'),
              t('freePlanMaxActiveGroupsMessage'),
              [{ text: t('understood'), style: 'cancel' }],
            );
            return;
          }
          navigation.navigate("CreateGroup");
        }}
        activeOpacity={0.8}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Crear nuevo grupo"
        accessibilityHint="Doble toque para crear un grupo de estudio"
      >
        <Plus color="#FFFFFF" size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    position: "relative",
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#C7D2FE",
    marginTop: 2,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 12,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
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
    color: "#1F2937",
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activeFilterRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  activeChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4F46E5",
  },
  // Filter modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  filterSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 4,
  },
  filterSheetTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  filterOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  filterOptionText: {
    fontSize: 14,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
    gap: 10,
  },
  groupCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  // Cuando el usuario es líder del grupo — borde top con acento indigo
  groupCardLeader: {
    borderTopWidth: 2,
    borderTopColor: '#4F46E5',
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    flex: 1,
  },
  groupDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  badgeContainer: {
    marginTop: 12,
    flexDirection: "row",
  },
  groupNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusInProgress: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#A5B4FC",
  },
  statusDone: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  statusInProgressText: {
    color: "#4338CA",
  },
  statusDoneText: {
    color: "#16A34A",
  },
  notStartedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  notStartedText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#6B7280",
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#D97706",
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  completedText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#16A34A",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4F46E5",
  },
  progressSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4B5563",
    flex: 1,
  },
  progressValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4F46E5",
  },
  progressBarBg: {
    width: "100%",
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: "#4F46E5",
    borderRadius: 3,
  },
  invitationsSection: {
    marginBottom: 16,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 12,
    padding: 12,
  },
  invitationsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  invitationsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4F46E5",
  },
  invitationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E0E7FF",
  },
  invitationContent: {
    flex: 1,
    marginRight: 8,
  },
  invitationGroupName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  invitationText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  invitationActions: {
    flexDirection: "row",
    gap: 8,
  },
  invitationBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptBtn: {
    backgroundColor: "#16A34A",
  },
  declineBtn: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  // Columna derecha del card (solo avatar)
  cardRight: {
    alignItems: 'center',
  },
  // Lado derecho del encabezado de progreso: icono de riesgo + porcentaje
  progressHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  // Indicador de riesgo — triángulo de advertencia
  riskBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyHint:  { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4F46E5",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
