// MESSAGES LIST SCREEN - StudySync (Migración L613-680)
import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
} from "react-native";
import Text from "../../components/AppText";
import GroupAvatar from "../../components/GroupAvatar";
import { useAccessibility } from "../../contexts/AccessibilityContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import * as firestoreService from "../../services/firestoreService";

export default function MessagesListScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useAccessibility();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const unsub = firestoreService.getMyGroups(
      user.uid,
      async (fetchedGroups) => {
        if (cancelled) return;
        setGroups(fetchedGroups);
        try {
          const results = await Promise.all(
            fetchedGroups.map(async (g) => {
              try {
                const lastMsg = await firestoreService.getLastMessage(g.id);
                return { id: g.id, lastMsg };
              } catch {
                return { id: g.id, lastMsg: null };
              }
            }),
          );
          if (cancelled) return;
          const msgs = {};
          const unreads = {};
          results.forEach(({ id, lastMsg }) => {
            msgs[id] = lastMsg;
            unreads[id] =
              lastMsg && lastMsg.readBy && !lastMsg.readBy.includes(user.uid)
                ? 1
                : 0;
          });
          setLastMessages(msgs);
          setUnreadCounts(unreads);
        } catch (e) {
          console.error("Error cargando últimos mensajes:", e);
        }
      },
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  const renderGroupChat = ({ item: group }) => {
    const lastMsg = lastMessages[group.id];
    const isUnread = (unreadCounts[group.id] || 0) > 0;

    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }, isUnread && s.cardUnread]}
        onPress={() => navigation.navigate("Chat", { groupId: group.id })}
        activeOpacity={0.7}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Chat: ${group.name}${isUnread ? ', mensaje sin leer' : ''}`}
        accessibilityHint="Doble toque para abrir el chat"
      >
        <View style={s.row}>
          <View style={s.leftSection}>
            <GroupAvatar
              photoURL={group.photoURL}
              name={group.name}
              size={44}
              showInitials={true}
              style={isUnread ? { borderWidth: 2, borderColor: '#4F46E5' } : undefined}
            />
            {isUnread && <View style={s.unreadDot} />}
          </View>
          <View style={s.textSection}>
            <Text
              style={[s.groupName, { color: theme.text }, isUnread && s.groupNameUnread]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {group.name}
            </Text>
            <Text
              style={[s.lastMsg, { color: theme.textSecondary }, isUnread && s.lastMsgUnread]}
              numberOfLines={1}
            >
              {lastMsg ? lastMsg.text : t('noMessagesYet')}
            </Text>
          </View>
          <View style={s.rightSection}>
            {lastMsg && (
              <Text style={[s.time, { color: theme.textMuted }, isUnread && s.timeUnread]}>
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
      <StatusBar barStyle="light-content" backgroundColor={theme.headerBg} />
      <View style={[s.header, { backgroundColor: theme.headerBg }]}>
        <Text style={s.headerTitle}>{t('messages')}</Text>
      </View>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupChat}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: theme.textSecondary }]}>{t('noGroupsYet')}</Text>
          </View>
        }
      />
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
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    elevation: 1,
    marginBottom: 12,
  },
  cardUnread: { borderColor: "#A5B4FC", elevation: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  leftSection: { position: "relative", marginRight: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarUnread: { backgroundColor: "#4F46E5" },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#4F46E5" },
  avatarTextUnread: { color: "#FFF" },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
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
  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 14, color: "#6B7280" },
});
