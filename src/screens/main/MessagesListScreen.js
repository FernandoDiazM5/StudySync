// MESSAGES LIST SCREEN - StudySync (Migración L613-680)
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, StatusBar } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import * as firestoreService from '../../services/firestoreService';

export default function MessagesListScreen({ navigation }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const unsub = firestoreService.getMyGroups(user.uid, async (fetchedGroups) => {
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
          })
        );
        if (cancelled) return;
        const msgs = {};
        const unreads = {};
        results.forEach(({ id, lastMsg }) => {
          msgs[id] = lastMsg;
          unreads[id] = lastMsg && lastMsg.readBy && !lastMsg.readBy.includes(user.uid) ? 1 : 0;
        });
        setLastMessages(msgs);
        setUnreadCounts(unreads);
      } catch (e) {
        console.error('Error cargando últimos mensajes:', e);
      }
    });

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
        style={[s.card, isUnread && s.cardUnread]}
        onPress={() => navigation.navigate('Chat', { groupId: group.id })}
        activeOpacity={0.7}
      >
        <View style={s.row}>
          <View style={s.leftSection}>
            <View style={[s.avatar, isUnread && s.avatarUnread]}>
              <Text style={[s.avatarText, isUnread && s.avatarTextUnread]}>{group.name.charAt(0)}</Text>
            </View>
            {isUnread && <View style={s.unreadDot} />}
          </View>
          <View style={s.textSection}>
            <Text style={[s.groupName, isUnread && s.groupNameUnread]}>{group.name}</Text>
            <Text style={[s.lastMsg, isUnread && s.lastMsgUnread]} numberOfLines={1}>
              {lastMsg ? lastMsg.text : 'No hay mensajes aún'}
            </Text>
          </View>
          <View style={s.rightSection}>
            {lastMsg && <Text style={[s.time, isUnread && s.timeUnread]}>{lastMsg.time || ''}</Text>}
            {isUnread && <View style={s.badge}><Text style={s.badgeText}>1</Text></View>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />
      <View style={s.header}><Text style={s.headerTitle}>Mensajes</Text></View>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupChat}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyText}>No perteneces a ningún grupo aún.</Text></View>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#4F46E5', paddingHorizontal: 16, paddingVertical: 16, paddingTop: 48, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 16, elevation: 1, marginBottom: 12 },
  cardUnread: { borderColor: '#A5B4FC', elevation: 3 },
  row: { flexDirection: 'row', alignItems: 'center' },
  leftSection: { position: 'relative', marginRight: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  avatarUnread: { backgroundColor: '#4F46E5' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#4F46E5' },
  avatarTextUnread: { color: '#FFF' },
  unreadDot: { position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#FFF' },
  textSection: { flex: 1 },
  groupName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  groupNameUnread: { fontWeight: '800', color: '#111827' },
  lastMsg: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  lastMsgUnread: { fontWeight: '600', color: '#1F2937' },
  rightSection: { alignItems: 'flex-end', gap: 6 },
  time: { fontSize: 11, color: '#9CA3AF' },
  timeUnread: { color: '#4F46E5', fontWeight: '700' },
  badge: { backgroundColor: '#4F46E5', borderRadius: 10, minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, color: '#6B7280' },
});
