// TASK INBOX SCREEN - StudySync
// Muestra todas las tareas asignadas al usuario actual
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import Text from "../../components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { headerPaddingTop } from "../../utils/headerInsets";
import {
  CheckCircle2,
  Clock,
  Circle,
  Calendar,
  ChevronDown,
} from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAccessibility } from "../../contexts/AccessibilityContext";
import {
  getMyAssignedTasks,
  updateTaskStatus,
  getGroup,
} from "../../services/firestoreService";

/** Valores de estado en Firestore (no traducir al guardar) */
const FILTER_ALL = "__ALL__";
const S_PENDING = "Pendiente";
const S_PROGRESS = "En progreso";
const S_DONE = "Completada";
const TAB_ORDER = [FILTER_ALL, S_PENDING, S_PROGRESS, S_DONE];

function taskStatusLabel(status, t) {
  if (status === S_DONE) return t("completed");
  if (status === S_PROGRESS) return t("inProgress");
  if (status === S_PENDING) return t("pending");
  return status;
}

const STATUS_COLORS = {
  Pendiente: { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  "En progreso": { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD" },
  Completada: { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
};

const STATUS_DARK = {
  Pendiente: { bg: "#422006", text: "#FCD34D", border: "#92400E" },
  "En progreso": { bg: "#1E3A5F", text: "#93C5FD", border: "#1E40AF" },
  Completada: { bg: "#064E3B", text: "#6EE7B7", border: "#065F46" },
};

function StatusIcon({ status, size = 18 }) {
  if (status === S_DONE)
    return <CheckCircle2 color="#10B981" size={size} />;
  if (status === S_PROGRESS) return <Clock color="#3B82F6" size={size} />;
  return <Circle color="#F59E0B" size={size} />;
}

function TaskCard({
  task,
  groupName,
  onChangeStatus,
  theme,
  isDark,
  highlight,
  t,
}) {
  const colors = isDark ? STATUS_DARK : STATUS_COLORS;
  const sc = colors[task.status] || colors[S_PENDING];

  const isOverdue =
    task.status !== S_DONE &&
    task.dueDate &&
    task.dueDate !== "Sin fecha" &&
    new Date(task.dueDate) < new Date(new Date().toDateString());

  const formatDate = (iso) => {
    if (!iso || iso === "Sin fecha") return null;
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <TouchableOpacity
      style={[
        s.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        highlight && { borderColor: "#4F46E5", borderWidth: 2 },
      ]}
      onPress={() => onChangeStatus(task)}
      activeOpacity={0.75}
    >
      <View style={s.cardTop}>
        <StatusIcon status={task.status} />
        <View style={s.cardBody}>
          <Text
            style={[
              s.taskTitle,
              { color: theme.text },
              task.status === S_DONE && s.taskTitleDone,
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
          <Text style={[s.groupName, { color: theme.textMuted }]}>
            {groupName}
          </Text>
        </View>
        <View
          style={[
            s.statusPill,
            { backgroundColor: sc.bg, borderColor: sc.border },
          ]}
        >
          <Text style={[s.statusText, { color: sc.text }]}>
            {taskStatusLabel(task.status, t)}
          </Text>
          <ChevronDown color={sc.text} size={12} />
        </View>
      </View>
      {task.description ? (
        <Text
          style={[s.desc, { color: theme.textSecondary }]}
          numberOfLines={2}
        >
          {task.description}
        </Text>
      ) : null}
      {formatDate(task.dueDate) ? (
        <View style={s.dateRow}>
          <Calendar size={12} color={isOverdue ? "#EF4444" : theme.textMuted} />
          <Text
            style={[
              s.dateText,
              { color: isOverdue ? "#EF4444" : theme.textMuted },
              isOverdue && s.overdue,
            ]}
          >
            {formatDate(task.dueDate)}
            {isOverdue ? `  ${t("overdue")}` : ""}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function TaskInboxScreen({ route, navigation }) {
  const { user, userProfile } = useAuth();
  const { theme } = useTheme();
  const { t } = useAccessibility();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  const highlightTaskId = route?.params?.taskId || null;
  const highlightTs = route?.params?._ts || null;
  const [highlightId, setHighlightId] = useState(null);
  // Evita que actualizaciones de Firestore (filtered.length) re-disparen el efecto
  const processedTsRef = useRef(null);

  // Auto-limpiar outline a los 3 s (cubre cualquier cambio de tab/pantalla)
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightId]);

  const [tasks, setTasks] = useState([]);
  const [groupNames, setGroupNames] = useState({});
  const [filter, setFilter] = useState(FILTER_ALL);
  const [loading, setLoading] = useState(true);

  // Fetch group names for task cards (cache by groupId)
  const fetchGroupName = useCallback(
    async (groupId) => {
      if (groupNames[groupId]) return;
      const group = await getGroup(groupId);
      if (group) {
        setGroupNames((prev) => ({ ...prev, [groupId]: group.name }));
      }
    },
    [groupNames],
  );

  useEffect(() => {
    if (!user) return;
    const unsub = getMyAssignedTasks(user.uid, (rawTasks) => {
      setTasks(rawTasks);
      setLoading(false);
      // Fetch group names for any new groupIds
      const seen = new Set();
      rawTasks.forEach((t) => {
        if (t.groupId && !seen.has(t.groupId)) {
          seen.add(t.groupId);
          fetchGroupName(t.groupId);
        }
      });
    });
    return () => unsub();
  }, [user]);

  const handleChangeStatus = (task) => {
    const nextStatuses = [S_PENDING, S_PROGRESS, S_DONE].filter(
      (s) => s !== task.status,
    );
    const optionLabels = nextStatuses.map((st) => taskStatusLabel(st, t));
    const meta = {
      groupId: task.groupId,
      taskId: task.id,
      title: task.title,
      assigneeId: task.assigneeId,
      assigneeName:
        userProfile?.name || user?.displayName || user?.email || t("user"),
    };
    const doUpdate = (st) =>
      updateTaskStatus(task.id, st, meta).catch(() =>
        Alert.alert(t("error"), t("taskUpdateFailed")),
      );
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...optionLabels, t("cancel")],
          cancelButtonIndex: nextStatuses.length,
          title: t("changeTaskStatus"),
        },
        (idx) => {
          if (idx < nextStatuses.length) doUpdate(nextStatuses[idx]);
        },
      );
    } else {
      Alert.alert(t("changeTaskStatus"), task.title, [
        ...nextStatuses.map((st) => ({
          text: taskStatusLabel(st, t),
          onPress: () => doUpdate(st),
        })),
        { text: t("cancel"), style: "cancel" },
      ]);
    }
  };

  const statusOrder = {
    [S_PENDING]: 0,
    [S_PROGRESS]: 1,
    [S_DONE]: 2,
  };
  const filtered =
    filter === FILTER_ALL
      ? [...tasks].sort((a, b) => {
          return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
        })
      : tasks.filter((x) => x.status === filter);

  // Scroll + outline al llegar desde notificación.
  // processedTsRef evita que actualizaciones de Firestore re-disparen el efecto.
  useEffect(() => {
    if (!highlightTaskId || !highlightTs || loading) return;
    if (processedTsRef.current === highlightTs) return; // ya procesado

    // Si hay un filtro activo que podría ocultar la tarea, volver a 'Todas'
    // El cambio de filter provoca otro render y el efecto vuelve a correr con la lista completa
    if (filter !== FILTER_ALL) {
      setFilter(FILTER_ALL);
      return;
    }

    if (!filtered.length) return;
    processedTsRef.current = highlightTs;

    // Limpiar params para evitar re-disparo tras re-montar (e.g. restauración de estado)
    navigation.setParams({ taskId: undefined, _ts: undefined });

    setHighlightId(highlightTaskId);
    const idx = filtered.findIndex((t) => t.id === highlightTaskId);
    if (idx >= 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: idx,
          animated: true,
          viewPosition: 0.3,
        });
      }, 300);
    }
  }, [highlightTaskId, highlightTs, loading, filtered.length, filter]);

  const pendingCount = tasks.filter(
    (x) => x.status === S_PENDING || x.status === S_PROGRESS,
  ).length;

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View
        style={[
          s.header,
          {
            backgroundColor: theme.dark ? "#312E81" : "#4F46E5",
            paddingTop: headerPaddingTop(insets, 12),
          },
        ]}
      >
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>{t("myTasks")}</Text>
          {pendingCount > 0 && (
            <View style={s.headerBadge}>
              <Text style={s.headerBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <Text style={s.headerSub}>
          {tasks.length === 0
            ? t("taskInboxNone")
            : tasks.length === 1
              ? t("taskInboxOne")
              : t("taskInboxMany", { n: tasks.length })}
        </Text>
      </View>

      {/* Filter tabs — AppText: respeta escala de texto, fuente dislexia y
          narrador (onTouchStart pasivo, no roba el responder del TouchableOpacity).
          adjustsFontSizeToFit permite crecer con accesibilidad y ajustarse al
          ancho del tab sin desbordar. View normal (no ScrollView) para que los
          taps en Android se registren correctamente. */}
      <View
        style={[
          s.tabsWrapper,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabsRow}
          bounces={false}
        >
          {TAB_ORDER.map((st) => {
            const active = filter === st;
            const count =
              st === FILTER_ALL
                ? tasks.length
                : tasks.filter((x) => x.status === st).length;
            const tabLabel =
              st === FILTER_ALL ? t("all") : taskStatusLabel(st, t);
            return (
              <TouchableOpacity
                key={st}
                style={[s.tab, active && s.tabActive]}
                onPress={() => setFilter(st)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    s.tabText,
                    { color: active ? "#4F46E5" : theme.textMuted },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {tabLabel}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      s.tabBadge,
                      {
                        backgroundColor: active
                          ? "#4F46E5"
                          : theme.dark
                            ? "#374151"
                            : "#E5E7EB",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.tabBadgeText,
                        { color: active ? "#FFF" : theme.textSecondary },
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#4F46E5" size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <CheckCircle2 color={theme.textMuted} size={48} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>
            {filter === FILTER_ALL
              ? t("taskInboxEmpty")
              : t("taskInboxEmptyFiltered", {
                  status: taskStatusLabel(filter, t),
                })}
          </Text>
          <Text style={[s.emptyHint, { color: theme.textMuted }]}>
            {filter === FILTER_ALL
              ? t("taskInboxEmptyHintAll")
              : t("taskInboxEmptyHintFilter")}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            s.list,
            { paddingBottom: insets.bottom + 16 },
          ]}
          onScrollToIndexFailed={() => {}}
          onScrollBeginDrag={() => setHighlightId(null)}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              groupName={groupNames[item.groupId] || "..."}
              onChangeStatus={(taskRow) => {
                setHighlightId(null);
                handleChangeStatus(taskRow);
              }}
              theme={theme}
              isDark={theme.dark}
              highlight={item.id === highlightId}
              t={t}
            />
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#FFF" },
  headerBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  headerBadgeText: { color: "#FFF", fontWeight: "700", fontSize: 12 },
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 2 },
  tabsWrapper: {
    borderBottomWidth: 1,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  tab: {
    minWidth: 84,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: "#4F46E5" },
  tabText: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  tabBadge: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
  },
  tabBadgeText: { fontSize: 10, fontWeight: "700" },
  list: { padding: 16, gap: 12 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardBody: { flex: 1, gap: 2 },
  taskTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    lineHeight: 20,
  },
  taskTitleDone: { textDecorationLine: "line-through", opacity: 0.6 },
  groupName: { fontSize: 12 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
  desc: { fontSize: 13, lineHeight: 18 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateText: { fontSize: 12 },
  overdue: { fontWeight: "600" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  emptyHint: { fontSize: 13, textAlign: "center", lineHeight: 20 },
});
