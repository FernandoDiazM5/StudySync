// NOTIFICATIONS SCREEN - StudySync
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SectionList,
  ScrollView,
} from "react-native";
import Text from "../../components/AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  Mail,
  ClipboardList,
  Users,
  CheckCheck,
  MessageSquare,
} from "lucide-react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAccessibility } from "../../contexts/AccessibilityContext";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../services/firestoreService";
import { resolveNotificationCopy } from "../../utils/notificationI18n";

const TYPES = ["all", "mention", "invitation", "task", "group"];

const SECTION_CONFIG = {
  mention: {
    labelKey: "mentions",
    tabLabelKey: "mentions",
    icon: MessageSquare,
    color: "#4F46E5",
    colorFaint: "rgba(79,70,229,0.22)", // borde leído: índigo tenue
    bg: "#EEF2FF",
    bgDark: "#1E1B4B",
  },
  invitation: {
    labelKey: "invitations",
    tabLabelKey: "invitations",
    icon: Mail,
    color: "#8B5CF6",
    colorFaint: "rgba(139,92,246,0.22)", // borde leído: violeta tenue
    bg: "#EDE9FE",
    bgDark: "#2E1065",
  },
  task: {
    labelKey: "tasks",
    tabLabelKey: "tasks",
    icon: ClipboardList,
    color: "#F59E0B",
    colorFaint: "rgba(245,158,11,0.22)", // borde leído: ámbar tenue
    bg: "#FEF3C7",
    bgDark: "#451A03",
  },
  group: {
    labelKey: "groups",
    tabLabelKey: "groups",
    icon: Users,
    color: "#10B981",
    colorFaint: "rgba(16,185,129,0.22)", // borde leído: esmeralda tenue
    bg: "#D1FAE5",
    bgDark: "#022C22",
  },
};

function timeAgo(isoString, t) {
  if (!isoString) return "";
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return t("now");
  if (diff < 3600)
    return t("timeAgoMinutes", { n: Math.floor(diff / 60) });
  if (diff < 86400)
    return t("timeAgoHours", { n: Math.floor(diff / 3600) });
  const days = Math.floor(diff / 86400);
  if (days === 1) return t("yesterday");
  return t("timeAgoDays", { n: days });
}

