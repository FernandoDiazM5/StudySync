// ============================================
// CHAT SCREEN - StudySync
// Input fijo al teclado + chat ocupa toda la pantalla
// ============================================

import React, { useState, useEffect, useRef } from "react";
import {
  Animated,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Keyboard,
  Modal,
  Alert,
  Vibration,
} from "react-native";
import Text from "../../components/AppText";
import GroupAvatar from "../../components/GroupAvatar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Send, Star, UsersRound, MoreVertical, Pencil, Trash2, BarChart2, Shuffle, Plus, X } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAccessibility } from "../../contexts/AccessibilityContext";
import * as firestoreService from "../../services/firestoreService";
import { formatTime } from "../../utils/dateUtils";

export default function ChatScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useAccessibility();
  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [showOnline, setShowOnline] = useState(false);
  const keyboardAnim = useRef(new Animated.Value(0)).current;
  const sendAnim = useRef(new Animated.Value(0)).current;
  const [actionMsg, setActionMsg] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  // Extra menu
  const [showExtraMenu, setShowExtraMenu] = useState(false);
  // Poll
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  // Roulette
  const [showRouletteModal, setShowRouletteModal] = useState(false);
  const [rouletteTitle, setRouletteTitle] = useState("");
  const [rouletteItems, setRouletteItems] = useState(["", ""]);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState(null);
  const [rouletteCurrent, setRouletteCurrent] = useState("");
  const rouletteTimerRef = useRef(null);
  const inputValueRef = useRef("");
  const textInputRef = useRef(null);
  const flatListRef = useRef(null);

  // Cargar grupo y mensajes
  useEffect(() => {
    let cancelled = false;
    let unsubOnline = () => {};

    const loadGroup = async () => {
      try {
        const groupData = await firestoreService.getGroup(groupId);
        if (cancelled) return;
        setGroup(groupData);

        if (groupData?.members) {
          const memberData = await firestoreService.getUsersByIds(
            groupData.members,
          );
          if (cancelled) return;
          setMembers(memberData);

          // Escuchar miembros en línea
          unsubOnline = firestoreService.getOnlineMembers(
            groupId,
            groupData.members,
            (online) => { if (!cancelled) setOnlineMembers(online); }
          );
        }
      } catch (e) {
        console.error("Error cargando grupo:", e);
      }
    };
    loadGroup();

    // Marcar presencia
    if (user?.uid) {
      firestoreService.setUserPresence(user.uid, groupId).catch(() => {});

      // Refrescar presencia cada 90 segundos
      const presenceInterval = setInterval(() => {
        if (!cancelled) firestoreService.setUserPresence(user.uid, groupId).catch(() => {});
      }, 90000);

      var clearPresence = () => {
        clearInterval(presenceInterval);
        firestoreService.clearUserPresence(user.uid).catch(() => {});
      };
    }

    const unsubMessages = firestoreService.getGroupMessages(
      groupId,
      (fetchedMessages) => {
        if (cancelled) return;
        setMessages(fetchedMessages);
      },
    );

    if (user?.uid) {
      firestoreService
        .markMessagesAsRead(groupId, user.uid)
        .catch((e) => console.error("Error marcando mensajes como leídos:", e));
    }

    return () => {
      cancelled = true;
      unsubMessages();
      unsubOnline();
      clearPresence?.();
      if (rouletteTimerRef.current) clearTimeout(rouletteTimerRef.current);
    };
  }, [groupId, user]);

  // Android: mover input cuando el teclado aparece/desaparece
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      keyboardAnim.setValue(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardAnim.setValue(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  const handleSend = async () => {
    const textToSend = inputValueRef.current.trim();
    if (!textToSend) return;

    textInputRef.current?.clear();
    inputValueRef.current = "";
    sendAnim.setValue(0);

    try {
      await firestoreService.sendMessage({
        groupId,
        authorId: user.uid,
        text: textToSend,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        important: false,
      });
    } catch (e) {
      console.error("Error enviando mensaje:", e);
    }
    textInputRef.current?.focus();
  };

  const handleToggleImportant = async (msgId, currentValue) => {
    await firestoreService.toggleMessageImportant(msgId, currentValue);
  };

  const handleLongPress = (msg) => {
    if (msg.authorId !== user.uid) return; // solo mensajes propios
    Vibration.vibrate(40);
    setActionMsg(msg);
  };

  const handleStartEdit = () => {
    setEditText(actionMsg.text);
    setEditingMsg(actionMsg);
    setActionMsg(null);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText.trim() === editingMsg.text) {
      setEditingMsg(null);
      return;
    }
    setEditLoading(true);
    try {
      await firestoreService.editMessage(editingMsg.id, editText);
    } catch (e) {
      console.error("Error editando mensaje:", e);
    }
    setEditLoading(false);
    setEditingMsg(null);
  };

  const handleDelete = () => {
    const msg = actionMsg;
    setActionMsg(null);
    Alert.alert(
      t('deleteMessage'),
      t('deleteMessageConfirm'),
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('delete'),
          style: "destructive",
          onPress: async () => {
            try {
              await firestoreService.deleteMessage(msg.id);
            } catch (e) {
              console.error("Error eliminando mensaje:", e);
            }
          },
        },
      ]
    );
  };

  // ── Poll ─────────────────────────────────────────────────────
  const handleSendPoll = async () => {
    const validOptions = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) return;
    const votes = {};
    validOptions.forEach((_, i) => { votes[String(i)] = []; });
    await firestoreService.sendMessage({
      groupId,
      authorId: user.uid,
      type: "poll",
      question: pollQuestion.trim(),
      options: validOptions.map((o) => o.trim()),
      votes,
      text: `📊 Encuesta: ${pollQuestion.trim()}`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      important: false,
    });
    setPollQuestion("");
    setPollOptions(["", ""]);
    setShowPollModal(false);
  };

  const handleVotePoll = async (messageId, optionIndex) => {
    await firestoreService.votePoll(messageId, optionIndex, user.uid);
  };

  // ── Roulette ─────────────────────────────────────────────────
  const handleSpin = () => {
    const items = rouletteItems.filter((i) => i.trim());
    if (items.length < 2) return;
    setRouletteSpinning(true);
    setRouletteResult(null);
    const winner = items[Math.floor(Math.random() * items.length)];
    let tick = 0;
    const totalTicks = 26;
    const next = () => {
      tick++;
      if (tick < totalTicks) {
        setRouletteCurrent(items[Math.floor(Math.random() * items.length)]);
        const delay = 50 + Math.pow(tick / totalTicks, 2) * 500;
        rouletteTimerRef.current = setTimeout(next, delay);
      } else {
        setRouletteCurrent(winner);
        setRouletteResult(winner);
        setRouletteSpinning(false);
      }
    };
    rouletteTimerRef.current = setTimeout(next, 50);
  };

  const toggleMemberInRoulette = (memberName) => {
    const already = rouletteItems.findIndex((i) => i === memberName);
    if (already >= 0) {
      const updated = rouletteItems.filter((i) => i !== memberName);
      setRouletteItems(updated.length >= 2 ? updated : [...updated, ...Array(2 - updated.length).fill("")]);
    } else {
      const emptyIdx = rouletteItems.findIndex((i) => !i.trim());
      if (emptyIdx >= 0) {
        const arr = [...rouletteItems];
        arr[emptyIdx] = memberName;
        setRouletteItems(arr);
      } else {
        setRouletteItems([...rouletteItems, memberName]);
      }
    }
  };

  const handleSendRouletteResult = async () => {
    if (!rouletteResult) return;
    const validItems = rouletteItems.filter((i) => i.trim());
    await firestoreService.sendMessage({
      groupId,
      authorId: user.uid,
      type: "roulette",
      rouletteTitle: rouletteTitle.trim() || null,
      rouletteWinner: rouletteResult,
      rouletteItems: validItems,
      text: `🎡 Sorteo: ${rouletteResult}`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      important: false,
    });
    setShowRouletteModal(false);
    setRouletteResult(null);
    setRouletteCurrent("");
    setRouletteItems(["", ""]);
    setRouletteTitle("");
  };

  const getMemberName = (authorId) => {
    const member = members.find((m) => m.id === authorId);
    return member?.name || "Usuario";
  };

  const isLeaderMember = (authorId) => group?.leaderId === authorId;

  // ── Separadores de fecha ──────────────────────────────────────
  const getDateKey = (createdAt) => {
    if (!createdAt) return "unknown";
    return createdAt.split("T")[0]; // YYYY-MM-DD
  };

  const formatSeparatorLabel = (dateKey) => {
    if (dateKey === "unknown") return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const date = new Date(dateKey + "T00:00:00");
    if (date.toDateString() === today.toDateString()) return "Hoy";
    if (date.toDateString() === yesterday.toDateString()) return "Ayer";
    if (date.getFullYear() === today.getFullYear())
      return date.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  };

  const buildMessageList = (msgs) => {
    const result = [];
    let lastDate = null;
    for (const msg of msgs) {
      const dateKey = getDateKey(msg.createdAt);
      if (dateKey !== lastDate) {
        result.push({ type: "separator", id: `sep_${dateKey}`, label: formatSeparatorLabel(dateKey) });
        lastDate = dateKey;
      }
      result.push(msg);
    }
    return result;
  };

  const renderPollMessage = (msg) => {
    const totalVotes = Object.values(msg.votes || {}).reduce((s, arr) => s + arr.length, 0);
    const myVote = Object.keys(msg.votes || {}).find((k) =>
      (msg.votes[k] || []).includes(user.uid)
    );
    return (
      <View style={styles.specialMsgWrapper}>
        <View style={[styles.pollBubble, { backgroundColor: theme.card, borderColor: "#6366F1" }]}>
          <View style={styles.pollHeader}>
            <BarChart2 color="#6366F1" size={14} />
            <Text style={[styles.pollLabel, { color: "#6366F1" }]}>ENCUESTA</Text>
          </View>
          <Text style={[styles.pollQuestion, { color: theme.text }]}>{msg.question}</Text>
          {(msg.options || []).map((opt, i) => {
            const count = (msg.votes?.[String(i)] || []).length;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const voted = myVote === String(i);
            return (
              <TouchableOpacity
                key={i}
                style={[styles.pollOption, { borderColor: voted ? "#6366F1" : theme.border, backgroundColor: theme.input }]}
                onPress={() => handleVotePoll(msg.id, i)}
                activeOpacity={0.7}
              >
                <View style={styles.pollOptionTop}>
                  <Text style={[styles.pollOptionText, { color: voted ? "#6366F1" : theme.text }]} numberOfLines={1}>{opt}</Text>
                  <Text style={[styles.pollPct, { color: voted ? "#6366F1" : theme.textMuted }]}>{pct}%</Text>
                </View>
                <View style={[styles.pollBarTrack, { backgroundColor: isDark ? "#374151" : "#E5E7EB" }]}>
                  <View style={[styles.pollBarFill, { width: `${pct}%`, backgroundColor: voted ? "#6366F1" : "#A5B4FC" }]} />
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={[styles.pollTotal, { color: theme.textMuted }]}>{totalVotes} {totalVotes === 1 ? "voto" : "votos"}</Text>
        </View>
      </View>
    );
  };

  const renderRouletteMessage = (msg) => (
    <View style={styles.rouletteMsgWrapper}>
      <View style={[styles.rouletteBubble, { backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF", borderColor: "#6366F1" }]}>
        {/* Header */}
        <View style={styles.rouletteHeaderRow}>
          <Text style={styles.rouletteEmoji}>🎡</Text>
          <View style={{ flex: 1 }}>
            {msg.rouletteTitle ? (
              <Text style={[styles.rouletteMsgTitle, { color: "#4F46E5" }]}>{msg.rouletteTitle}</Text>
            ) : (
              <Text style={[styles.rouletteMsgTitle, { color: "#4F46E5" }]}>{t('rouletteTitle')}</Text>
            )}
            <Text style={[styles.rouletteMsgSub, { color: theme.textSecondary }]}>
              Lanzado por {getMemberName(msg.authorId)}
            </Text>
          </View>
        </View>

        {/* Lista de participantes */}
        {(msg.rouletteItems || []).length > 0 && (
          <View style={[styles.rouletteList, { borderColor: isDark ? "#312E81" : "#C7D2FE" }]}>
            {(msg.rouletteItems || []).map((item, i) => {
              const isWinner = item === msg.rouletteWinner;
              return (
                <View
                  key={i}
                  style={[
                    styles.rouletteListItem,
                    isWinner && { backgroundColor: isDark ? "#312E81" : "#E0E7FF" },
                  ]}
                >
                  <Text style={[styles.rouletteListNum, { color: isWinner ? "#4F46E5" : theme.textMuted }]}>
                    {i + 1}.
                  </Text>
                  <Text
                    style={[
                      styles.rouletteListText,
                      { color: isWinner ? "#4F46E5" : theme.text },
                      isWinner && { fontWeight: "700" },
                    ]}
                  >
                    {item}
                  </Text>
                  {isWinner && <Text style={styles.rouletteCrown}>👑</Text>}
                </View>
              );
            })}
          </View>
        )}

        {/* Ganador destacado */}
        <View style={[styles.rouletteWinnerBox, { backgroundColor: isDark ? "#312E81" : "#DDD6FE" }]}>
          <Text style={[styles.rouletteWinnerLabel, { color: isDark ? "#A5B4FC" : "#4338CA" }]}>¡Le tocó!</Text>
          <Text style={[styles.rouletteWinner, { color: isDark ? "#E0E7FF" : "#3730A3" }]}>
            {msg.rouletteWinner}
          </Text>
        </View>

        <Text style={[styles.rouletteMsgTime, { color: theme.textMuted }]}>
          {msg.time || formatTime(msg.createdAt)}
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item }) => {
    if (item.type === "separator") {
      return (
        <View style={styles.dateSeparator}>
          <View style={[styles.dateSeparatorLine, { backgroundColor: isDark ? "#374151" : "#D1D5DB" }]} />
          <View style={[styles.dateSeparatorChip, { backgroundColor: isDark ? "#374151" : "#E5E7EB" }]}>
            <Text style={[styles.dateSeparatorText, { color: theme.textSecondary }]}>{item.label}</Text>
          </View>
          <View style={[styles.dateSeparatorLine, { backgroundColor: isDark ? "#374151" : "#D1D5DB" }]} />
        </View>
      );
    }
    if (item.type === "poll") return renderPollMessage(item);
    if (item.type === "roulette") return renderRouletteMessage(item);
    return renderMessage({ item });
  };

  const renderMessage = ({ item: msg }) => {
    const isMe = msg.authorId === user.uid;
    const authorName = getMemberName(msg.authorId);
    const isLeader = isLeaderMember(msg.authorId);

    return (
      <View
        style={[
          styles.messageWrapper,
          isMe ? styles.messageWrapperMe : styles.messageWrapperOther,
        ]}
      >
        {!isMe && (
          <Text style={[styles.authorName, { color: theme.textSecondary }]}>
            {authorName} {isLeader ? `(${t('leader')})` : ""}
          </Text>
        )}
        <TouchableOpacity
          onLongPress={() => handleLongPress(msg)}
          activeOpacity={0.85}
          delayLongPress={350}
        >
          <View
            style={[styles.bubble, isMe ? styles.bubbleMe : [styles.bubbleOther, { backgroundColor: theme.card, borderColor: theme.border }]]}
          >
            <View style={styles.messageTextContainer}>
              <Text style={[styles.messageText, isMe ? styles.messageTextMe : { color: theme.text }]}>
                {msg.text.split(/(@\w+)/g).map((part, index) =>
                  part.startsWith("@") ? (
                    <Text key={index} style={styles.mention}>{part}</Text>
                  ) : (
                    <Text key={index}>{part}</Text>
                  ),
                )}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleToggleImportant(msg.id, msg.important)}
              style={styles.starButtonAbsolute}
            >
              <Star
                color={
                  msg.important
                    ? "#FACC15"
                    : isMe
                      ? "rgba(165,180,252,0.5)"
                      : "#D1D5DB"
                }
                size={16}
                fill={msg.important ? "#FACC15" : "none"}
              />
            </TouchableOpacity>
            <View style={styles.messageFooter}>
              {msg.edited && (
                <Text style={[styles.editedLabel, isMe ? styles.editedLabelMe : styles.editedLabelOther]}>
                  editado
                </Text>
              )}
              <Text
                style={[
                  styles.messageTime,
                  isMe ? styles.messageTimeMe : styles.messageTimeOther,
                ]}
              >
                {msg.time || formatTime(msg.createdAt)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (!group) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDark ? "#111827" : "#E5E7EB" }]}>
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#111827" : "#E5E7EB" }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.headerBg} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ChevronLeft color="#FFFFFF" size={24} />
          </TouchableOpacity>
          <GroupAvatar
            photoURL={group.photoURL}
            name={group.name}
            size={36}
            borderRadius={10}
            style={{ marginRight: 8 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={styles.headerSubtitle}>{t('onlyAcademicTopics')}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowOnline(true)} style={{ marginLeft: 10 }}>
          <UsersRound color="#C7D2FE" size={20} />
          {onlineMembers.length > 0 && (
            <View style={styles.onlineDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* Mensajes */}
      <FlatList
        ref={flatListRef}
        style={styles.messagesContainer}
        data={buildMessageList(messages)}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.messagesList, { paddingBottom: 8 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        nestedScrollEnabled
        keyboardDismissMode="on-drag"
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: false })
        }
        ListHeaderComponent={
          <View style={styles.reminderBanner}>
            <Text style={styles.reminderText}>
              💡 {t('chatReminderMsg')} <Text style={styles.reminderBold}>{group.name}</Text>.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={[styles.emptyChatText, { color: theme.textSecondary }]}>
              {t('chatEmpty')}
            </Text>
          </View>
        }
      />

      {/* Input pegado al teclado */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.bottom : 0}
      >
        <Animated.View
          style={[
            styles.inputBar,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              marginBottom: Platform.OS === "android" ? keyboardAnim : 0,
              backgroundColor: theme.card,
              borderTopColor: theme.border,
            },
          ]}
        >
          <TouchableOpacity style={styles.attachButton} onPress={() => setShowExtraMenu(true)}>
            <MoreVertical color={theme.textMuted} size={22} />
          </TouchableOpacity>
          <View style={[styles.inputWrapper, { backgroundColor: theme.input, borderColor: theme.border }]}>
            <TextInput
              ref={textInputRef}
              style={[styles.textInput, { color: theme.text }]}
              onChangeText={(text) => {
                inputValueRef.current = text;
                sendAnim.setValue(text.trim().length > 0 ? 1 : 0);
              }}
              placeholder={t('writeMessage')}
              placeholderTextColor={theme.textMuted}
              blurOnSubmit={false}
              multiline
              maxLength={500}
              textAlignVertical="top"
              scrollEnabled={false}
              underlineColorAndroid="transparent"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
              <View style={styles.sendIconContainer}>
                <Animated.View style={[{ position: "absolute" }, { opacity: sendAnim }]}>
                  <Send color="#4F46E5" size={20} />
                </Animated.View>
                <Animated.View style={{ opacity: sendAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
                  <Send color="#9CA3AF" size={20} />
                </Animated.View>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Action sheet: editar / eliminar mensaje propio */}
      <Modal
        visible={!!actionMsg}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setActionMsg(null)}
      >
        <TouchableOpacity
          style={styles.actionOverlay}
          activeOpacity={1}
          onPress={() => setActionMsg(null)}
        >
          <View style={[styles.actionSheet, { backgroundColor: theme.card }]}>
            <View style={[styles.actionHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.actionPreview, { color: theme.textMuted }]} numberOfLines={2}>
              {actionMsg?.text}
            </Text>
            <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
            <TouchableOpacity style={styles.actionRow} onPress={handleStartEdit}>
              <Pencil color="#4F46E5" size={20} />
              <Text style={[styles.actionLabel, { color: theme.text }]}>{t('edit') + ' ' + t('messages')}</Text>
            </TouchableOpacity>
            <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
            <TouchableOpacity style={styles.actionRow} onPress={handleDelete}>
              <Trash2 color="#DC2626" size={20} />
              <Text style={[styles.actionLabel, { color: "#DC2626" }]}>{t('deleteMessage')}</Text>
            </TouchableOpacity>
            <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
            <TouchableOpacity style={styles.actionRow} onPress={() => setActionMsg(null)}>
              <Text style={[styles.actionCancel, { color: theme.textSecondary }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal edición de mensaje */}
      <Modal
        visible={!!editingMsg}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setEditingMsg(null)}
      >
        <View style={styles.editOverlay}>
          <View style={[styles.editCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.editTitle, { color: theme.text }]}>{t('edit') + ' ' + t('messages')}</Text>
            <TextInput
              style={[styles.editInput, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              maxLength={500}
              placeholderTextColor={theme.textMuted}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: isDark ? "#374151" : "#F3F4F6" }]}
                onPress={() => setEditingMsg(null)}
                disabled={editLoading}
              >
                <Text style={[styles.editBtnCancel, { color: theme.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editBtn, styles.editBtnSave, editLoading && { opacity: 0.6 }]}
                onPress={handleSaveEdit}
                disabled={editLoading}
              >
                <Text style={styles.editBtnSaveText}>{editLoading ? t('loading') : t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal miembros en línea */}
      <Modal
        visible={showOnline}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowOnline(false)}
      >
        <TouchableOpacity
          style={styles.onlineOverlay}
          activeOpacity={1}
          onPress={() => setShowOnline(false)}
        >
          <View style={[styles.onlinePanel, { backgroundColor: theme.card }]}>
            <Text style={[styles.onlineTitle, { color: "#4F46E5", borderBottomColor: theme.border }]}>{t('groupMembers')}</Text>

            {/* Conectados */}
            <Text style={styles.onlineSectionLabel}>
              🟢 {t('online')} ({onlineMembers.length})
            </Text>
            {onlineMembers.length === 0 ? (
              <Text style={styles.onlineEmpty}>{t('online')} - {t('noMessages')}</Text>
            ) : (
              onlineMembers.map((m) => (
                <View key={m.id} style={styles.onlineMemberRow}>
                  <View style={styles.onlineIndicator} />
                  <Text style={[styles.onlineMemberName, { color: theme.text }]}>{m.name}</Text>
                  {m.id === group?.leaderId && (
                    <View style={styles.onlineLeaderBadge}>
                      <Text style={styles.onlineLeaderText}>{t('leader')}</Text>
                    </View>
                  )}
                </View>
              ))
            )}

            <View style={[styles.onlineDivider, { backgroundColor: theme.border }]} />

            {/* Desconectados */}
            {(() => {
              const onlineIds = onlineMembers.map(m => m.id);
              const offline = members.filter(m => !onlineIds.includes(m.id));
              return (
                <>
                  <Text style={styles.offlineSectionLabel}>
                    ⚫ {t('disconnected')} ({offline.length})
                  </Text>
                  {offline.length === 0 ? (
                    <Text style={styles.onlineEmpty}>{t('allConnected')}</Text>
                  ) : (
                    offline.map((m) => (
                      <View key={m.id} style={styles.onlineMemberRow}>
                        <View style={styles.offlineIndicator} />
                        <Text style={[styles.offlineMemberName, { color: theme.textMuted }]}>{m.name}</Text>
                        {m.id === group?.leaderId && (
                          <View style={styles.onlineLeaderBadge}>
                            <Text style={styles.onlineLeaderText}>{t('leader')}</Text>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </>
              );
            })()}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Menú extra (3 puntos) */}
      <Modal visible={showExtraMenu} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowExtraMenu(false)}>
        <TouchableOpacity style={styles.actionOverlay} activeOpacity={1} onPress={() => setShowExtraMenu(false)}>
          <View style={[styles.actionSheet, { backgroundColor: theme.card }]}>
            <View style={[styles.actionHandle, { backgroundColor: theme.border }]} />
            <TouchableOpacity style={styles.actionRow} onPress={() => { setShowExtraMenu(false); setShowPollModal(true); }}>
              <BarChart2 color="#6366F1" size={22} />
              <Text style={[styles.actionLabel, { color: theme.text }]}>{t('createPoll')}</Text>
            </TouchableOpacity>
            <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
            <TouchableOpacity style={styles.actionRow} onPress={() => { setShowExtraMenu(false); setRouletteTitle(""); setRouletteItems(["", ""]); setRouletteResult(null); setRouletteCurrent(""); setShowRouletteModal(true); }}>
              <Shuffle color="#6366F1" size={22} />
              <Text style={[styles.actionLabel, { color: theme.text }]}>{t('rouletteTitle')}</Text>
            </TouchableOpacity>
            <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
            <TouchableOpacity style={styles.actionRow} onPress={() => setShowExtraMenu(false)}>
              <Text style={[styles.actionCancel, { color: theme.textSecondary }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal encuesta */}
      <Modal visible={showPollModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowPollModal(false)}>
        <View style={styles.editOverlay}>
          <View style={[styles.editCard, { backgroundColor: theme.card, maxHeight: "80%" }]}>
            <View style={styles.modalTitleRow}>
              <BarChart2 color="#6366F1" size={18} />
              <Text style={[styles.editTitle, { color: theme.text }]}>{t('newPoll')}</Text>
              <TouchableOpacity onPress={() => setShowPollModal(false)}>
                <X color={theme.textMuted} size={20} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.editInput, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder={t('pollQuestion')}
              placeholderTextColor={theme.textMuted}
              value={pollQuestion}
              onChangeText={setPollQuestion}
              maxLength={120}
            />
            {pollOptions.map((opt, i) => (
              <View key={i} style={styles.pollOptionRow}>
                <TextInput
                  style={[styles.pollOptionInput, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
                  placeholder={i === 0 ? t('option1') : i === 1 ? t('option2') : `${i + 1}`}
                  placeholderTextColor={theme.textMuted}
                  value={opt}
                  onChangeText={(t) => { const arr = [...pollOptions]; arr[i] = t; setPollOptions(arr); }}
                  maxLength={80}
                />
                {pollOptions.length > 2 && (
                  <TouchableOpacity onPress={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} style={styles.pollRemoveBtn}>
                    <X color="#EF4444" size={16} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {pollOptions.length < 6 && (
              <TouchableOpacity style={[styles.addOptionBtn, { borderColor: theme.border }]} onPress={() => setPollOptions([...pollOptions, ""])}>
                <Plus color="#6366F1" size={16} />
                <Text style={{ color: "#6366F1", fontSize: 13, fontWeight: "600" }}>{t('addOption')}</Text>
              </TouchableOpacity>
            )}
            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: isDark ? "#374151" : "#F3F4F6" }]} onPress={() => setShowPollModal(false)}>
                <Text style={[styles.editBtnCancel, { color: theme.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editBtn, styles.editBtnSave, (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) && { opacity: 0.5 }]}
                onPress={handleSendPoll}
                disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
              >
                <Text style={styles.editBtnSaveText}>{t('send')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal ruleta */}
      <Modal visible={showRouletteModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => { if (!rouletteSpinning) setShowRouletteModal(false); }}>
        <View style={styles.editOverlay}>
          <View style={[styles.editCard, { backgroundColor: theme.card, maxHeight: "90%" }]}>
            {/* Header */}
            <View style={styles.modalTitleRow}>
              <Shuffle color="#6366F1" size={18} />
              <Text style={[styles.editTitle, { color: theme.text }]}>{t('rouletteTitle')}</Text>
              <TouchableOpacity onPress={() => { if (!rouletteSpinning) setShowRouletteModal(false); }}>
                <X color={theme.textMuted} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 4 }}>
              {/* Título del sorteo */}
              <TextInput
                style={[styles.editInput, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
                placeholder={t('rouletteTitle')}
                placeholderTextColor={theme.textMuted}
                value={rouletteTitle}
                onChangeText={setRouletteTitle}
                maxLength={80}
                editable={!rouletteSpinning}
              />

              {/* Chips de miembros */}
              {members.length > 0 && (
                <View style={styles.memberChipsSection}>
                  <Text style={[styles.memberChipsLabel, { color: theme.textSecondary }]}>{t('addMembers')}</Text>
                  <View style={styles.memberChipsRow}>
                    {members.map((m) => {
                      const selected = rouletteItems.includes(m.name);
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[
                            styles.memberChip,
                            {
                              backgroundColor: selected ? "#6366F1" : (isDark ? "#374151" : "#F3F4F6"),
                              borderColor: selected ? "#6366F1" : theme.border,
                            },
                          ]}
                          onPress={() => !rouletteSpinning && toggleMemberInRoulette(m.name)}
                          disabled={rouletteSpinning}
                        >
                          <View style={[styles.memberChipAvatar, { backgroundColor: selected ? "#4338CA" : (isDark ? "#4B5563" : "#E5E7EB") }]}>
                            <Text style={[styles.memberChipInitial, { color: selected ? "#E0E7FF" : theme.textMuted }]}>
                              {m.name?.[0]?.toUpperCase() || "?"}
                            </Text>
                          </View>
                          <Text style={[styles.memberChipName, { color: selected ? "#FFFFFF" : theme.text }]} numberOfLines={1}>
                            {m.name?.split(" ")[0]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Lista manual de elementos */}
              <View style={styles.rouletteItemsSection}>
                <Text style={[styles.memberChipsLabel, { color: theme.textSecondary }]}>{t('rouletteOptions')}</Text>
                {rouletteItems.map((item, i) => (
                  <View key={i} style={styles.pollOptionRow}>
                    <TextInput
                      style={[styles.pollOptionInput, { backgroundColor: theme.input, borderColor: theme.inputBorder, color: theme.text }]}
                      placeholder={i === 0 ? t('element1') : i === 1 ? t('element2') : `${i + 1}`}
                      placeholderTextColor={theme.textMuted}
                      value={item}
                      onChangeText={(t) => { const arr = [...rouletteItems]; arr[i] = t; setRouletteItems(arr); }}
                      maxLength={60}
                      editable={!rouletteSpinning}
                    />
                    {rouletteItems.length > 2 && (
                      <TouchableOpacity onPress={() => setRouletteItems(rouletteItems.filter((_, j) => j !== i))} style={styles.pollRemoveBtn} disabled={rouletteSpinning}>
                        <X color="#EF4444" size={16} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {rouletteItems.length < 10 && (
                  <TouchableOpacity style={[styles.addOptionBtn, { borderColor: theme.border }]} onPress={() => setRouletteItems([...rouletteItems, ""])} disabled={rouletteSpinning}>
                    <Plus color="#6366F1" size={16} />
                    <Text style={{ color: "#6366F1", fontSize: 13, fontWeight: "600" }}>{t('addElement')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            {rouletteResult && (
              <View style={[styles.rouletteWinnerBanner, { backgroundColor: isDark ? "#312E81" : "#EDE9FE" }]}>
                <Text style={[styles.rouletteWinnerBannerLabel, { color: isDark ? "#A5B4FC" : "#6D28D9" }]}>🏆 {t('winner')}</Text>
                <Text style={[styles.rouletteWinnerBannerName, { color: isDark ? "#E0E7FF" : "#4C1D95" }]} numberOfLines={1}>{rouletteResult}</Text>
              </View>
            )}

            <View style={[styles.editActions, { marginTop: 8 }]}>
              {rouletteResult ? (
                <>
                  <TouchableOpacity style={[styles.editBtn, { backgroundColor: isDark ? "#374151" : "#F3F4F6" }]} onPress={() => { setRouletteResult(null); setRouletteCurrent(""); }}>
                    <Text style={[styles.editBtnCancel, { color: theme.text }]}>{t('spinAgain')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.editBtn, styles.editBtnSave]} onPress={handleSendRouletteResult}>
                    <Text style={styles.editBtnSaveText}>{t('sendToChat')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.editBtn, styles.editBtnSave, { flex: 1 }, (rouletteSpinning || rouletteItems.filter(i => i.trim()).length < 2) && { opacity: 0.5 }]}
                  onPress={handleSpin}
                  disabled={rouletteSpinning || rouletteItems.filter(i => i.trim()).length < 2}
                >
                  <Text style={styles.editBtnSaveText}>{rouletteSpinning ? t('spinning') : "🎡 Girar"}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E5E7EB" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E5E7EB",
  },
  loadingText: { color: "#6B7280", fontSize: 14 },
  header: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  backButton: { padding: 4, borderRadius: 8 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 12, color: "#C7D2FE", marginTop: 1 },
  messagesContainer: { flex: 1 },
  messagesList: { padding: 16 },
  reminderBanner: {
    backgroundColor: "#FEF9C3",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    marginHorizontal: 8,
  },
  reminderText: { fontSize: 12, color: "#92400E", textAlign: "center" },
  reminderBold: { fontWeight: "700" },
  messageWrapper: { maxWidth: "85%", marginBottom: 12 },
  messageWrapperMe: { alignSelf: "flex-end", alignItems: "flex-end" },
  messageWrapperOther: { alignSelf: "flex-start", alignItems: "flex-start" },
  authorName: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    alignSelf: "flex-start",
    position: "relative",
    paddingRight: 32,
  },
  bubbleMe: {
    backgroundColor: "#4F46E5",
    borderTopRightRadius: 4,
    paddingRight: 32,
  },
  bubbleOther: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    paddingRight: 32,
  },
  messageTextContainer: { flexShrink: 1 },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1F2937",
    flexWrap: "wrap",
  },
  messageTextMe: { color: "#FFFFFF" },
  mention: { color: "#818CF8", fontWeight: "700" },
  starButtonAbsolute: { position: "absolute", top: 8, right: 8, padding: 4 },
  messageTime: { fontSize: 10 },
  messageTimeMe: { color: "#C7D2FE" },
  messageTimeOther: { color: "#9CA3AF" },
  emptyChat: { alignItems: "center", paddingVertical: 40 },
  emptyChatText: { color: "#6B7280", fontSize: 14 },
  inputBar: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  attachButton: { padding: 8, marginBottom: 4 },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "flex-end",
    overflow: "hidden",
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
    maxHeight: 100,
  },
  sendButton: { padding: 10 },
  sendIconContainer: { width: 20, height: 20 },
  onlineDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ADE80",
    borderWidth: 1,
    borderColor: "#4F46E5",
  },
  onlineOverlay: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 100,
    paddingRight: 16,
  },
  onlinePanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    minWidth: 200,
    maxWidth: 260,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  onlineTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4F46E5",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 8,
  },
  onlineSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  offlineSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  onlineDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 10,
  },
  onlineEmpty: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
    marginBottom: 4,
  },
  onlineMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ADE80",
  },
  offlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  onlineMemberName: {
    fontSize: 13,
    color: "#1F2937",
    fontWeight: "500",
    flex: 1,
  },
  offlineMemberName: {
    fontSize: 13,
    color: "#9CA3AF",
    flex: 1,
  },
  onlineLeaderBadge: {
    backgroundColor: "#312E81",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  onlineLeaderText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#E0E7FF",
  },
  // Date separator
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    paddingHorizontal: 8,
    gap: 8,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
  },
  dateSeparatorChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: "600",
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
  },
  editedLabel: {
    fontSize: 9,
    fontStyle: "italic",
  },
  editedLabelMe: { color: "rgba(199,210,254,0.7)" },
  editedLabelOther: { color: "#9CA3AF" },
  // Action sheet
  actionOverlay: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  actionSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  actionHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  actionPreview: {
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  actionDivider: { height: 1, marginVertical: 4 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  actionCancel: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  // Edit modal
  editOverlay: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  editCard: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  editTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  editBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editBtnCancel: {
    fontSize: 14,
    fontWeight: "600",
  },
  editBtnSave: {
    backgroundColor: "#4F46E5",
  },
  editBtnSaveText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  specialMsgWrapper: {
    alignSelf: "stretch",
    marginBottom: 12,
  },
  rouletteMsgWrapper: {
    alignSelf: "stretch",
    marginBottom: 12,
  },
  // Poll message
  pollBubble: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  pollHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pollLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  pollQuestion: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  pollOption: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 8,
    gap: 6,
  },
  pollOptionTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pollBarTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  pollBarFill: {
    height: 3,
    borderRadius: 2,
  },
  pollOptionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  pollPct: {
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 8,
  },
  pollTotal: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 2,
  },
  // Roulette message
  rouletteBubble: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  rouletteHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rouletteEmoji: {
    fontSize: 26,
  },
  rouletteMsgTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  rouletteMsgSub: {
    fontSize: 11,
    marginTop: 1,
  },
  rouletteList: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  rouletteListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  rouletteListNum: {
    fontSize: 12,
    fontWeight: "600",
    width: 18,
  },
  rouletteListText: {
    flex: 1,
    fontSize: 13,
  },
  rouletteCrown: {
    fontSize: 14,
  },
  rouletteWinnerBox: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    gap: 2,
  },
  rouletteWinnerLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  rouletteWinner: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  rouletteMsgTime: {
    fontSize: 10,
    textAlign: "right",
  },
  // Modal shared
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  // Poll/Roulette creation
  pollOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pollOptionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  pollRemoveBtn: {
    padding: 6,
  },
  addOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  rouletteWinnerBanner: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 10,
    marginTop: 8,
  },
  rouletteWinnerBannerLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  rouletteWinnerBannerName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  memberChipsSection: {
    gap: 8,
  },
  memberChipsLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  memberChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  memberChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 6,
  },
  memberChipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  memberChipInitial: {
    fontSize: 10,
    fontWeight: "800",
  },
  memberChipName: {
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 80,
  },
  rouletteItemsSection: {
    gap: 8,
    marginBottom: 4,
  },
});
