// ============================================
// GROUP DETAILS SCREEN - StudySync
// Migración de líneas 682-883 del frontend React
// Tabs: Tareas, Archivos, Miembros
// ============================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
  StatusBar,
  Modal,
  Linking,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Text from "../../components/AppText";
import AppButton from "../../components/AppButton";
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
  Download,
  Trash2,
  Award,
  Flag,
  CalendarDays,
  Activity,
  Shield,
  ShieldOff,
  UserMinus,
} from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useFileStorage } from "../../contexts/FileStorageContext";
import * as firestoreService from "../../services/firestoreService";
import { listenGroup } from "../../services/firestoreService";
import TaskItem from "../../components/TaskItem";
import EmptyState from "../../components/EmptyState";
import GroupAvatar from "../../components/GroupAvatar";
import { initialsFromDisplayName } from "../../utils/avatarInitials";

// ─── FileCard con efecto flash al llegar desde notificación ───────────────────
// Los botones de acción se posicionan de forma ABSOLUTA en el lado derecho.
// Esto garantiza visibilidad en todos los dispositivos sin importar el motor
// de layout (Yoga) o el tamaño del nombre del archivo.
function FileCard({
  file,
  theme,
  isDark,
  highlight,
  t,
  formatUploadDate,
  onOpen,
  onDelete,
}) {
  const ext = (file.fileName?.split(".").pop()?.toUpperCase() || "FILE").slice(
    0,
    4,
  );
  // Descarga + eliminar (cualquier miembro del grupo): 36 + 6 gap + 36 + 12 + 8 = 98 px
  const rightPadding = 98;

  return (
    <TouchableOpacity
      style={[
        styles.fileCard,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          paddingRight: rightPadding,
        },
        highlight && { borderColor: "#4F46E5", borderWidth: 2 },
      ]}
      onPress={() => onOpen(file)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={t("fileOpenA11yLabel", { name: file.fileName })}
      accessibilityHint={t("fileOpenA11yHint")}
    >
      {/* Información — ocupa todo el ancho restante sin competir con los botones */}
      <View style={styles.fileInfo}>
        <View style={styles.fileIcon}>
          <Text style={styles.fileIconText}>{ext}</Text>
        </View>
        <View style={styles.fileTextBlock}>
          <Text
            style={[styles.fileName, { color: theme.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {file.fileName}
          </Text>
          <Text
            style={[styles.fileDate, { color: theme.textMuted }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {file.uploadedByName || file.uploadedBy}
          </Text>
          <Text style={[styles.fileDate, { color: theme.textMuted }]}>
            {formatUploadDate(file.uploadedAt)}
          </Text>
        </View>
      </View>

      {/* Botones absolutamente posicionados — position:'absolute' los saca del flujo flex,
          garantizando visibilidad en todos los dispositivos sin importar Yoga */}
      <View style={styles.fileActions}>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            onOpen(file);
          }}
          style={[
            styles.actionButton,
            { backgroundColor: theme.dark ? "#312E81" : "#EEF2FF" },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("fileDownloadA11yLabel", { name: file.fileName })}
        >
          <Download color="#4F46E5" size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            onDelete(file);
          }}
          style={[styles.actionButton, { backgroundColor: "#FEE2E2" }]}
          accessibilityRole="button"
          accessibilityLabel={t("fileDeleteA11yLabel", { name: file.fileName })}
        >
          <Trash2 color="#DC2626" size={16} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
// ──────────────────────────────────────────────────────────────────────────────

// ── Panel de líder ────────────────────────────────────────────────────────────
// Componente exclusivo para el líder: progreso general, tareas críticas,
// ranking de miembros y actividad reciente.
// Tiempo relativo a partir de un ISO string (usa claves de traducción)
function fmtRelative(iso, tr) {
  if (!iso) return "";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return tr("leaderTimeJustNow");
    if (m < 60) return tr("timeAgoMinutes", { n: m });
    if (h < 24) return tr("timeAgoHours", { n: h });
    if (d === 1) return tr("yesterday");
    if (d < 7) return tr("timeAgoDays", { n: d });
    return tr("leaderTimeWeeks", { n: Math.floor(d / 7) });
  } catch {
    return "";
  }
}

function mapFirestoreTaskStatus(status, tr) {
  if (status === "Completada") return tr("completed");
  if (status === "En progreso") return tr("inProgress");
  if (status === "Pendiente") return tr("pending");
  return status || "";
}

function LeaderPanel({
  tasks,
  members,
  group,
  theme,
  isDark,
  insets,
  getMemberName,
}) {
  const { t } = useAccessibility();
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isOverdue = (t) => {
    if (t.status === "Completada" || !t.dueDate || t.dueDate === "Sin fecha")
      return false;
    const [y, m, d] = t.dueDate.split("-").map(Number);
    return new Date(y, m - 1, d) < todayDate;
  };
  const getDaysLeft = (t) => {
    const [y, m, d] = t.dueDate.split("-").map(Number);
    return Math.floor((new Date(y, m - 1, d) - todayDate) / 86400000);
  };

  // ── Estadísticas generales ─────────────────────────────────────────────────
  const totalT = tasks.length;
  const completedT = tasks.filter((t) => t.status === "Completada").length;
  const inProgT = tasks.filter((t) => t.status === "En progreso").length;
  const pendingT = tasks.filter((t) => t.status === "Pendiente").length;
  const overdueList = tasks.filter(isOverdue);
  const rate = totalT > 0 ? Math.round((completedT / totalT) * 100) : 0;
  const barColor = rate === 100 ? "#16A34A" : "#4F46E5";

  const atRiskList = tasks.filter((t) => {
    if (t.status === "Completada" || !t.dueDate || t.dueDate === "Sin fecha")
      return false;
    const dl = getDaysLeft(t);
    return dl >= 0 && dl <= 3;
  });

  // Tareas urgentes ordenadas por urgencia (vencidas → hoy → mañana → 3d)
  const urgentTasks = [
    ...overdueList.map((t) => ({ ...t, _dl: -1 })),
    ...atRiskList.map((t) => ({ ...t, _dl: getDaysLeft(t) })),
  ].sort((a, b) => a._dl - b._dl);

  // ── Ranking de miembros ────────────────────────────────────────────────────
  const memberStats = members
    .map((m) => {
      const assigned = tasks.filter((t) => t.assigneeId === m.id);
      const completed = assigned.filter((t) => t.status === "Completada");
      const overdue = assigned.filter(isOverdue);
      const pct =
        assigned.length > 0
          ? Math.round((completed.length / assigned.length) * 100)
          : null;
      return {
        ...m,
        assignedCount: assigned.length,
        completedCount: completed.length,
        overdueCount: overdue.length,
        pct,
      };
    })
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));

  // ── Actividad reciente (derivada de updatedAt / createdAt) ─────────────────
  const activities = tasks
    .flatMap((t) => {
      const wasUpdated = t.updatedAt && t.updatedAt !== t.createdAt;
      if (wasUpdated) {
        return [
          {
            id: `u-${t.id}`,
            type: t.status === "Completada" ? "done" : "update",
            title: t.title,
            member: getMemberName(t.assigneeId),
            status: t.status,
            ts: t.updatedAt,
          },
        ];
      } else if (t.createdAt) {
        return [
          {
            id: `c-${t.id}`,
            type: "create",
            title: t.title,
            member: getMemberName(t.assigneeId),
            ts: t.createdAt,
          },
        ];
      }
      return [];
    })
    .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""))
    .slice(0, 7);

  const RANK_COLORS = [
    { bg: "#FEF3C7", icon: "#D97706" }, // 1st – gold
    { bg: "#F1F5F9", icon: "#64748B" }, // 2nd – silver
    { bg: "#FEF9EE", icon: "#B45309" }, // 3rd – bronze
  ];
  const ACT_COLOR = { done: "#16A34A", update: "#4F46E5", create: "#7C3AED" };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, paddingBottom: insets.bottom + 100 }}
    >
      {/* ══════════════════════════════════════════════════════════════════════
          HÉROE — Progreso general del grupo
          ══════════════════════════════════════════════════════════════════════ */}
      <View
        style={[
          pStyles.heroCard,
          {
            backgroundColor: theme.dark ? "#1E1B4B" : "#EEF2FF",
            borderColor: theme.dark ? "#3730A3" : "#C7D2FE",
          },
        ]}
      >
        {/* Título + círculo de porcentaje */}
        <View style={pStyles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                pStyles.heroTitle,
                { color: theme.dark ? "#C7D2FE" : "#4338CA" },
              ]}
            >
              {t("leaderGeneralProgress")}
            </Text>
            <Text
              style={[
                pStyles.heroSub,
                { color: theme.dark ? "#818CF8" : "#6366F1" },
              ]}
            >
              {t("leaderHeroProgress", {
                completed: completedT,
                total: totalT,
              })}
            </Text>
          </View>
          <View style={[pStyles.heroPctCircle, { backgroundColor: barColor }]}>
            <Text style={pStyles.heroPctNum}>
              {rate}
              <Text style={pStyles.heroPctSym}>%</Text>
            </Text>
          </View>
        </View>

        {/* Barra gruesa */}
        <View
          style={[
            pStyles.heroBarBg,
            {
              backgroundColor: theme.dark
                ? "rgba(255,255,255,0.10)"
                : "rgba(79,70,229,0.14)",
            },
          ]}
        >
          <View
            style={[
              pStyles.heroBarFill,
              { width: `${rate}%`, backgroundColor: barColor },
            ]}
          />
        </View>

        {/* Mini-pills de stats */}
        <View style={pStyles.miniRow}>
          {[
            {
              key: "c",
              lbl: t("leaderPanelPillCompleted"),
              val: completedT,
              col: "#16A34A",
              bg: theme.dark ? "rgba(22,163,74,0.18)" : "#F0FDF4",
            },
            {
              key: "p",
              lbl: t("leaderPanelPillInProgress"),
              val: inProgT,
              col: "#4F46E5",
              bg: theme.dark
                ? "rgba(79,70,229,0.18)"
                : "rgba(255,255,255,0.65)",
            },
            {
              key: "d",
              lbl: t("leaderPanelPillPending"),
              val: pendingT,
              col: "#D97706",
              bg: theme.dark ? "rgba(217,119,6,0.18)" : "#FFFBEB",
            },
            {
              key: "o",
              lbl: t("leaderPanelPillOverdue"),
              val: overdueList.length,
              col:
                overdueList.length > 0
                  ? "#DC2626"
                  : theme.dark
                    ? "#6B7280"
                    : "#9CA3AF",
              bg: theme.dark
                ? overdueList.length > 0
                  ? "rgba(220,38,38,0.18)"
                  : "rgba(255,255,255,0.04)"
                : overdueList.length > 0
                  ? "#FEF2F2"
                  : "rgba(255,255,255,0.45)",
            },
          ].map(({ key, lbl, val, col, bg }) => (
            <View key={key} style={[pStyles.miniPill, { backgroundColor: bg }]}>
              <Text style={[pStyles.miniPillNum, { color: col }]}>{val}</Text>
              <Text
                style={[
                  pStyles.miniPillLbl,
                  { color: theme.dark ? "#A5B4FC" : "#6366F1" },
                ]}
              >
                {lbl}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          TAREAS CRÍTICAS
          ══════════════════════════════════════════════════════════════════════ */}
      {urgentTasks.length > 0 && (
        <View
          style={[
            pStyles.block,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={pStyles.blockHead}>
            <Text style={[pStyles.blockTitle, { color: theme.text }]}>
              {t("leaderCriticalTasks")}
            </Text>
            <View style={[pStyles.countPill, { backgroundColor: "#FEE2E2" }]}>
              <Text style={[pStyles.countPillTxt, { color: "#DC2626" }]}>
                {urgentTasks.length}
              </Text>
            </View>
          </View>

          {urgentTasks.map((task) => {
            const isOvd = task._dl < 0;
            const isToday = task._dl === 0;
            const accent = isOvd ? "#DC2626" : isToday ? "#D97706" : "#6366F1";
            const label = isOvd
              ? t("leaderCritBadgeOverdue")
              : isToday
                ? t("leaderCritBadgeToday")
                : t("leaderCritBadgeDays", { n: task._dl });
            const rowBg = isOvd
              ? theme.dark
                ? "rgba(220,38,38,0.08)"
                : "#FEF2F2"
              : isToday
                ? theme.dark
                  ? "rgba(245,158,11,0.08)"
                  : "#FFFBEB"
                : theme.dark
                  ? "rgba(99,102,241,0.08)"
                  : "#F5F3FF";
            return (
              <View
                key={task.id}
                style={[
                  pStyles.critRow,
                  { backgroundColor: rowBg, borderLeftColor: accent },
                ]}
              >
                <View style={pStyles.critBody}>
                  <Text
                    style={[pStyles.critTitle, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {task.title}
                  </Text>
                  <Text style={[pStyles.critMeta, { color: theme.textMuted }]}>
                    {getMemberName(task.assigneeId)} ·{" "}
                    {mapFirestoreTaskStatus(task.status, t)}
                  </Text>
                </View>
                <View style={[pStyles.critBadge, { backgroundColor: accent }]}>
                  <Text style={pStyles.critBadgeTxt}>{label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          RANKING DE MIEMBROS
          ══════════════════════════════════════════════════════════════════════ */}
      <View
        style={[
          pStyles.block,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={pStyles.blockHead}>
          <Text style={[pStyles.blockTitle, { color: theme.text }]}>
            {t("leaderMemberPerformance")}
          </Text>
          <View
            style={[
              pStyles.countPill,
              { backgroundColor: theme.dark ? "#1E1B4B" : "#EEF2FF" },
            ]}
          >
            <Text style={[pStyles.countPillTxt, { color: "#4F46E5" }]}>
              {memberStats.length}
            </Text>
          </View>
        </View>

        {memberStats.length === 0 ? (
          <Text style={[pStyles.emptyTxt, { color: theme.textMuted }]}>
            {t("leaderNoMembers")}
          </Text>
        ) : (
          memberStats.map((m, idx) => {
            const hasTasks = m.assignedCount > 0;
            const mBarCol =
              m.pct === 100
                ? "#16A34A"
                : m.overdueCount > 0
                  ? "#DC2626"
                  : "#4F46E5";
            const mPctCol = !hasTasks
              ? theme.textMuted
              : m.pct === 100
                ? "#16A34A"
                : m.pct >= 50
                  ? "#4F46E5"
                  : "#DC2626";
            const rankPalette = RANK_COLORS[idx] ?? {
              bg: theme.dark ? "rgba(255,255,255,0.08)" : "#F3F4F6",
              icon: "#9CA3AF",
            };
            return (
              <View
                key={m.id}
                style={[
                  pStyles.memberCard,
                  {
                    backgroundColor: theme.dark
                      ? "rgba(255,255,255,0.04)"
                      : "#F9FAFB",
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={pStyles.memberRow}>
                  <View
                    style={[
                      pStyles.medalView,
                      { backgroundColor: rankPalette.bg },
                    ]}
                  >
                    <Award
                      color={rankPalette.icon}
                      size={17}
                      strokeWidth={2.2}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={pStyles.memberNameRow}>
                      <Text
                        style={[
                          pStyles.memberName,
                          { color: theme.text, flex: 1 },
                        ]}
                        numberOfLines={1}
                      >
                        {m.name?.split(" ").slice(0, 2).join(" ")}
                        {m.id === group.leaderId ? (
                          <Text style={{ color: "#6366F1", fontSize: 11 }}>
                            {" "}
                            ★
                          </Text>
                        ) : null}
                      </Text>
                      <Text style={[pStyles.memberPct, { color: mPctCol }]}>
                        {hasTasks ? `${m.pct}%` : "—"}
                      </Text>
                    </View>
                    <Text
                      style={[pStyles.memberSub, { color: theme.textMuted }]}
                    >
                      {hasTasks
                        ? `${t("leaderMemberProgress", {
                            done: m.completedCount,
                            total: m.assignedCount,
                          })}${
                            m.overdueCount > 0
                              ? t("leaderMemberOverdueSuffix", {
                                  n: m.overdueCount,
                                })
                              : ""
                          }`
                        : t("leaderMemberNoTasks")}
                    </Text>
                    {hasTasks && (
                      <View
                        style={[
                          pStyles.mBarBg,
                          {
                            backgroundColor: theme.dark ? "#374151" : "#E5E7EB",
                          },
                        ]}
                      >
                        <View
                          style={[
                            pStyles.mBarFill,
                            { width: `${m.pct}%`, backgroundColor: mBarCol },
                          ]}
                        />
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          ACTIVIDAD RECIENTE
          ══════════════════════════════════════════════════════════════════════ */}
      <View
        style={[
          pStyles.block,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={pStyles.blockHead}>
          <Text style={[pStyles.blockTitle, { color: theme.text }]}>
            {t("leaderRecentActivity")}
          </Text>
        </View>

        {activities.length === 0 ? (
          <Text style={[pStyles.emptyTxt, { color: theme.textMuted }]}>
            {t("leaderActivityEmpty")}
          </Text>
        ) : (
          activities.map((act, idx) => {
            const dotCol = ACT_COLOR[act.type] || "#6B7280";
            const isLast = idx === activities.length - 1;
            const verb =
              act.type === "done"
                ? t("leaderActivityDone")
                : act.type === "update"
                  ? t("leaderActivityUpdate", {
                      status: mapFirestoreTaskStatus(act.status, t),
                    })
                  : t("leaderActivityCreate");
            return (
              <View key={act.id} style={pStyles.actRow}>
                {/* Línea de tiempo */}
                <View style={pStyles.actTimeline}>
                  <View style={[pStyles.actDot, { backgroundColor: dotCol }]} />
                  {!isLast && (
                    <View
                      style={[
                        pStyles.actLine,
                        { backgroundColor: theme.dark ? "#374151" : "#E5E7EB" },
                      ]}
                    />
                  )}
                </View>
                {/* Contenido */}
                <View
                  style={[pStyles.actContent, !isLast && { paddingBottom: 16 }]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 4,
                    }}
                  >
                    <Text
                      style={[
                        pStyles.actDesc,
                        { color: theme.textMuted, flex: 1 },
                      ]}
                      numberOfLines={2}
                    >
                      <Text style={[pStyles.actBold, { color: theme.text }]}>
                        {act.member}
                      </Text>
                      {` ${verb} `}
                      <Text style={[{ fontStyle: "italic" }]}>
                        "{act.title}"
                      </Text>
                    </Text>
                    <Text style={[pStyles.actTime, { color: theme.textMuted }]}>
                      {fmtRelative(act.ts, t)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Estado vacío global */}
      {totalT === 0 && (
        <View
          style={[
            pStyles.block,
            {
              backgroundColor: theme.dark ? "#1E1B4B" : "#EEF2FF",
              borderColor: theme.dark ? "#3730A3" : "#C7D2FE",
              alignItems: "center",
              paddingVertical: 30,
            },
          ]}
        >
          <Text style={{ fontSize: 40 }}>📋</Text>
          <Text
            style={[
              pStyles.blockTitle,
              { color: theme.dark ? "#A5B4FC" : "#4338CA", marginTop: 12 },
            ]}
          >
            {t("leaderPanelEmptyTitle")}
          </Text>
          <Text
            style={[
              pStyles.emptyTxt,
              { color: theme.dark ? "#818CF8" : "#6366F1", marginTop: 4 },
            ]}
          >
            {t("leaderPanelEmptyHint")}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Estilos del panel de líder ────────────────────────────────────────────────
const pStyles = StyleSheet.create({
  // Bloques genéricos
  block: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  blockHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  countPill: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  countPillTxt: {
    fontSize: 11,
    fontWeight: "800",
  },
  emptyTxt: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    paddingVertical: 2,
  },

  // Hero card
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  heroSub: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 3,
  },
  heroPctCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  heroPctNum: {
    fontSize: 21,
    fontWeight: "900",
    color: "#FFF",
    lineHeight: 24,
    includeFontPadding: false,
  },
  heroPctSym: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  heroBarBg: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  heroBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  miniRow: {
    flexDirection: "row",
    gap: 6,
  },
  miniPill: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 2,
  },
  miniPillNum: {
    fontSize: 16,
    fontWeight: "800",
  },
  miniPillLbl: {
    fontSize: 8,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.2,
  },

  // Tareas críticas
  critRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderLeftWidth: 4,
    overflow: "hidden",
    minHeight: 54,
    // paddingRight asegura que el badge nunca quede recortado por el borderRadius
    // La barra izquierda tiene 4px, el cuerpo tiene su propio paddingLeft via critBody
    paddingRight: 10,
  },
  critBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  critTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  critMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  critBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexShrink: 0,
    minWidth: 44,
    alignItems: "center",
  },
  critBadgeTxt: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textAlign: "center",
  },

  // Ranking de miembros
  memberCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  medalView: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memberName: {
    fontSize: 13,
    fontWeight: "700",
  },
  memberSub: {
    fontSize: 11,
  },
  memberPct: {
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 6,
  },
  mBarBg: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 4,
  },
  mBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Actividad reciente
  actRow: {
    flexDirection: "row",
    gap: 12,
  },
  actTimeline: {
    alignItems: "center",
    width: 12,
    paddingTop: 4,
  },
  actDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexShrink: 0,
  },
  actLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    borderRadius: 1,
    minHeight: 12,
  },
  actContent: {
    flex: 1,
    paddingBottom: 4,
  },
  actDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  actBold: {
    fontWeight: "700",
  },
  actTime: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 0,
    marginTop: 2,
  },
});
// ─── Ordenación de tareas ─────────────────────────────────────────────────────
const PRIORITY_ORDER = { alta: 1, media: 2, baja: 3 };

const sortTasks = (arr, key) => {
  if (!key || key === "default") return arr;
  const copy = [...arr];

  if (key === "importancia") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return copy.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 4;
      const pb = PRIORITY_ORDER[b.priority] ?? 4;
      if (pa !== pb) return pa - pb;
      // Secundario: vencidas primero
      const aOv =
        a.status !== "Completada" &&
        a.dueDate &&
        a.dueDate !== "Sin fecha" &&
        new Date(a.dueDate + "T00:00:00") < today;
      const bOv =
        b.status !== "Completada" &&
        b.dueDate &&
        b.dueDate !== "Sin fecha" &&
        new Date(b.dueDate + "T00:00:00") < today;
      if (aOv !== bOv) return aOv ? -1 : 1;
      // Terciario: fecha más próxima
      const da = a.dueDate && a.dueDate !== "Sin fecha" ? a.dueDate : "9999";
      const db = b.dueDate && b.dueDate !== "Sin fecha" ? b.dueDate : "9999";
      return da.localeCompare(db);
    });
  }

  if (key === "fecha") {
    return copy.sort((a, b) => {
      const da =
        a.dueDate && a.dueDate !== "Sin fecha" ? a.dueDate : "9999-12-31";
      const db =
        b.dueDate && b.dueDate !== "Sin fecha" ? b.dueDate : "9999-12-31";
      return da.localeCompare(db);
    });
  }

  if (key === "estado") {
    const S = { Pendiente: 1, "En progreso": 2, Completada: 3 };
    return copy.sort((a, b) => (S[a.status] ?? 9) - (S[b.status] ?? 9));
  }

  return copy;
};
// ──────────────────────────────────────────────────────────────────────────────

export default function GroupDetailsScreen({ route, navigation }) {
  const {
    groupId,
    initialTab,
    highlightFileId,
    _ts: highlightTs,
  } = route.params;
  const { user, userProfile } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useAccessibility();
  const { uploadGroupFile, uploadGroupAvatar, deleteGroupFile } =
    useFileStorage();
  const insets = useSafeAreaInsets();
  const [group, setGroup] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [files, setFiles] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState(initialTab || "tareas");
  const filesListRef = useRef(null);
  const [highlightId, setHighlightId] = useState(null);
  // Ref para saber si hay un scroll pendiente al tab archivos
  const pendingScrollFileId = useRef(null);

  // Auto-limpiar outline a los 3 s
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightId]);

  const [loading, setLoading] = useState(true);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const isLeader = group?.leaderId === user?.uid;
  const isModerator =
    !isLeader && (group?.moderators || []).includes(user?.uid);
  const canManage = isLeader || isModerator;
  const isFree = (userProfile?.plan || "free") === "free";
  const getProfileName = useCallback(
    (memberLike) => (memberLike?.name || "").trim(),
    [],
  );
  /** Tab y contenido "panel": solo el líder del grupo con plan Personal (no moderadores ni otros). */
  const canAccessLeaderPanel =
    Boolean(user?.uid && group?.leaderId === user.uid) &&
    (userProfile?.plan || "free") === "personal";
  const groupLeaderIsPro = (group?.leaderPlan || "free") === "personal";
  /** Prioridad: moderador puede editar si el líder del grupo tiene Personal; el líder además necesita su propio Personal. */
  const canChangeTaskPriority =
    groupLeaderIsPro &&
    canManage &&
    (isLeader ? (userProfile?.plan || "free") === "personal" : true);

  // Sincronizar tab cuando lleguen nuevos params (p.ej. desde notificación).
  useEffect(() => {
    if (!initialTab) return;
    if (initialTab === "panel" && !canAccessLeaderPanel) {
      setActiveTab("tareas");
      return;
    }
    setActiveTab(initialTab);
  }, [initialTab, canAccessLeaderPanel]);

  useEffect(() => {
    if (activeTab === "panel" && !canAccessLeaderPanel) {
      setActiveTab("tareas");
    }
  }, [activeTab, canAccessLeaderPanel]);

  // Efecto 1: se dispara solo cuando llega una nueva navegación con highlightFileId.
  // Marca el archivo a resaltar y cambia al tab archivos si hace falta.
  // NO depende de activeTab para no volver a ejecutarse cuando el usuario cambie de tab.
  useEffect(() => {
    if (!highlightFileId) return;
    setHighlightId(highlightFileId);
    pendingScrollFileId.current = highlightFileId;
    if (activeTab !== "archivos") setActiveTab("archivos");
    // highlightTs garantiza re-ejecución aunque el fileId sea el mismo
  }, [highlightFileId, highlightTs]);

  // Efecto 2: cuando el tab archivos está activo y hay un scroll pendiente, hace el scroll.
  // No toca activeTab como dependencia de escritura, así el usuario puede cambiar de tab libremente.
  useEffect(() => {
    if (
      activeTab !== "archivos" ||
      !pendingScrollFileId.current ||
      !files.length
    )
      return;
    const fileId = pendingScrollFileId.current;
    pendingScrollFileId.current = null; // consumir para no repetir
    const idx = files.findIndex((f) => f.id === fileId);
    if (idx >= 0) {
      setTimeout(() => {
        filesListRef.current?.scrollToIndex({
          index: idx,
          animated: true,
          viewPosition: 0.3,
        });
      }, 500);
    }
  }, [activeTab, files.length]);

  useEffect(() => {
    let cancelled = false;
    // Ref para saber qué miembros ya tenemos cargados (evitar re-fetch innecesario)
    let lastMembersKey = "";

    // Timeout de seguridad: si Firestore tarda demasiado, desbloquear la pantalla igual
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 6000);

    // Escuchar grupo en tiempo real → detecta nuevos miembros al instante
    const unsubGroup = listenGroup(groupId, (groupData) => {
      if (cancelled) return;

      // Si no hay datos (doc eliminado o error), desbloquear pantalla igual
      if (!groupData) {
        setLoading(false);
        return;
      }

      setGroup(groupData);
      // Desbloquear la pantalla en cuanto llega el documento del grupo
      // Los miembros se cargan en paralelo y aparecen cuando estén listos
      setLoading(false);

      // Solo re-cargar usuarios si el array de miembros cambió
      const newKey = (groupData.members || []).slice().sort().join(",");
      if (newKey !== lastMembersKey) {
        lastMembersKey = newKey;
        // No await: el snapshot de Firestore no queda bloqueado; los miembros
        // se pintan cuando termine getUsersByIds (consultas por lotes).
        firestoreService
          .getUsersByIds(groupData.members || [])
          .then((memberData) => {
            if (!cancelled) setMembers(memberData);
          })
          .catch((e) => {
            console.error("Error cargando miembros:", e);
          });
      }
    });

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
      clearTimeout(safetyTimer);
      unsubGroup();
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
      Alert.alert(t("error"), t("enterValidEmail"));
      return;
    }
    // Límite de miembros en plan gratuito
    if (isFree && members.length >= 5) {
      Alert.alert(
        t("limitReachedTitle"),
        t("freePlanMaxMembersPerGroupMessage"),
        [{ text: t("understood"), style: "cancel" }],
      );
      return;
    }
    setInviting(true);
    try {
      const target = await firestoreService.getUserByEmail(email);
      if (!target) {
        Alert.alert(t("userNotFound"), t("userNotFoundMsg"));
        setInviting(false);
        return;
      }
      if (target.id === user.uid) {
        Alert.alert(t("error"), t("cantInviteSelf"));
        setInviting(false);
        return;
      }
      await firestoreService.inviteUserToGroup({
        groupId,
        groupName: group.name,
        invitedUserId: target.id,
        invitedBy: user.uid,
        invitedByName: userProfile?.name || user.displayName || "Un compañero",
      });
      setInviteModalVisible(false);
      Alert.alert(t("invitationSent"), t("invitationSentMsg"));
    } catch (e) {
      Alert.alert("Error", e.message || "No se pudo enviar la invitación");
    } finally {
      setInviting(false);
    }
  };

  // Convierte Firestore Timestamp, Date o string a fecha legible
  const formatUploadDate = (uploadedAt) => {
    if (!uploadedAt) return "";
    try {
      let date;
      if (uploadedAt?.toDate) {
        date = uploadedAt.toDate(); // Firestore Timestamp
      } else if (uploadedAt instanceof Date) {
        date = uploadedAt;
      } else {
        date = new Date(uploadedAt);
      }
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const handleOpenFile = useCallback(
    async (file) => {
      try {
        if (!file.publicUrl) {
          Alert.alert(t("error"), t("fileUrlUnavailable"));
          return;
        }
        const supported = await Linking.canOpenURL(file.publicUrl);
        if (supported) {
          await Linking.openURL(file.publicUrl);
        } else {
          Alert.alert(t("error"), t("fileCannotOpen"));
        }
      } catch {
        Alert.alert(t("error"), t("fileOpenFailed"));
      }
    },
    [t],
  );

  const handleDeleteFile = useCallback(
    (file) => {
      Alert.alert(t("confirm"), t("deleteFileConfirm"), [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteGroupFile(file.filePath);
              await firestoreService.deleteGroupFile(groupId, file.id);
              Alert.alert(t("success"), t("fileDeleted"));
            } catch (error) {
              Alert.alert(t("error"), error.message);
            }
          },
        },
      ]);
    },
    [t, deleteGroupFile, groupId],
  );

  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const mayChangeStatus =
      canManage || task.assigneeId === user?.uid;
    if (!mayChangeStatus) {
      Alert.alert(t("error"), t("taskStatusChangeDenied"));
      return;
    }

    let nextStatus = "Pendiente";
    if (currentStatus === "Pendiente") nextStatus = "En progreso";
    else if (currentStatus === "En progreso") nextStatus = "Completada";
    else if (currentStatus === "Completada") nextStatus = "Pendiente";

    try {
      const assigneeMember = members.find((m) => m.id === task.assigneeId);
      await firestoreService.updateTaskStatus(taskId, nextStatus, {
        groupId,
        taskId,
        title: task.title || "",
        assigneeId: task.assigneeId || "",
        assigneeName:
          assigneeMember?.name ||
          userProfile?.name ||
          user?.displayName ||
          "Usuario",
      });
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar la tarea.");
    }
  };

  // ── Subtareas ────────────────────────────────────────────────────────────────
  const handleSubtasksChange = async (taskId, newSubtasks) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.assigneeId !== user?.uid) {
      Alert.alert(t("error"), t("subtasksOnlyAssignee"));
      return;
    }
    const prev = task.subtasks || [];
    const prevIds = new Set(prev.map((s) => s.id));
    const hasNewSubtask = (newSubtasks || []).some((s) => !prevIds.has(s.id));
    if (
      hasNewSubtask &&
      (userProfile?.plan || "free") !== "personal"
    ) {
      Alert.alert(t("limitReachedTitle"), t("subtasksRequiresPersonalPlan"));
      return;
    }
    try {
      await firestoreService.updateTask(taskId, { subtasks: newSubtasks });
    } catch (e) {
      Alert.alert("Error", "No se pudo guardar las subtareas.");
    }
  };

  // ── Prioridad + ordenación ────────────────────────────────────────────────
  const [sortBy, setSortBy] = useState("default");

  const handlePriorityChange = async (taskId, priority) => {
    if (!canManage) return;
    if (!groupLeaderIsPro) return;
    if (
      isLeader &&
      (userProfile?.plan || "free") !== "personal"
    ) {
      Alert.alert(t("limitReachedTitle"), t("priorityRequiresPersonalPlan"));
      return;
    }
    try {
      await firestoreService.updateTask(taskId, { priority: priority ?? null });
    } catch (e) {
      Alert.alert("Error", "No se pudo actualizar la prioridad.");
    }
  };

  const sortedTasks = useMemo(() => sortTasks(tasks, sortBy), [tasks, sortBy]);

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      // Límites de documentos según el plan del líder del grupo
      {
        const MAX_FILE_SIZE = groupLeaderIsPro
          ? 50 * 1024 * 1024
          : 5 * 1024 * 1024; // 50 MB / 5 MB
        const MAX_TOTAL_SIZE = groupLeaderIsPro
          ? 1024 * 1024 * 1024
          : 100 * 1024 * 1024; // 1 GB / 100 MB
        const fileSize = file.size || 0;
        const totalUsed = files.reduce((sum, f) => sum + (f.fileSize || 0), 0);

        if (fileSize > MAX_FILE_SIZE) {
          const limitLabel = groupLeaderIsPro ? "50 MB" : "5 MB";
          const upgradeHint = groupLeaderIsPro
            ? ""
            : t("groupFileLimitLeaderUpgradeHint");
          Alert.alert(
            t("fileTooLargeTitle"),
            t("fileTooLargeBody", { limitLabel, upgradeHint }),
            [{ text: t("understood"), style: "cancel" }],
          );
          return;
        }
        if (totalUsed + fileSize > MAX_TOTAL_SIZE) {
          const usedMB = (totalUsed / (1024 * 1024)).toFixed(1);
          const limitLabel = groupLeaderIsPro ? "1 GB" : "100 MB";
          const upgradeHint = groupLeaderIsPro
            ? ""
            : t("groupFileLimitLeaderUpgradeHint");
          Alert.alert(
            t("fileStorageFullTitle"),
            t("fileStorageFullBody", { limitLabel, usedMB, upgradeHint }),
            [{ text: t("understood"), style: "cancel" }],
          );
          return;
        }
      }

      setUploadingFileName(file.name || t("fileGenericName"));
      setUploadProgress(0);
      setUploading(true);

      // Subir archivo a Supabase con progreso real (fases 0-90%)
      const uploadedFile = await uploadGroupFile(
        groupId,
        file.uri,
        file.name,
        file.mimeType || "application/octet-stream",
        (pct) => setUploadProgress(pct),
      );

      // Guardar metadatos en Firestore (fase 90-100%)
      setUploadProgress(92);
      await firestoreService.addGroupFile({
        groupId,
        fileName: uploadedFile.fileName,
        filePath: uploadedFile.filePath,
        publicUrl: uploadedFile.publicUrl,
        uploadedBy: user.uid,
        uploadedByName: userProfile?.name || user.displayName || "Usuario",
        uploadedAt: new Date(),
        fileSize: file.size || 0,
      });

      setUploadProgress(100);
      // Breve pausa para mostrar el 100% antes de cerrar
      await new Promise((r) => setTimeout(r, 600));
    } catch (e) {
      console.error("Error uploading file:", e);
      Alert.alert(t("error"), t("uploadError"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveMember = (memberId, memberName) => {
    Alert.alert(t("confirm"), t("kickMemberMsg"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("kickMember"),
        style: "destructive",
        onPress: async () => {
          await firestoreService.removeMemberFromGroup(groupId, memberId);
          setMembers((prev) => prev.filter((m) => m.id !== memberId));
        },
      },
    ]);
  };

  const handleToggleModerator = (memberId, memberName, isMod) => {
    if (isMod) {
      Alert.alert(
        t("removeModeratorTitle"),
        t("removeModeratorMessage", { name: memberName }),
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("removeModeratorConfirm"),
            style: "destructive",
            onPress: async () => {
              try {
                await firestoreService.removeModeratorFromGroup(
                  groupId,
                  memberId,
                );
              } catch (e) {
                Alert.alert(t("error"), t("roleUpdateError"));
              }
            },
          },
        ],
      );
    } else {
      // Límite de 1 moderador en plan gratuito
      const currentMods = (group?.moderators || []).length;
      if (isFree && currentMods >= 1) {
        Alert.alert(
          t("limitReachedTitle"),
          t("freePlanMaxModeratorsMessage"),
          [{ text: t("understood"), style: "cancel" }],
        );
        return;
      }
      Alert.alert(
        t("assignModeratorTitle"),
        t("assignModeratorMessage", { name: memberName }),
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("assignModeratorConfirm"),
            onPress: async () => {
              try {
                await firestoreService.addModeratorToGroup(groupId, memberId);
              } catch (e) {
                Alert.alert(t("error"), t("roleUpdateError"));
              }
            },
          },
        ],
      );
    }
  };

  const handleOpenEditModal = () => {
    setEditName(group.name || "");
    setEditDescription(group.description || "");
    setEditPhotoUrl(group.photoURL || "");
    setEditModalVisible(true);
  };

  const handlePickGroupPhoto = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setUploadingPhoto(true);
      const url = await uploadGroupAvatar(
        groupId,
        file.uri,
        file.mimeType || "image/jpeg",
      );
      setEditPhotoUrl(url);
    } catch (e) {
      Alert.alert(t("error"), "No se pudo cambiar la foto del grupo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!editName.trim()) {
      Alert.alert(t("error"), t("groupNameRequiredAlert"));
      return;
    }
    setSaving(true);
    try {
      await firestoreService.updateGroup(groupId, {
        name: editName.trim(),
        description: editDescription.trim(),
        photoURL: editPhotoUrl || null,
      });
      setGroup((prev) => ({
        ...prev,
        name: editName.trim(),
        description: editDescription.trim(),
        photoURL: editPhotoUrl || null,
      }));
      setEditModalVisible(false);
      Alert.alert(t("success"), t("groupUpdated"));
    } catch (e) {
      Alert.alert(t("error"), t("groupUpdateError"));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Primer nombre del miembro (asignado, etc.).
   * Prioridad: lista members → assigneeName en la tarea → si eres tú, perfil/auth → sin asignar.
   * No usar "Tú" en el badge: debe verse el mismo nombre que en el resto del grupo.
   */
  const getMemberName = (memberId, fallback) => {
    if (!memberId) return t("unassigned");
    const member = members.find((m) => m.id === memberId);
    const fromMember = member?.name?.split(" ")[0]?.trim();
    if (fromMember) return fromMember;
    const fromFallback = fallback ? String(fallback).split(" ")[0]?.trim() : "";
    if (fromFallback) return fromFallback;
    if (memberId === user?.uid) {
      const self =
        userProfile?.name?.split(" ")[0]?.trim() ||
        user?.displayName?.split(" ")[0]?.trim();
      if (self) return self;
    }
    return t("unassigned");
  };

  if (loading || !group) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color="#4F46E5" size="large" />
      </View>
    );
  }

  // Resolución inmediata del nombre del líder:
  // · Si el usuario actual ES el líder → usar su propio perfil (sin esperar members)
  // · Si no → buscar en members cargados; si aún no llegan, usar group.leaderName
  //   (campo guardado al crear el grupo) para evitar mostrar "Líder" como placeholder.
  const leaderName = isLeader
    ? userProfile?.name?.split(" ")[0]?.trim() ||
      user?.displayName?.split(" ")[0]?.trim() ||
      user?.email?.split("@")[0] ||
      "…"
    : members.find((m) => m.id === group.leaderId)?.name?.split(" ")[0] ||
      group?.leaderName?.split(" ")[0] ||
      "…";

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.dark ? "light-content" : "dark-content"}
        backgroundColor={theme.card}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          accessibilityHint="Doble toque para regresar"
        >
          <ChevronLeft color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <GroupAvatar
          photoURL={group.photoURL}
          name={group.name}
          size={38}
          borderRadius={10}
        />
        <View style={styles.headerInfo}>
          <Text
            style={[styles.headerTitle, { color: theme.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {group.name}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {group.members?.length || 0} {t("members")} | {t("leader")}:{" "}
            {leaderName}
          </Text>
        </View>
        {isLeader ? (
          <TouchableOpacity
            onPress={handleOpenEditModal}
            style={[
              styles.editHeaderBtn,
              { backgroundColor: theme.dark ? "#1E1B4B" : "#EEF2FF" },
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Editar grupo"
            accessibilityHint="Doble toque para editar el nombre y descripción"
          >
            <Pencil color="#4F46E5" size={20} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {/* Tabs — "panel" solo si eres el líder del grupo y tienes plan Personal */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: theme.card, borderBottomColor: theme.border },
        ]}
      >
        {(canAccessLeaderPanel
          ? ["tareas", "archivos", "miembros", "panel"]
          : ["tareas", "archivos", "miembros"]
        ).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => {
              setActiveTab(tab);
              setHighlightId(null);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
            accessibilityLabel={
              tab === "tareas"
                ? t("tasks")
                : tab === "archivos"
                  ? t("groupFiles")
                  : tab === "miembros"
                    ? t("members")
                    : t("leaderPanelTabA11y")
            }
            accessibilityHint={t("tabBarDoubleTapSection")}
          >
            {/* AppText: aplica escala, fuente dislexia y narrador.
                adjustsFontSizeToFit permite que el texto crezca con
                accesibilidad pero se ajuste al ancho del tab sin desbordarse.
                El onTouchStart pasivo de AppText coexiste con el onPress
                del TouchableOpacity padre sin conflicto. */}
            <Text
              style={[
                styles.tabText,
                { color: theme.textSecondary },
                activeTab === tab && styles.tabTextActive,
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {tab === "tareas"
                ? `${t("tasks").toUpperCase()} (${tasks.length})`
                : tab === "archivos"
                  ? t("attachFile").toUpperCase()
                  : tab === "miembros"
                    ? t("members").toUpperCase()
                    : t("leaderPanelTab").toUpperCase()}
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
                title={t("allTasksDone")}
                message={t("noTasksAssigned")}
                actionText={canManage ? t("addNewTask") : null}
                onAction={() => navigation.navigate("CreateTask", { groupId })}
              />
            ) : (
              <>
                {/* ── Barra de ordenación ── */}
                <View style={styles.sortBar}>
                  <Text style={[styles.sortLabel, { color: theme.textMuted }]}>
                    {t("sortTasksLabel")}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.sortChipRow}
                  >
                    {[
                      { key: "default", icon: null, labelKey: "sortByDefault" },
                      {
                        key: "importancia",
                        icon: (
                          <Flag
                            size={11}
                            color={
                              sortBy === "importancia"
                                ? "#FFF"
                                : theme.textMuted
                            }
                          />
                        ),
                        labelKey: "sortByImportance",
                      },
                      {
                        key: "fecha",
                        icon: (
                          <CalendarDays
                            size={11}
                            color={
                              sortBy === "fecha" ? "#FFF" : theme.textMuted
                            }
                          />
                        ),
                        labelKey: "sortByDate",
                      },
                      {
                        key: "estado",
                        icon: (
                          <Activity
                            size={11}
                            color={
                              sortBy === "estado" ? "#FFF" : theme.textMuted
                            }
                          />
                        ),
                        labelKey: "sortByStatus",
                      },
                    ].map((opt) => {
                      const active = sortBy === opt.key;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          onPress={() => setSortBy(opt.key)}
                          style={[
                            styles.sortChip,
                            active
                              ? { backgroundColor: "#4F46E5" }
                              : {
                                  backgroundColor: theme.dark
                                    ? "rgba(255,255,255,0.06)"
                                    : "rgba(0,0,0,0.04)",
                                  borderWidth: 1,
                                  borderColor: theme.dark
                                    ? "rgba(255,255,255,0.08)"
                                    : "rgba(0,0,0,0.07)",
                                },
                          ]}
                          activeOpacity={0.75}
                        >
                          {opt.icon}
                          <Text
                            style={[
                              styles.sortChipTxt,
                              { color: active ? "#FFF" : theme.textSecondary },
                            ]}
                          >
                            {t(opt.labelKey)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* ── Lista de tareas ── */}
                <FlatList
                  data={sortedTasks}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TaskItem
                      task={item}
                      assigneeName={getMemberName(
                        item.assigneeId,
                        item.assigneeName,
                      )}
                      onToggleStatus={handleToggleTaskStatus}
                      canToggleStatus={
                        canManage || item.assigneeId === user?.uid
                      }
                      isLeader={canManage}
                      groupName={group?.name}
                      groupLeaderHasPersonalPlan={groupLeaderIsPro}
                      canChangeTaskPriority={canChangeTaskPriority}
                      onSubtasksChange={handleSubtasksChange}
                      onPriorityChange={handlePriorityChange}
                      onEdit={(task) =>
                        navigation.navigate("CreateTask", { groupId, task })
                      }
                      onDelete={(taskId, taskTitle) => {
                        Alert.alert(
                          t("confirm") || "Confirmar",
                          `¿Eliminar la tarea "${taskTitle}"?`,
                          [
                            {
                              text: t("cancel") || "Cancelar",
                              style: "cancel",
                            },
                            {
                              text: t("delete") || "Eliminar",
                              style: "destructive",
                              onPress: async () => {
                                try {
                                  await firestoreService.deleteTask(taskId);
                                } catch (e) {
                                  Alert.alert(
                                    "Error",
                                    "No se pudo eliminar la tarea",
                                  );
                                }
                              },
                            },
                          ],
                        );
                      }}
                    />
                  )}
                  contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: insets.bottom + 100 },
                  ]}
                  showsVerticalScrollIndicator={false}
                  ListFooterComponent={
                    canManage && (
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={() =>
                          navigation.navigate("CreateTask", { groupId })
                        }
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Crear tarea"
                        accessibilityHint="Doble toque para crear una nueva tarea"
                      >
                        <Plus color="#4F46E5" size={16} />
                        <Text style={styles.addButtonText}>
                          {t("createTask")}
                        </Text>
                      </TouchableOpacity>
                    )
                  }
                />
              </>
            )}
          </>
        )}

        {/* ARCHIVOS TAB */}
        {activeTab === "archivos" && (
          <>
            {files.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={t("noDocuments")}
                message={t("noFilesShared")}
                actionText={uploading ? t("uploading") : t("uploadFile")}
                onAction={uploading ? null : handleFileUpload}
              />
            ) : (
              <FlatList
                ref={filesListRef}
                data={files}
                keyExtractor={(item) => item.id}
                onScrollToIndexFailed={() => {}}
                onScrollBeginDrag={() => setHighlightId(null)}
                renderItem={({ item: file }) => (
                  <FileCard
                    file={file}
                    theme={theme}
                    isDark={isDark}
                    highlight={file.id === highlightId}
                    t={t}
                    formatUploadDate={formatUploadDate}
                    onOpen={(f) => {
                      setHighlightId(null);
                      handleOpenFile(f);
                    }}
                    onDelete={(f) => {
                      setHighlightId(null);
                      handleDeleteFile(f);
                    }}
                  />
                )}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: insets.bottom + 100 },
                ]}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                  <AppButton
                    style={[
                      styles.addButtonDashed,
                      { borderColor: theme.border },
                    ]}
                    onPress={uploading ? undefined : handleFileUpload}
                    disabled={uploading}
                    accessibilityLabel={
                      uploading
                        ? t("uploadFileFooterA11yUploading")
                        : t("uploadFileFooterA11yIdle")
                    }
                    accessibilityHint={t("uploadFileFooterHint")}
                  >
                    <Text
                      style={[
                        styles.addButtonDashedText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {uploading ? t("uploading") : t("uploadFile")}
                    </Text>
                  </AppButton>
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
            renderItem={({ item: member }) => {
              const isThisLeader = member.id === group?.leaderId;
              const isThisMod =
                !isThisLeader && (group?.moderators || []).includes(member.id);
              return (
                <View
                  style={[
                    styles.memberCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  {/* Info — flex:1 para que el nombre se trunca y no empuje los botones */}
                  <View style={[styles.memberInfo, { flex: 1 }]}>
                    <View
                      style={[
                        styles.memberAvatar,
                        { backgroundColor: theme.dark ? "#312E81" : "#EEF2FF" },
                      ]}
                    >
                      {member.photoURL ? (
                        <Image
                          source={{ uri: member.photoURL }}
                          style={styles.memberAvatarImg}
                        />
                      ) : (
                        <Text style={styles.memberAvatarText}>
                          {initialsFromDisplayName(
                            getProfileName(member) || "",
                          )}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.memberName, { color: theme.text }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {getProfileName(member) || t("userFallback")}
                      </Text>
                      {isThisLeader ? (
                        <View style={styles.badgeLeader}>
                          <Text style={styles.badgeLeaderText}>
                            {t("leader")}
                          </Text>
                        </View>
                      ) : isThisMod ? (
                        <View style={styles.badgeModerator}>
                          <Shield size={9} color="#6D28D9" strokeWidth={2.5} />
                          <Text style={styles.badgeModeratorText}>
                            {t("moderator")}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.badgeMember}>
                          <Text style={styles.badgeMemberText}>
                            {t("member")}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Acciones — solo visible para el líder, no sobre sí mismo */}
                  {isLeader && member.id !== user.uid && (
                    <View style={styles.memberActions}>
                      {/* Rol moderador */}
                      <TouchableOpacity
                        onPress={() =>
                          handleToggleModerator(
                            member.id,
                            getProfileName(member) || t("userFallback"),
                            isThisMod,
                          )
                        }
                        style={[
                          styles.memberActionBtn,
                          isThisMod
                            ? {
                                backgroundColor: theme.dark
                                  ? "#2E1065"
                                  : "#F5F3FF",
                                borderColor: "#7C3AED",
                              }
                            : {
                                backgroundColor: theme.dark
                                  ? "#1e1b4b"
                                  : "#EEF2FF",
                                borderColor: theme.dark ? "#4338CA" : "#C7D2FE",
                              },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isThisMod
                            ? t("moderatorRemoveA11y", {
                                name: getProfileName(member) || t("userFallback"),
                              })
                            : t("moderatorAssignA11y", {
                                name: getProfileName(member) || t("userFallback"),
                              })
                        }
                      >
                        {isThisMod ? (
                          <ShieldOff
                            size={14}
                            color="#7C3AED"
                            strokeWidth={2}
                          />
                        ) : (
                          <Shield
                            size={14}
                            color={theme.dark ? "#818CF8" : "#4338CA"}
                            strokeWidth={2}
                          />
                        )}
                      </TouchableOpacity>

                      {/* Expulsar */}
                      <TouchableOpacity
                        onPress={() =>
                          handleRemoveMember(
                            member.id,
                            getProfileName(member) || t("userFallback"),
                          )
                        }
                        style={[
                          styles.memberActionBtn,
                          {
                            backgroundColor: theme.dark ? "#2d0f0f" : "#FEF2F2",
                            borderColor: theme.dark ? "#7f2020" : "#FECACA",
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Expulsar a ${getProfileName(member) || t("userFallback")}`}
                        accessibilityHint="Doble toque para eliminar este miembro del grupo"
                      >
                        <UserMinus size={14} color="#EF4444" strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            }}
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
                  accessibilityRole="button"
                  accessibilityLabel="Invitar miembro"
                  accessibilityHint="Doble toque para invitar a alguien al grupo"
                >
                  <UserPlus color="#4F46E5" size={16} />
                  <Text style={styles.addButtonText}>{t("inviteMembers")}</Text>
                </TouchableOpacity>
              )
            }
          />
        )}

        {/* PANEL TAB — líder con plan Personal */}
        {activeTab === "panel" && canAccessLeaderPanel && (
          <LeaderPanel
            tasks={tasks}
            members={members}
            group={group}
            theme={theme}
            isDark={isDark}
            insets={insets}
            getMemberName={getMemberName}
          />
        )}
      </View>

      {/* Bottom Action */}
      <View
        style={[
          styles.bottomAction,
          {
            paddingBottom: insets.bottom + 16,
            backgroundColor: theme.card,
            borderTopColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() =>
            navigation.navigate("Chat", {
              groupId,
              groupName: group?.name,
              groupPhotoURL: group?.photoURL,
            })}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Abrir chat"
          accessibilityHint="Doble toque para abrir el chat del grupo"
        >
          <MessageSquare color="#FFFFFF" size={20} />
          <Text style={styles.chatButtonText}>{t("chat")}</Text>
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
        <View style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {t("editGroup")}
              </Text>
              <Text
                style={[styles.modalSubtitle, { color: theme.textSecondary }]}
              >
                {t("editGroupDesc")}
              </Text>

              {/* ── Foto del grupo ── */}
              <TouchableOpacity
                onPress={handlePickGroupPhoto}
                disabled={uploadingPhoto || saving}
                style={styles.photoPickerBtn}
                accessibilityRole="button"
                accessibilityLabel="Cambiar foto del grupo"
                accessibilityHint="Doble toque para seleccionar una imagen"
              >
                {uploadingPhoto ? (
                  <View style={styles.photoPickerPlaceholder}>
                    <ActivityIndicator color="#4F46E5" />
                  </View>
                ) : editPhotoUrl ? (
                  <View>
                    <Image
                      source={{ uri: editPhotoUrl }}
                      style={styles.photoPickerImg}
                    />
                    <View style={styles.photoPickerOverlay}>
                      <Text style={styles.photoPickerOverlayText}>✏️</Text>
                    </View>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.photoPickerPlaceholder,
                      { backgroundColor: theme.dark ? "#1E1B4B" : "#EEF2FF" },
                    ]}
                  >
                    <Text style={{ fontSize: 28 }}>📷</Text>
                    <Text
                      style={[
                        styles.photoPickerHint,
                        { color: theme.textMuted },
                      ]}
                    >
                      Añadir foto
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                {t("groupNameLabel")}
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: theme.input,
                    borderColor: theme.inputBorder,
                    color: theme.text,
                  },
                ]}
                value={editName}
                onChangeText={setEditName}
                placeholder={t("groupNamePlaceholder2")}
                placeholderTextColor={theme.textMuted}
                editable={!saving}
                accessibilityLabel="Nombre del grupo"
                accessibilityHint="Ingresa el nombre del grupo"
              />
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                {t("groupDescLabel")}
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    minHeight: 80,
                    textAlignVertical: "top",
                    backgroundColor: theme.input,
                    borderColor: theme.inputBorder,
                    color: theme.text,
                  },
                ]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder={t("groupDescPlaceholder")}
                placeholderTextColor={theme.textMuted}
                multiline
                editable={!saving}
                accessibilityLabel="Descripción del grupo"
                accessibilityHint="Ingresa una descripción para el grupo"
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBtn,
                    { backgroundColor: theme.dark ? "#374151" : "#F3F4F6" },
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => setEditModalVisible(false)}
                  disabled={saving}
                  android_ripple={{ color: "rgba(255,255,255,0.16)" }}
                  pressRetentionOffset={{
                    top: 10,
                    bottom: 10,
                    left: 10,
                    right: 10,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar"
                  accessibilityHint="Doble toque para cancelar la edición"
                >
                  <Text style={[styles.modalCancelText, { color: theme.text }]}>
                    {t("cancel")}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalBtn,
                    styles.modalSendBtn,
                    saving && { opacity: 0.6 },
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={handleSaveGroup}
                  disabled={saving}
                  android_ripple={{ color: "rgba(255,255,255,0.16)" }}
                  pressRetentionOffset={{
                    top: 10,
                    bottom: 10,
                    left: 10,
                    right: 10,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Guardar cambios del grupo"
                  accessibilityHint="Doble toque para guardar los cambios del grupo"
                >
                  <Text style={styles.modalSendText}>
                    {saving ? t("loading") : t("save")}
                  </Text>
                </Pressable>
              </View>
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
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {t("inviteMemberTitle")}
            </Text>
            <Text
              style={[styles.modalSubtitle, { color: theme.textSecondary }]}
            >
              {t("enterEmailInvite")}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
              placeholder={t("emailExamplePlaceholder")}
              placeholderTextColor={theme.textMuted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!inviting}
              accessibilityLabel="Correo del invitado"
              accessibilityHint="Ingresa el correo electrónico del usuario a invitar"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme.dark ? "#374151" : "#F3F4F6" },
                ]}
                onPress={() => setInviteModalVisible(false)}
                disabled={inviting}
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
                accessibilityHint="Doble toque para cancelar la invitación"
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>
                  {t("cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalSendBtn,
                  inviting && { opacity: 0.6 },
                ]}
                onPress={handleSendInvitation}
                disabled={inviting}
                accessibilityRole="button"
                accessibilityLabel="Enviar invitación"
                accessibilityHint="Doble toque para enviar la invitación al usuario"
              >
                <Text style={styles.modalSendText}>
                  {inviting ? t("loading") : t("send")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Progress Modal */}
      <Modal
        visible={uploading}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.uploadOverlay}>
          <View style={[styles.uploadCard, { backgroundColor: theme.card }]}>
            {/* Icono */}
            <View
              style={[
                styles.uploadIconWrap,
                { backgroundColor: theme.dark ? "#1E1B4B" : "#EEF2FF" },
              ]}
            >
              <FileText color="#4F46E5" size={30} />
            </View>

            {/* Nombre del archivo */}
            <Text
              style={[styles.uploadFileName, { color: theme.text }]}
              numberOfLines={2}
            >
              {uploadingFileName}
            </Text>

            {/* Fase */}
            <Text style={[styles.uploadPhase, { color: theme.textMuted }]}>
              {uploadProgress < 10
                ? "Preparando archivo..."
                : uploadProgress < 90
                  ? "Subiendo..."
                  : uploadProgress < 100
                    ? "Guardando..."
                    : "¡Listo!"}
            </Text>

            {/* Barra de progreso — clampear a [0,100] por si algún callback llega tarde */}
            <View
              style={[
                styles.uploadBarBg,
                { backgroundColor: theme.dark ? "#374151" : "#E5E7EB" },
              ]}
            >
              <View
                style={[
                  styles.uploadBarFill,
                  { width: `${Math.min(100, uploadProgress)}%` },
                ]}
              />
            </View>

            {/* Porcentaje */}
            <Text style={styles.uploadPct}>
              {Math.min(100, uploadProgress)}%
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // ─ Barra de ordenación ──────────────────────────────────────────────────
  sortBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    marginBottom: 16,
    gap: 8,
  },
  sortLabel: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 0,
  },
  sortChipRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingRight: 4,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  sortChipTxt: {
    fontSize: 11,
    fontWeight: "600",
  },

  // ─ Layout principal ──────────────────────────────────────────────────────
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
    paddingHorizontal: 6,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#4F46E5",
  },
  tabText: {
    fontSize: 10,
    lineHeight: 18,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
    flexWrap: "wrap",
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  // Zona de info: flex: 1 + flexShrink: 1 garantiza que NUNCA empuja los botones
  fileInfo: {
    flex: 1,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  fileTextBlock: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  fileIconText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 0.5,
  },
  fileName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
  },
  fileDate: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 1,
  },
  // Botones absolutamente posicionados — completamente fuera del flujo flex.
  // Así el motor Yoga no puede comprimirlos ni ocultarlos en ningún dispositivo.
  // El paddingRight de la card reserva el espacio para que el texto no se superponga.
  fileActions: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  memberAvatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  memberAvatarText: {
    fontSize: 15,
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
    paddingHorizontal: 10,
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
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeMemberText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4338CA",
  },
  badgeModerator: {
    marginTop: 4,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#A78BFA",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeModeratorText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6D28D9",
  },
  memberActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 10,
    flexShrink: 0,
  },
  memberActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
    lineHeight: 20,
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
    lineHeight: 20,
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
  // Photo picker inside edit modal
  photoPickerBtn: {
    alignSelf: "center",
    marginBottom: 16,
  },
  photoPickerPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  photoPickerImg: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  photoPickerOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#4F46E5",
    borderRadius: 10,
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  photoPickerOverlayText: {
    fontSize: 14,
  },
  photoPickerHint: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
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
    minWidth: 96,
    alignItems: "center",
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

  // ── Upload progress modal ──────────────────────────────────────────────────
  uploadOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  uploadCard: {
    width: "100%",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 10,
  },
  uploadIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  uploadFileName: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },
  uploadPhase: {
    fontSize: 13,
    marginBottom: 4,
  },
  uploadBarBg: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  uploadBarFill: {
    height: "100%",
    backgroundColor: "#4F46E5",
    borderRadius: 4,
  },
  uploadPct: {
    fontSize: 22,
    fontWeight: "700",
    color: "#4F46E5",
  },
});