function NotifItem({ item, onPress, theme, isDark }) {
  const { t, language } = useAccessibility();
  const cfg = SECTION_CONFIG[item.type] || SECTION_CONFIG.group;
  const Icon = cfg.icon;
  // Estado local de pressed para el feedback de borde coloreado.
  // Usamos TouchableOpacity (no Pressable) para evitar el rectángulo gris
  // del sistema Android que Pressable muestra y que no respeta borderRadius.
  const [pressed, setPressed] = useState(false);

  const { title: locTitle, body: locBody } = resolveNotificationCopy(
    item,
    t,
    language,
  );

  // Para tareas: nombre de tarea / grupo (data o cuerpo localizado)
  let taskName = "";
  let taskGroup = "";
  if (item.type === "task") {
    if (item.data?.taskName || item.data?.groupName) {
      taskName = item.data?.taskName || locBody;
      taskGroup = item.data?.groupName || "";
    } else if (locBody.includes(" · ")) {
      const parts = locBody.split(" · ");
      taskName = parts[0] || locBody;
      taskGroup = parts[1] || "";
    } else {
      taskName = locBody;
      taskGroup = "";
    }
  }

  // Estructura: View externo controla forma+borde+overflow, TouchableOpacity
  // controla el toque+fondo, la barra es un hijo flex normal (no absolute)
  // que se estira al 100% de la altura sin ser recortada por borderRadius.
  return (
    <View
      style={[
        s.itemOuter,
        {
          borderColor: pressed
            ? cfg.color
            : !item.read
              ? cfg.color
              : cfg.colorFaint,
          borderWidth: pressed ? 2 : 1,
        },
      ]}
    >
      {/* Indicador izquierdo para no-leídos: zona flex que centra un pill redondeado */}
      {!item.read && (
        <View style={s.unreadZone}>
          <View style={[s.unreadPill, { backgroundColor: cfg.color }]} />
        </View>
      )}

      <TouchableOpacity
        onPress={() => onPress(item)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        activeOpacity={1}
        style={[
          s.item,
          {
            backgroundColor: pressed
              ? isDark
                ? cfg.bgDark
                : cfg.bg
              : theme.card,
          },
        ]}
      >
        <View
          style={[
            s.iconWrap,
            { backgroundColor: isDark ? cfg.bgDark : cfg.bg },
          ]}
        >
          <Icon color={cfg.color} size={20} />
        </View>
        <View style={s.itemBody}>
          {item.type === "task" ? (
            <>
              <Text
                style={[
                  s.itemDesc,
                  { color: theme.text },
                  !item.read && { fontWeight: "600" },
                ]}
                numberOfLines={2}
              >
                {taskName}
              </Text>
              {taskGroup ? (
                <Text
                  style={[s.itemTitle, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {taskGroup}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text
                style={[s.itemTitle, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {locTitle}
              </Text>
              <Text
                style={[
                  s.itemDesc,
                  { color: theme.text },
                  !item.read && { fontWeight: "600" },
                ]}
                numberOfLines={2}
              >
                {locBody}
              </Text>
            </>
          )}
        </View>
        <View style={s.itemRight}>
          <Text style={[s.timeText, { color: theme.textMuted }]}>
            {timeAgo(item.createdAt, t)}
          </Text>
          {!item.read && (
            <View style={[s.dot, { backgroundColor: cfg.color }]} />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useAccessibility();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");

  const listRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const unsub = getMyNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Marca el ítem como leído (optimista + Firestore).
  // Se separa para poder llamarla en distintos momentos según el tipo de navegación.
  const markRead = useCallback((item) => {
    if (item.read) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
    );
    markNotificationRead(item.id).catch(() => {});
  }, []);

  const handlePress = useCallback(
    (item) => {
      const { data = {} } = item;
      const rootNav = navigation.getParent() ?? navigation;
      const ts = Date.now();

      if (item.type === "invitation") {
        // navigate() oculta esta pantalla de inmediato → marcar antes es seguro
        markRead(item);
        navigation.navigate("Grupos", {
          scrollToInvitations: true,
          highlightInvitationId: data.invitationId || null,
          _ts: ts,
        });
      } else if (item.type === "task") {
        markRead(item);
        navigation.navigate("Tareas", { taskId: data.taskId || null, _ts: ts });
      } else if (item.type === "mention" && data.groupId) {
        // push() deja esta pantalla visible detrás de Chat durante la transición.
        // Si marcamos leído ANTES de navegar, el borde coloreado desaparece y el
        // usuario ve el outline gris durante la animación.
        // Solución: navegar primero → esperar que la transición termine → marcar leído.
        rootNav.push("Chat", {
          groupId: data.groupId,
          groupName: item.title || undefined,
          highlightMessageId: data.messageId || null,
          _ts: ts,
        });
        setTimeout(() => markRead(item), 350);
      } else if (item.type === "group" && data.groupId) {
        // Mismo caso que mention: push mantiene la pantalla visible
        rootNav.push("GroupDetails", {
          groupId: data.groupId,
          initialTab: data.tab || "tareas",
          highlightFileId: data.fileId || undefined,
          _ts: ts,
        });
        setTimeout(() => markRead(item), 350);
      }
    },
    [navigation, markRead],
  );

  const handleMarkAll = useCallback(async () => {
    if (!user) return;
    markAllNotificationsRead(user.uid).catch(() => {});
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Build sections: no-leídas primero dentro de cada sección,
  // y las secciones que tienen no-leídas van antes de las totalmente leídas.
  // Dentro de cada grupo, se ordena por la notificación más reciente
  // (no-leída o leída) para que la sección más nueva aparezca siempre primera.
  const buildSections = () => {
    const typeOrder = ["mention", "invitation", "task", "group"];
    const sortItems = (items) =>
      [...items].sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1; // unread primero
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });

    if (activeFilter !== "all") {
      const items = notifications.filter((n) => n.type === activeFilter);
      if (!items.length) return [];
      return [{ type: activeFilter, data: sortItems(items) }];
    }

    const all = typeOrder
      .map((type) => ({
        type,
        data: sortItems(notifications.filter((n) => n.type === type)),
      }))
      .filter((sec) => sec.data.length > 0);

    const withUnread = all.filter((s) => s.data.some((n) => !n.read));
    const allRead = all.filter((s) => s.data.every((n) => n.read));

    // Secciones con no-leídas: ordenar por la fecha del no-leído más reciente
    // → la sección cuya notificación más nueva fue recibida aparece primero.
    withUnread.sort((a, b) => {
      const aDate = a.data.find((n) => !n.read)?.createdAt || "";
      const bDate = b.data.find((n) => !n.read)?.createdAt || "";
      return bDate.localeCompare(aDate);
    });

    // Secciones totalmente leídas: ordenar por la notificación más reciente
    allRead.sort((a, b) => {
      const aDate = a.data[0]?.createdAt || "";
      const bDate = b.data[0]?.createdAt || "";
      return bDate.localeCompare(aDate);
    });

    return [...withUnread, ...allRead];
  };

  const sections = buildSections();
  const visibleCount = sections.reduce((acc, s) => acc + s.data.length, 0);

  // Cada vez que el tab recibe foco: ir al tope si hay no-leídas
  // (offset 0 = primera no-leída, porque buildSections las pone arriba)
  useFocusEffect(
    useCallback(() => {
      if (loading || !unreadCount) return;
      setTimeout(() => {
        listRef.current?.scrollToLocation({
          sectionIndex: 0,
          itemIndex: 0,
          animated: false,
          viewOffset: 0,
        });
      }, 150);
    }, [loading, unreadCount]),
  );

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View
        style={[
          s.header,
          {
            backgroundColor: theme.dark ? "#312E81" : "#4F46E5",
            paddingTop: insets.top + 12,
          },
        ]}
      >
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Text style={s.headerTitle}>{t("notifications")}</Text>
            {unreadCount > 0 && (
              <View style={s.headerBadge}>
                <Text style={s.headerBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={s.markAllBtn}
              onPress={handleMarkAll}
              activeOpacity={0.7}
            >
              <CheckCheck color="rgba(255,255,255,0.9)" size={18} />
              <Text style={s.markAllText}>{t("readAll")}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={s.headerSub}>
          {notifications.length === 0
            ? t("noNotifications")
            : t("notificationsCountMany", { n: notifications.length })}
        </Text>
      </View>

      {/* Filter tabs — AppText: respeta escala de texto, fuente dislexia y
          narrador (onTouchStart pasivo, no roba el responder del TouchableOpacity).
          adjustsFontSizeToFit permite crecer con accesibilidad y ajustarse al
          ancho del tab sin desbordar. ScrollView horizontal evita que los tabs
          se rompan en varias filas cuando el texto aumenta. */}
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
          {TYPES.map((type) => {
            const active = activeFilter === type;
            const cfg = SECTION_CONFIG[type];
            const activeColor = cfg?.color || "#4F46E5";
            const unread =
              type === "all"
                ? unreadCount
                : notifications.filter((n) => n.type === type && !n.read)
                    .length;
            const label =
              type === "all" ? t("allNotifications") : t(cfg.tabLabelKey);

            return (
              <TouchableOpacity
                key={type}
                style={[s.tab, active && { borderBottomColor: activeColor }]}
                onPress={() => setActiveFilter(type)}
                activeOpacity={0.7}
              >
                {cfg && (
                  <cfg.icon
                    color={active ? activeColor : theme.textMuted}
                    size={13}
                  />
                )}
                <Text
                  style={[
                    s.tabText,
                    { color: active ? activeColor : theme.textMuted },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {label}
                </Text>
                {unread > 0 && (
                  <View
                    style={[
                      s.tabBadge,
                      {
                        backgroundColor: active
                          ? activeColor
                          : theme.dark
                            ? "#4B5563"
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
                      {unread}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#4F46E5" size="large" />
        </View>
      ) : visibleCount === 0 ? (
        <View style={s.center}>
          <Bell color={theme.textMuted} size={52} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>
            {t("noNotifications")}
          </Text>
          <Text style={[s.emptyHint, { color: theme.textMuted }]}>
            {activeFilter === "all"
              ? t("notificationEmptyAllHint")
              : activeFilter === "mention"
                ? t("notificationEmptyMentionsHint")
                : t("notificationEmptyForType")}
          </Text>
        </View>
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            s.list,
            { paddingBottom: insets.bottom + 16 },
          ]}
          stickySectionHeadersEnabled={false}
          onScrollToIndexFailed={() => {}}
          renderSectionHeader={({ section }) => {
            // Mostrar header solo en "Todas" (cada filtro específico ya implica el tipo)
            if (activeFilter !== "all") return null;
            const cfg = SECTION_CONFIG[section.type];
            if (!cfg) return null;
            const Icon = cfg.icon;
            const sectionUnread = section.data.filter((n) => !n.read).length;
            return (
              <View
                style={[
                  s.sectionHeader,
                  { backgroundColor: theme.dark ? cfg.bgDark : cfg.bg },
                ]}
              >
                <Icon color={cfg.color} size={14} />
                <Text style={[s.sectionLabel, { color: cfg.color }]}>
                  {t(cfg.labelKey).toUpperCase()}
                </Text>
                {sectionUnread > 0 && (
                  <View
                    style={[s.sectionBadge, { backgroundColor: cfg.color }]}
                  >
                    <Text style={s.sectionBadgeText}>
                      {sectionUnread} {t("unread")}
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
          renderItem={({ item }) => (
            <NotifItem
              item={item}
              onPress={handlePress}
              theme={theme}
              isDark={theme.dark}
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#FFF" },
  headerBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  headerBadgeText: { color: "#FFF", fontWeight: "700", fontSize: 12 },
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 2 },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
  },
  markAllText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
  },

  // Tabs
  tabsWrapper: {
    borderBottomWidth: 1,
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  tab: {
    minWidth: 84,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 11,
    paddingHorizontal: 10,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
    lineHeight: 16,
  },
  tabBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  tabBadgeText: { fontSize: 11, fontWeight: "700" },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    flex: 1,
  },
  sectionBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  sectionBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "700" },

  // List
  list: { padding: 12, gap: 0 },
  // itemOuter: contenedor visual (borde, borderRadius, overflow:hidden, sombra).
  // overflow:'hidden' recorta la barra y el contenido a las esquinas redondeadas
  // sin necesitar borderRadius en cada hijo.
  itemOuter: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  // Zona izquierda del indicador de no-leído: columna centrada.
  unreadZone: {
    width: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  // Pill redondeado: ocupa ~60% de la altura del card, centrado verticalmente.
  unreadPill: {
    width: 4,
    height: 36,
    borderRadius: 4,
  },
  // item: solo área de toque + padding + layout interno. Sin borde ni borderRadius
  // (los maneja itemOuter).
  item: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemBody: { flex: 1, minWidth: 0, gap: 3 },
  itemTitle: { fontSize: 12 },
  itemDesc: { fontSize: 14, lineHeight: 20 },
  // width fijo en itemRight para que el cambio "Ahora"→"1m" no cause
  // re-layout del texto y deje espacio fantasma de la línea anterior.
  itemRight: { alignItems: "flex-end", gap: 6, flexShrink: 0, width: 40 },
  timeText: { fontSize: 11, textAlign: "right" },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // Empty / loading
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
