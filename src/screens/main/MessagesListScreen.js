// MESSAGES LIST SCREEN - StudySync
import React, { useState, useEffect, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Text from "../../components/AppText";
import GroupAvatar from "../../components/GroupAvatar";
import { useAccessibility } from "../../contexts/AccessibilityContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import * as firestoreService from "../../services/firestoreService";
import { MessageSquare } from "lucide-react-native";

export default function MessagesListScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useAccessibility();
  const insets = useSafeAreaInsets();

  // Estado visible — solo se actualiza cuando el orden ya es estable
  const [sortedGroups, setSortedGroups] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [typingGroups, setTypingGroups] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [avatarRenderTick, setAvatarRenderTick] = useState(0);

  // Refs: se actualizan sin provocar renders
  const groupsRef = useRef([]);
  const lastMsgsRef = useRef({});
  const msgsReadyRef = useRef(new Set());
  const initialDone = useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      setAvatarRenderTick((v) => v + 1);
    }, []),
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const msgUnsubs = {};
    const typingUnsubs = {};

    const applySort = () => {
      const sorted = [...groupsRef.current].sort((a, b) => {
        const ta = lastMsgsRef.current[a.id]?.createdAt
          ? new Date(lastMsgsRef.current[a.id].createdAt).getTime() : 0;
        const tb = lastMsgsRef.current[b.id]?.createdAt
          ? new Date(lastMsgsRef.current[b.id].createdAt).getTime() : 0;
        return tb - ta;
      });
      setSortedGroups(sorted);
    };

    const unsub = firestoreService.getMyGroups(user.uid, (fetchedGroups) => {
      if (cancelled) return;
      groupsRef.current = fetchedGroups;

      // Sin grupos: listo inmediatamente
      if (fetchedGroups.length === 0) {
        initialDone.current = true;
        setSortedGroups([]);
        setIsReady(true);
        return;
      }

      // Si ya hicimos el sort inicial, solo actualizar el ref de grupos y re-ordenar
      if (initialDone.current) {
        applySort();
      }

      const currentIds = new Set(fetchedGroups.map((g) => g.id));

      Object.keys(msgUnsubs).forEach((id) => {
        if (!currentIds.has(id)) { msgUnsubs[id](); delete msgUnsubs[id]; }
      });
      Object.keys(typingUnsubs).forEach((id) => {
        if (!currentIds.has(id)) { typingUnsubs[id](); delete typingUnsubs[id]; }
      });

      fetchedGroups.forEach((g) => {
        if (!msgUnsubs[g.id]) {
          msgUnsubs[g.id] = firestoreService.onLastMessage(g.id, (lastMsg) => {
            if (cancelled) return;

            lastMsgsRef.current = { ...lastMsgsRef.current, [g.id]: lastMsg };
            const isFirstTime = !msgsReadyRef.current.has(g.id);
            msgsReadyRef.current.add(g.id);

            // Actualizar texto/unread del item (no afecta el orden)
            setLastMessages((prev) => ({ ...prev, [g.id]: lastMsg }));
            setUnreadCounts((prev) => ({
              ...prev,
              [g.id]: lastMsg?.readBy && !lastMsg.readBy.includes(user.uid) ? 1 : 0,
            }));

            if (!initialDone.current) {
              // Esperar a que TODOS los grupos tengan su primer snapshot
              if (msgsReadyRef.current.size >= groupsRef.current.length) {
                initialDone.current = true;
                applySort();
                setIsReady(true); // mostrar lista ya ordenada, de golpe
              }
              // mientras falta alguno → no mostrar nada todavía
            } else if (!isFirstTime) {
              // Mensaje nuevo tras la carga inicial → re-ordenar (esperado)
              applySort();
            }
          });
        }

        if (!typingUnsubs[g.id]) {
          typingUnsubs[g.id] = firestoreService.onTypingStatus(g.id, user.uid, (ids) => {
            if (cancelled) return;
            setTypingGroups((prev) => ({ ...prev, [g.id]: ids }));
          });
        }
      });
    });

    return () => {
      cancelled = true;
      unsub();
      Object.values(msgUnsubs).forEach((fn) => fn());
      Object.values(typingUnsubs).forEach((fn) => fn());
    };
  }, [user]);

  const renderGroupChat = ({ item: group }) => {
    const lastMsg = lastMessages[group.id];
    const isUnread = (unreadCounts[group.id] || 0) > 0;
    const isTyping = (typingGroups[group.id]?.length || 0) > 0;
    // Al enviar mensaje cambia lastMessage: mismo grupo/perfil visual pero hay que remontar el avatar (SVG/Image reciclados).
    const lastStamp = lastMsg?.id || lastMsg?.createdAt || "";

    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: theme.card, borderColor: isUnread ? '#A5B4FC' : theme.border }, isUnread && s.cardUnread]}
        onPress={() =>
          navigation.navigate("Chat", {
            groupId: group.id,
            groupName: group.name,
            groupPhotoURL: group.photoURL,
          })}
        activeOpacity={0.7}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Chat: ${group.name}${isUnread ? ', mensaje sin leer' : ''}`}
        accessibilityHint="Doble toque para abrir el chat"
      >
        <View style={s.row}>
          <View style={s.leftSection}>
            <GroupAvatar
              key={`gav-${avatarRenderTick}-${group.id}-${String(group.photoURL || "").trim()}-${lastStamp}`}
              photoURL={group.photoURL}
              name={group.name}
              size={44}
              style={isUnread ? { borderWidth: 2, borderColor: '#4F46E5' } : undefined}
            />
            {/* Abajo-derecha: arriba tapaba el ícono (birrete) en avatares sin foto */}
            {isUnread && <View style={[s.unreadDot, { borderColor: theme.card }]} />}
          </View>
          <View style={s.textSection}>
            <Text
              style={[s.groupName, { color: theme.text }, isUnread && { fontWeight: '800' }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {group.name}
            </Text>
            <Text
              style={[s.lastMsg, { color: isTyping ? '#4F46E5' : theme.textSecondary }, isUnread && !isTyping && { fontWeight: '600', color: theme.text }]}
              numberOfLines={1}
            >
              {isTyping ? 'escribiendo...' : (lastMsg ? lastMsg.text : t('noMessagesYet'))}
            </Text>
          </View>
          <View style={s.rightSection}>
            {lastMsg && (
              <Text style={[s.time, { color: isUnread ? '#4F46E5' : theme.textMuted }, isUnread && { fontWeight: '700' }]}>
                {lastMsg.time || ""}
              </Text>
            )}
            {isUnread && (
              <View style={s.badge}>
                <Text style={s.badgeText}>1</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <View style={[s.header, { backgroundColor: theme.headerBg }]}>
        <Text style={s.headerTitle}>{t('messages')}</Text>
      </View>

      {!isReady ? (
        // Lista aún cargando — no mostrar nada para evitar saltos de orden
        <View style={s.center}>
          <ActivityIndicator color="#4F46E5" size="large" />
        </View>
      ) : (
        <FlatList
          data={sortedGroups}
          keyExtractor={(item) => item.id}
          renderItem={renderGroupChat}
          extraData={{ lastMessages, typingGroups, unreadCounts }}
          removeClippedSubviews={false}
          contentContainerStyle={[s.list, { flexGrow: 1, paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <MessageSquare color={theme.textMuted} size={52} />
              <Text style={[s.emptyTitle, { color: theme.text }]}>Sin mensajes</Text>
              <Text style={[s.emptyHint, { color: theme.textMuted }]}>
                Únete a un grupo de estudio y los chats aparecerán aquí.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 48,
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFF" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 8 },
  card: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    elevation: 1,
  },
  cardUnread: { borderColor: "#A5B4FC", elevation: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  leftSection: { position: "relative", marginRight: 12, flexShrink: 0 },
  unreadDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  textSection: { flex: 1, minWidth: 0 },
  groupName: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  groupNameUnread: { fontWeight: "800", color: "#111827" },
  lastMsg: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  lastMsgUnread: { fontWeight: "600", color: "#1F2937" },
  rightSection: { alignItems: "flex-end", gap: 6 },
  time: { fontSize: 11, color: "#9CA3AF" },
  timeUnread: { color: "#4F46E5", fontWeight: "700" },
  badge: {
    backgroundColor: "#4F46E5",
    borderRadius: 10,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#FFF" },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyHint:  { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
