// ============================================
// CHAT SCREEN - StudySync
// Input fijo al teclado + chat ocupa toda la pantalla
// ============================================

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  Animated,
  Easing,
  PanResponder,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Platform,
  Modal,
  Alert,
  Vibration,
} from "react-native";
import Text from "../../components/AppText";
import GroupAvatar from "../../components/GroupAvatar";
import { initialsFromDisplayName } from "../../utils/avatarInitials";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Send,
  Star,
  UsersRound,
  Wrench,
  Pencil,
  Trash2,
  BarChart2,
  Shuffle,
  Plus,
  X,
  CornerUpLeft,
} from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAccessibility } from "../../contexts/AccessibilityContext";
import * as firestoreService from "../../services/firestoreService";
import {
  formatTimeInTimeZone,
  getCalendarDateKeyInTimeZone,
  formatChatDateSeparatorLabel,
} from "../../utils/dateUtils";
import { Audio } from "expo-av";
import { notifyNewMessage } from "../../services/notificationService";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

// ── Typing bubble con 3 dots animados ────────────────────────
// React.memo evita que se re-renderice (y se reinicie la animación)
// cuando el padre re-renderiza por cambios de estado no relacionados (ej. hasText).
const TypingBubble = React.memo(function TypingBubble({
  names,
  theme,
  isDark,
}) {
  const dot0 = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const BOUNCE = 260; // ms para subir o bajar
    const STAGGER = 140; // ms entre cada dot
    const PAUSE = STAGGER * 2; // pausa al final para que el ciclo sea simétrico

    // Cada dot corre su propio loop con un delay de arranque diferente.
    // Duración total del loop: startDelay + BOUNCE + BOUNCE + (PAUSE - startDelay)
    //                        = BOUNCE*2 + PAUSE  →  igual para los 3 dots.
    const makeLoop = (value, startDelay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(startDelay),
          Animated.timing(value, {
            toValue: -7,
            duration: BOUNCE,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: BOUNCE,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(PAUSE - startDelay),
        ]),
      );

    const a0 = makeLoop(dot0, 0);
    const a1 = makeLoop(dot1, STAGGER);
    const a2 = makeLoop(dot2, STAGGER * 2);
    a0.start();
    a1.start();
    a2.start();
    return () => {
      a0.stop();
      a1.stop();
      a2.stop();
    };
  }, []);

  const label =
    names.length === 1
      ? `${names[0]} está escribiendo`
      : `${names.join(", ")} están escribiendo`;

  return (
    <View style={typingStyles.wrapper}>
      <Text style={[typingStyles.name, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <View
        style={[
          typingStyles.bubble,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        {[dot0, dot1, dot2].map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              typingStyles.dot,
              {
                backgroundColor: isDark ? "#6B7280" : "#9CA3AF",
                transform: [{ translateY: dot }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
});

const typingStyles = StyleSheet.create({
  wrapper: { alignSelf: "flex-start", marginBottom: 8, marginTop: 4 },
  name: { fontSize: 11, fontWeight: "600", marginBottom: 4, marginLeft: 4 },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    alignSelf: "flex-start",
    elevation: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});

// ── Swipeable wrapper for reply gesture ──────────────────────
function SwipeableMessage({ onSwipeRight, children }) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 8 && Math.abs(g.dy) < 25,
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) translateX.setValue(Math.min(g.dx * 0.6, 72));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > 50) {
          Vibration.vibrate(30);
          onSwipeRight();
        }
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 200,
          friction: 12,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      style={{ transform: [{ translateX }] }}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

/**
 * `KeyboardAvoidingView` de keyboard-controller: `paddingBottom` animado según el teclado
 * nativo (misma fuente que el resto del módulo). Encoge el layout del FlatList + composer
 * sin `transform`, así los mensajes no quedan debajo del input en ningún dispositivo.
 * `softwareKeyboardLayoutMode: "resize"`: si el sistema ya encoge la ventana, el cálculo
 * de solapamiento tiende a 0 y no duplica el ajuste.
 */
function ChatBodyShell({ headerHeight, children }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, minHeight: 0 }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

export default function ChatScreen({ route, navigation }) {
  const {
    groupId,
    groupName: routeGroupName,
    groupPhotoURL: routeGroupPhoto,
    highlightMessageId = null,
    _ts: highlightTs = null,
  } = route.params || {};
  const { user, userProfile } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useAccessibility();
  const insets = useSafeAreaInsets();
  const inputBottomPadding = 12;
  const isSubscriber = (userProfile?.plan || "free") === "personal";

  // Placeholder inmediato si la navegación trae nombre/foto (evita pantalla en blanco hasta getGroup).
  const [group, setGroup] = useState(() =>
    routeGroupName
      ? {
          id: groupId,
          name: routeGroupName,
          photoURL: routeGroupPhoto ?? null,
          members: [],
        }
      : null,
  );
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [showOnline, setShowOnline] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  /** Ancla scroll inicial en lista invertida. */
  const initialChatScrollDoneRef = useRef(false);
  const [hasText, setHasText] = useState(false);
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
  const [replyingTo, setReplyingTo] = useState(null); // { id, text, authorId }
  const [mentionQuery, setMentionQuery] = useState(null); // string after '@' or null
  const [typingUserIds, setTypingUserIds] = useState([]);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);
  const processedHighlightRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingSoundRef = useRef(null);
  const [inputText, setInputText] = useState(""); // valor controlado del TextInput
  const [resolvedMe, setResolvedMe] = useState(null);
  const inputValueRef = useRef(""); // copia ref para handleSend (sin stale closure)
  const textInputRef = useRef(null);
  const flatListRef = useRef(null);

  const getProfileName = useCallback((profileLike) => {
    return (profileLike?.name || "").trim();
  }, []);

  const getCurrentUserName = useCallback(() => {
    return (
      getProfileName(userProfile) ||
      getProfileName(resolvedMe) ||
      getProfileName(members.find((m) => m.id === user?.uid)) ||
      "Usuario"
    );
  }, [
    getProfileName,
    members,
    resolvedMe,
    user?.uid,
    userProfile,
  ]);

  useEffect(() => {
    initialChatScrollDoneRef.current = false;
  }, [groupId]);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    firestoreService
      .getUser(user.uid)
      .then((profile) => {
        if (!cancelled) setResolvedMe(profile || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

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
          // Online subscription — no necesita perfiles completos
          unsubOnline = firestoreService.getOnlineMembers(
            groupId,
            groupData.members,
            (online) => {
              if (!cancelled) setOnlineMembers(online);
            },
          );

          // Lanzar el fetch de red inmediatamente (no bloqueante aún)
          const membersFetchPromise = firestoreService.getUsersByIds(
            groupData.members,
          );

          // Esperar la respuesta fresca y actualizar estado + caché
          const memberData = await membersFetchPromise;
          if (cancelled) return;
          setMembers(memberData);
        }
      } catch (e) {
        console.error("Error cargando grupo:", e);
      }
    };
    loadGroup();

    // La presencia (online/offline) se gestiona globalmente en AppNavigator.

    const unsubMessages = firestoreService.getGroupMessages(
      groupId,
      (fetchedMessages) => {
        if (cancelled) return;
        setMessages(fetchedMessages);
      },
    );

    const unsubTyping = firestoreService.onTypingStatus(
      groupId,
      user?.uid,
      (ids) => {
        if (!cancelled) setTypingUserIds(ids);
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
      unsubTyping();
      if (rouletteTimerRef.current) clearTimeout(rouletteTimerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (user?.uid)
        firestoreService
          .setTypingStatus(groupId, user.uid, false)
          .catch(() => {});
    };
  }, [groupId, user]);

  // Preload typing sound
  useEffect(() => {
    let sound;
    Audio.Sound.createAsync(require("../../../assets/sounds/typing.wav"))
      .then(({ sound: s }) => {
        sound = s;
        typingSoundRef.current = s;
      })
      .catch(() => {});
    return () => {
      sound?.unloadAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!isSubscriber) {
      setShowExtraMenu(false);
      setShowPollModal(false);
      setShowRouletteModal(false);
    }
  }, [isSubscriber]);

  // Asegura nombres de autores históricos que no estén en group.members
  useEffect(() => {
    if (!messages.length) return;
    const knownIds = new Set(members.map((m) => m.id));
    const missingAuthorIds = [
      ...new Set(
        messages.map((m) => m.authorId).filter((id) => id && !knownIds.has(id)),
      ),
    ];
    if (!missingAuthorIds.length) return;

    let cancelled = false;
    firestoreService
      .getUsersByIds(missingAuthorIds)
      .then((fetched) => {
        if (cancelled || !fetched?.length) return;
        setMembers((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          fetched.forEach((m) => byId.set(m.id, m));
          return Array.from(byId.values());
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [messages, members]);

  // Scroll + highlight message cuando se llega desde una notificación de mención.
  // IMPORTANTE: usamos `messages.length` en las deps (no `messageList.length`) porque
  // `messageList` se declara más abajo con useMemo; evaluarlo aquí causaría un TypeError
  // por variable no inicializada en el momento en que React evalúa el array de dependencias.
  useEffect(() => {
    if (!highlightMessageId || !messages.length) return;
    if (processedHighlightRef.current === highlightTs) return;
    processedHighlightRef.current = highlightTs;

    // messageList sí está disponible dentro del callback (corre tras el render)
    const idx = messageList.findIndex((item) => item.id === highlightMessageId);
    if (idx >= 0) {
      setHighlightedMsgId(highlightMessageId);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: idx,
          animated: true,
          viewPosition: 0.5,
        });
      }, 350);
      // Quitar el resaltado después de 3 segundos
      setTimeout(() => setHighlightedMsgId(null), 3500);
    }
    // Limpiar params para evitar re-disparo
    navigation.setParams({ highlightMessageId: undefined, _ts: undefined });
  }, [highlightMessageId, highlightTs, messages.length]);

  // Play sound when someone starts typing
  const prevTypingLenRef = useRef(0);
  useEffect(() => {
    if (typingUserIds.length > 0 && prevTypingLenRef.current === 0) {
      typingSoundRef.current?.replayAsync().catch(() => {});
    }
    prevTypingLenRef.current = typingUserIds.length;
  }, [typingUserIds]);

  const handleSend = async () => {
    const textToSend = inputValueRef.current.trim();
    if (!textToSend) return;

    const currentReply = replyingTo;
    const now = new Date();
    const msgCreatedAt = now.toISOString();
    const msgTime = formatTimeInTimeZone(msgCreatedAt);
    const myName = getCurrentUserName();

    setInputText("");
    inputValueRef.current = "";
    setHasText(false);
    setReplyingTo(null);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (user?.uid)
      firestoreService
        .setTypingStatus(groupId, user.uid, false)
        .catch(() => {});

    // Scroll al mensaje enviado
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

    // Optimistic update: muestra el mensaje inmediatamente
    const optimisticMsg = {
      id: `temp_${now.getTime()}`,
      authorId: user.uid,
      authorName: myName,
      text: textToSend,
      time: msgTime,
      createdAt: msgCreatedAt,
      important: false,
      ...(currentReply && {
        replyTo: {
          id: currentReply.id,
          text: currentReply.text,
          authorId: currentReply.authorId,
          authorName: currentReply.authorName,
        },
      }),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    textInputRef.current?.focus();

    try {
      const msgId = await firestoreService.sendMessage({
        groupId,
        authorId: user.uid,
        authorName: myName,
        text: textToSend,
        time: msgTime,
        important: false,
        ...(currentReply && {
          replyTo: {
            id: currentReply.id,
            text: currentReply.text,
            authorId: currentReply.authorId,
            authorName: currentReply.authorName,
          },
        }),
      });

      // ── Notificaciones de mención (@nombre o @todos) ────────────
      const tokens = textToSend.match(/@\w+/g) || [];
      if (tokens.length > 0) {
        const senderName = getCurrentUserName() || "Alguien";
        const mentionAll = tokens.some((t) => t.toLowerCase() === "@todos");
        let targetIds = [];

        if (mentionAll) {
          // Para @todos usamos group.members (array de UIDs cargado con el grupo),
          // más fiable que el estado `members` que depende de getUsersByIds.
          targetIds = (group?.members || []).filter((uid) => uid !== user.uid);
        } else {
          // Buscar miembro cuyo nombre comienza con el token (@Bryan → Bryan).
          // Null-safety en m.name para evitar TypeError si algún perfil no tiene nombre.
          tokens.forEach((token) => {
            const q = token.slice(1).toLowerCase();
            const member = members.find((m) =>
              (m.name || m.displayName || "").toLowerCase().startsWith(q),
            );
            if (member && member.id !== user.uid) targetIds.push(member.id);
          });
          targetIds = [...new Set(targetIds)];
        }

        if (targetIds.length > 0) {
          const preview =
            textToSend.length > 60 ? `${textToSend.slice(0, 60)}…` : textToSend;
          const notifBody = mentionAll
            ? `${senderName} mencionó a todos los integrantes: "${preview}"`
            : `${senderName} te mencionó: "${preview}"`;
          targetIds.forEach((uid) => {
            firestoreService
              .createNotification(uid, {
                type: "mention",
                title: group?.name || "Grupo",
                body: notifBody,
                bodyKey: mentionAll
                  ? "notifMentionAllBody"
                  : "notifMentionUserBody",
                notifParams: { sender: senderName, preview },
                data: { groupId, messageId: msgId },
              })
              .catch((err) => console.warn("[mention-notif]", err?.message));
          });
        }
      }

      // Notificar a los demás miembros (fire-and-forget)
      const senderName = getCurrentUserName() || "Alguien";
      notifyNewMessage({
        groupId,
        senderId: user.uid,
        senderName,
        messageText: textToSend,
        groupName: group?.name || "Chat",
      }).catch(() => {});
    } catch (e) {
      console.error("Error enviando mensaje:", e);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    }
  };

  const handleToggleImportant = async (msgId, currentValue) => {
    await firestoreService.toggleMessageImportant(msgId, currentValue);
  };

  const handleSelectMention = (memberName) => {
    const text = inputValueRef.current;
    // Reemplaza el @query al final del texto con @nombre + espacio
    const newText = text.replace(/@([^\s@]*)$/, `@${memberName} `);
    // Actualizar estado controlado (confiable) + ref (para handleSend sin stale closure).
    // setNativeProps fue reemplazado porque en Android no dispara onChangeText,
    // dejando ref y valor nativo desfasados en la segunda mención.
    inputValueRef.current = newText;
    setInputText(newText);
    setHasText(true);
    setMentionQuery(null);
  };

  const mentionSuggestions =
    mentionQuery !== null
      ? members.filter(
          (m) =>
            m.id !== user?.uid &&
            (m.name || m.displayName || "")
              .toLowerCase()
              .startsWith(mentionQuery.toLowerCase()),
        )
      : [];

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
    Alert.alert(t("deleteMessage"), t("deleteMessageConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await firestoreService.deleteMessage(msg.id);
          } catch (e) {
            console.error("Error eliminando mensaje:", e);
          }
        },
      },
    ]);
  };

  // ── Poll ─────────────────────────────────────────────────────
  const handleSendPoll = async () => {
    if (!isSubscriber) return;
    const validOptions = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) return;
    const votes = {};
    validOptions.forEach((_, i) => {
      votes[String(i)] = [];
    });
    const myName = getCurrentUserName();
    await firestoreService.sendMessage({
      groupId,
      authorId: user.uid,
      authorName: myName,
      type: "poll",
      question: pollQuestion.trim(),
      options: validOptions.map((o) => o.trim()),
      votes,
      text: `📊 Encuesta: ${pollQuestion.trim()}`,
      time: formatTimeInTimeZone(new Date().toISOString()),
      important: false,
    });
    setPollQuestion("");
    setPollOptions(["", ""]);
    setShowPollModal(false);
  };

  const pollVoteLockRef = useRef(new Set());
  const pollVoteFoundRef = useRef(false);

  const mergePollVoteLocal = useCallback((votes, optionIndex, userId) => {
    const newVotes = {};
    const keys = Object.keys(votes || {});
    keys.forEach((key) => {
      newVotes[key] = [...(votes[key] || []).filter((id) => id !== userId)];
    });
    const k = String(optionIndex);
    newVotes[k] = [...(newVotes[k] || []), userId];
    return newVotes;
  }, []);

  const handleVotePoll = useCallback(
    async (messageId, optionIndex) => {
      if (!user?.uid) return;
      if (pollVoteLockRef.current.has(messageId)) return;
      pollVoteLockRef.current.add(messageId);
      pollVoteFoundRef.current = false;

      setMessages((prev) => {
        const idx = prev.findIndex(
          (m) => m.id === messageId && m.type === "poll",
        );
        if (idx < 0) return prev;
        pollVoteFoundRef.current = true;
        const old = prev[idx];
        const next = [...prev];
        next[idx] = {
          ...old,
          votes: mergePollVoteLocal(old.votes, optionIndex, user.uid),
        };
        return next;
      });

      if (!pollVoteFoundRef.current) {
        pollVoteLockRef.current.delete(messageId);
        return;
      }

      try {
        await firestoreService.votePoll(messageId, optionIndex, user.uid);
      } catch (e) {
        console.warn("[votePoll]", e?.message);
        const fresh = await firestoreService.getMessageById(messageId);
        if (fresh) {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, ...fresh } : m)),
          );
        }
      } finally {
        pollVoteLockRef.current.delete(messageId);
      }
    },
    [user?.uid, mergePollVoteLocal],
  );

  // ── Roulette ─────────────────────────────────────────────────
  const handleSpin = () => {
    if (!isSubscriber) return;
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
      setRouletteItems(
        updated.length >= 2
          ? updated
          : [...updated, ...Array(2 - updated.length).fill("")],
      );
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
    if (!isSubscriber || !rouletteResult) return;
    const validItems = rouletteItems.filter((i) => i.trim());
    const myName = getCurrentUserName();
    await firestoreService.sendMessage({
      groupId,
      authorId: user.uid,
      authorName: myName,
      type: "roulette",
      rouletteTitle: rouletteTitle.trim() || null,
      rouletteWinner: rouletteResult,
      rouletteItems: validItems,
      text: `🎡 Sorteo: ${rouletteResult}`,
      time: formatTimeInTimeZone(new Date().toISOString()),
      important: false,
    });
    setShowRouletteModal(false);
    setRouletteResult(null);
    setRouletteCurrent("");
    setRouletteItems(["", ""]);
    setRouletteTitle("");
  };

  const getMemberName = (authorId, fallbackName) => {
    const normalizedAuthorId = authorId ? String(authorId) : "";
    const member =
      members.find((m) => String(m.id) === normalizedAuthorId) ||
      members.find((m) => m?.email === normalizedAuthorId) ||
      members.find(
        (m) =>
          typeof m?.email === "string" &&
          m.email.toLowerCase() === normalizedAuthorId.toLowerCase(),
      );

    const memberName = getProfileName(member);
    if (memberName) return memberName;

    if (authorId === user?.uid) {
      const currentName = getCurrentUserName();
      if (currentName && currentName !== "Usuario") return currentName;
    }

    const fallback = (fallbackName || "").trim();
    if (fallback) return fallback;

    return "Usuario";
  };

  const isLeaderMember = (authorId) => group?.leaderId === authorId;

  // ── Separadores de fecha (calendario Perú — America/Lima) ─────
  const buildMessageList = (msgs) => {
    const result = [];
    let lastDate = null;
    for (const msg of msgs) {
      const dateKey = getCalendarDateKeyInTimeZone(msg.createdAt);
      if (dateKey !== lastDate) {
        result.push({
          type: "separator",
          id: `sep_${dateKey}`,
          label: formatChatDateSeparatorLabel(dateKey),
        });
        lastDate = dateKey;
      }
      result.push(msg);
    }
    return result.reverse();
  };

  // Memoize so FlatList doesn't re-render all messages when typingUserIds changes
  const messageList = useMemo(() => buildMessageList(messages), [messages]);

  const onlineMemberById = useMemo(() => {
    const map = new Map();
    onlineMembers.forEach((m) => {
      if (m?.id) map.set(m.id, m);
    });
    return map;
  }, [onlineMembers]);

  useEffect(() => {
    if (!typingUserIds.length) return;
    const knownIds = new Set(members.map((m) => m.id));
    const missing = typingUserIds.filter((id) => id && !knownIds.has(id));
    if (!missing.length) return;
    let cancelled = false;
    firestoreService
      .getUsersByIds(missing)
      .then((fetched) => {
        if (cancelled || !fetched?.length) return;
        setMembers((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          fetched.forEach((m) => byId.set(m.id, m));
          return Array.from(byId.values());
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [typingUserIds, members]);

  const getTypingName = useCallback(
    (uid) => {
      const fromMembers = members.find((m) => m.id === uid);
      const memberName = getProfileName(fromMembers);
      if (memberName) return memberName;

      const fromOnline = onlineMemberById.get(uid);
      const onlineName = getProfileName(fromOnline);
      if (onlineName) return onlineName;

      return "Usuario";
    },
    [members, getProfileName, onlineMemberById],
  );

  // Estabilizar el array de nombres para que React.memo en TypingBubble
  // no vea un prop nuevo en cada re-render por tecla escrita.
  const typingNames = useMemo(
    () => typingUserIds.map((id) => getTypingName(id)),
    [typingUserIds, getTypingName],
  );

  const renderPollMessage = (msg) => {
    const totalVotes = Object.values(msg.votes || {}).reduce(
      (s, arr) => s + arr.length,
      0,
    );
    const myVote = Object.keys(msg.votes || {}).find((k) =>
      (msg.votes[k] || []).includes(user.uid),
    );
    return (
      <View style={styles.specialMsgWrapper}>
        <View
          style={[
            styles.pollBubble,
            { backgroundColor: theme.card, borderColor: "#6366F1" },
          ]}
        >
          <View style={styles.pollHeader}>
            <BarChart2 color="#6366F1" size={14} />
            <Text style={[styles.pollLabel, { color: "#6366F1" }]}>
              ENCUESTA
            </Text>
          </View>
          <Text style={[styles.pollQuestion, { color: theme.text }]}>
            {msg.question}
          </Text>
          {(msg.options || []).map((opt, i) => {
            const count = (msg.votes?.[String(i)] || []).length;
            const pct =
              totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const voted = myVote === String(i);
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.pollOption,
                  {
                    borderColor: voted ? "#6366F1" : theme.border,
                    backgroundColor: theme.input,
                  },
                ]}
                onPress={() => handleVotePoll(msg.id, i)}
                activeOpacity={0.7}
              >
                <View style={styles.pollOptionTop}>
                  <Text
                    style={[
                      styles.pollOptionText,
                      { color: voted ? "#6366F1" : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {opt}
                  </Text>
                  <Text
                    style={[
                      styles.pollPct,
                      { color: voted ? "#6366F1" : theme.textMuted },
                    ]}
                  >
                    {pct}%
                  </Text>
                </View>
                <View
                  style={[
                    styles.pollBarTrack,
                    { backgroundColor: theme.dark ? "#374151" : "#E5E7EB" },
                  ]}
                >
                  <View
                    style={[
                      styles.pollBarFill,
                      {
                        width: `${pct}%`,
                        backgroundColor: voted ? "#6366F1" : "#A5B4FC",
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={[styles.pollTotal, { color: theme.textMuted }]}>
            {totalVotes} {totalVotes === 1 ? "voto" : "votos"}
          </Text>
        </View>
      </View>
    );
  };

  const renderRouletteMessage = (msg) => (
    <View style={styles.rouletteMsgWrapper}>
      <View
        style={[
          styles.rouletteBubble,
          {
            backgroundColor: theme.dark ? "#1E1B4B" : "#EEF2FF",
            borderColor: "#6366F1",
          },
        ]}
      >
        {/* Header */}
        <View style={styles.rouletteHeaderRow}>
          <Text style={styles.rouletteEmoji}>🎡</Text>
          <View style={{ flex: 1 }}>
            {msg.rouletteTitle ? (
              <Text style={[styles.rouletteMsgTitle, { color: "#4F46E5" }]}>
                {msg.rouletteTitle}
              </Text>
            ) : (
              <Text style={[styles.rouletteMsgTitle, { color: "#4F46E5" }]}>
                {t("rouletteTitle")}
              </Text>
            )}
            <Text
              style={[styles.rouletteMsgSub, { color: theme.textSecondary }]}
            >
              Lanzado por {getMemberName(msg.authorId, msg.authorName)}
            </Text>
          </View>
        </View>

        {/* Lista de participantes */}
        {(msg.rouletteItems || []).length > 0 && (
          <View
            style={[
              styles.rouletteList,
              { borderColor: theme.dark ? "#312E81" : "#C7D2FE" },
            ]}
          >
            {(msg.rouletteItems || []).map((item, i) => {
              const isWinner = item === msg.rouletteWinner;
              return (
                <View
                  key={i}
                  style={[
                    styles.rouletteListItem,
                    isWinner && {
                      backgroundColor: theme.dark ? "#312E81" : "#E0E7FF",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rouletteListNum,
                      { color: isWinner ? "#4F46E5" : theme.textMuted },
                    ]}
                  >
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
        <View
          style={[
            styles.rouletteWinnerBox,
            { backgroundColor: theme.dark ? "#312E81" : "#DDD6FE" },
          ]}
        >
          <Text
            style={[
              styles.rouletteWinnerLabel,
              { color: theme.dark ? "#A5B4FC" : "#4338CA" },
            ]}
          >
            ¡Le tocó!
          </Text>
          <Text
            style={[
              styles.rouletteWinner,
              { color: theme.dark ? "#E0E7FF" : "#3730A3" },
            ]}
          >
            {msg.rouletteWinner}
          </Text>
        </View>

        <Text style={[styles.rouletteMsgTime, { color: theme.textMuted }]}>
          {msg.createdAt ? formatTimeInTimeZone(msg.createdAt) : msg.time || ""}
        </Text>
      </View>
    </View>
  );

  const renderItem = ({ item }) => {
    if (item.type === "separator") {
      return (
        <View style={styles.dateSeparator}>
          <View
            style={[
              styles.dateSeparatorLine,
              { backgroundColor: theme.dark ? "#374151" : "#D1D5DB" },
            ]}
          />
          <View
            style={[
              styles.dateSeparatorChip,
              { backgroundColor: theme.dark ? "#374151" : "#E5E7EB" },
            ]}
          >
            <Text
              style={[styles.dateSeparatorText, { color: theme.textSecondary }]}
            >
              {item.label}
            </Text>
          </View>
          <View
            style={[
              styles.dateSeparatorLine,
              { backgroundColor: theme.dark ? "#374151" : "#D1D5DB" },
            ]}
          />
        </View>
      );
    }
    if (item.type === "poll") return renderPollMessage(item);
    if (item.type === "roulette") return renderRouletteMessage(item);
    return renderMessage({ item });
  };

  const renderMessage = ({ item: msg }) => {
    const isMe = msg.authorId === user.uid;
    const authorName = getMemberName(msg.authorId, msg.authorName);
    const isLeader = isLeaderMember(msg.authorId);
    const isHighlighted = msg.id === highlightedMsgId;

    const replyAuthorName = msg.replyTo
      ? msg.replyTo.authorId === user.uid
        ? "Tú"
        : getMemberName(msg.replyTo.authorId, msg.replyTo.authorName)
      : null;

    return (
      <SwipeableMessage onSwipeRight={() => setReplyingTo(msg)}>
        <View
          style={[
            styles.messageWrapper,
            isMe ? styles.messageWrapperMe : styles.messageWrapperOther,
            isHighlighted && styles.messageWrapperHighlighted,
          ]}
        >
          {!isMe && (
            <Text style={[styles.authorName, { color: theme.textSecondary }]}>
              {authorName} {isLeader ? `(${t("leader")})` : ""}
            </Text>
          )}
          <TouchableOpacity
            onLongPress={() => handleLongPress(msg)}
            activeOpacity={0.85}
            delayLongPress={350}
          >
            <View
              style={[
                styles.bubble,
                isMe
                  ? styles.bubbleMe
                  : [
                      styles.bubbleOther,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                    ],
              ]}
            >
              {/* Reply quote */}
              {msg.replyTo && (
                <View
                  style={[
                    styles.replyQuote,
                    {
                      borderLeftColor: isMe
                        ? "rgba(255,255,255,0.5)"
                        : "#6366F1",
                      backgroundColor: isMe
                        ? "rgba(0,0,0,0.18)"
                        : theme.dark
                          ? "#1F2937"
                          : "#EEF2FF",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.replyQuoteAuthor,
                      { color: isMe ? "rgba(255,255,255,0.85)" : "#6366F1" },
                    ]}
                    numberOfLines={1}
                  >
                    {replyAuthorName}
                  </Text>
                  <Text
                    style={[
                      styles.replyQuoteText,
                      {
                        color: isMe
                          ? "rgba(255,255,255,0.65)"
                          : theme.textSecondary,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {msg.replyTo.text}
                  </Text>
                </View>
              )}
              <View style={styles.messageTextContainer}>
                <Text
                  style={[
                    styles.messageText,
                    isMe ? styles.messageTextMe : { color: theme.text },
                  ]}
                >
                  {msg.text.split(/(@\w+)/g).map((part, index) =>
                    part.startsWith("@") ? (
                      <Text
                        key={index}
                        style={[
                          styles.mention,
                          {
                            color: isMe ? "rgba(255,255,255,0.95)" : "#4F46E5",
                          },
                        ]}
                      >
                        {part}
                      </Text>
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
                  <Text
                    style={[
                      styles.editedLabel,
                      isMe ? styles.editedLabelMe : styles.editedLabelOther,
                    ]}
                  >
                    editado
                  </Text>
                )}
                <Text
                  style={[
                    styles.messageTime,
                    isMe ? styles.messageTimeMe : styles.messageTimeOther,
                  ]}
                >
                  {msg.createdAt
                    ? formatTimeInTimeZone(msg.createdAt)
                    : msg.time || ""}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </SwipeableMessage>
    );
  };

  if (!group) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          {t("loading")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View
        style={[styles.header, { backgroundColor: theme.headerBg }]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t("back") || "Volver"}
            accessibilityHint="Doble toque para regresar"
          >
            <ChevronLeft color="#FFFFFF" size={24} />
          </TouchableOpacity>
          <GroupAvatar
            photoURL={group.photoURL}
            name={group.name}
            size={36}
            borderRadius={10}
            onColoredHeader
            style={{ marginRight: 8 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={styles.headerSubtitle}>{t("onlyAcademicTopics")}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setShowOnline(true)}
          style={{ marginLeft: 10 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`${t("groupMembers")}, ${onlineMembers.length} ${t("online")}`}
          accessibilityHint="Doble toque para ver miembros conectados"
        >
          <UsersRound color="#C7D2FE" size={20} />
          {onlineMembers.length > 0 && <View style={styles.onlineDot} />}
        </TouchableOpacity>
      </View>

      <ChatBodyShell headerHeight={headerHeight}>
        <View style={{ flex: 1, minHeight: 0 }}>
          <FlatList
            ref={flatListRef}
            style={styles.messagesContainer}
            data={messageList}
            extraData={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            inverted
            contentContainerStyle={[styles.messagesList, { paddingBottom: 8 }]}
            showsVerticalScrollIndicator={false}
            scrollEnabled
            nestedScrollEnabled
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              if (!messageList.length || initialChatScrollDoneRef.current)
                return;
              if (highlightMessageId) {
                initialChatScrollDoneRef.current = true;
                return;
              }
              initialChatScrollDoneRef.current = true;
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  flatListRef.current?.scrollToOffset({
                    offset: 0,
                    animated: false,
                  });
                });
              });
            }}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              flatListRef.current?.scrollToOffset({
                offset: index * (averageItemLength || 72),
                animated: true,
              });
            }}
            ListFooterComponent={
              <View style={styles.reminderBanner}>
                <Text style={styles.reminderText}>
                  💡 {t("chatReminderMsg")}{" "}
                  <Text style={styles.reminderBold}>{group.name}</Text>.
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text
                  style={[styles.emptyChatText, { color: theme.textSecondary }]}
                >
                  {t("chatEmpty")}
                </Text>
              </View>
            }
          />

          <View style={{ flexShrink: 0, backgroundColor: theme.bg }}>
            {/* Typing bubble – fuera del FlatList para que los re-renders por tecla
            no toquen la animación. React.memo + typingNames estable garantizan
            que TypingBubble no se re-renderiza mientras se escribe.
            paddingHorizontal: 16 alinea el bubble con los mensajes del chat. */}
            {typingUserIds.length > 0 && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
                <TypingBubble
                  names={typingNames}
                  theme={theme}
                  isDark={theme.dark}
                />
              </View>
            )}

            {/* @mention suggestions */}
            {mentionQuery !== null &&
              (mentionSuggestions.length > 0 ||
                "todos".startsWith(mentionQuery.toLowerCase())) && (
                <View
                  style={[
                    styles.mentionList,
                    {
                      backgroundColor: theme.card,
                      borderTopColor: theme.border,
                    },
                  ]}
                >
                  {"todos".startsWith(mentionQuery.toLowerCase()) && (
                    <TouchableOpacity
                      style={[
                        styles.mentionItem,
                        { borderBottomColor: theme.border },
                      ]}
                      onPress={() => handleSelectMention("todos")}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.mentionAvatar,
                          {
                            backgroundColor: theme.dark ? "#1e1b4b" : "#EEF2FF",
                          },
                        ]}
                      >
                        <Text style={styles.mentionAvatarText}>@</Text>
                      </View>
                      <Text style={[styles.mentionName, { color: theme.text }]}>
                        todos
                      </Text>
                      <Text
                        style={[
                          styles.mentionLeader,
                          {
                            backgroundColor: theme.dark ? "#1e1b4b" : "#EEF2FF",
                            color: theme.dark ? "#A5B4FC" : "#4F46E5",
                          },
                        ]}
                      >
                        notifica a todos
                      </Text>
                    </TouchableOpacity>
                  )}
                  {mentionSuggestions.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.mentionItem,
                        { borderBottomColor: theme.border },
                      ]}
                      onPress={() =>
                        handleSelectMention(getProfileName(m) || "Usuario")
                      }
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.mentionAvatar,
                          {
                            backgroundColor: theme.dark ? "#1e1b4b" : "#EEF2FF",
                          },
                        ]}
                      >
                        <Text style={styles.mentionAvatarText}>
                          {initialsFromDisplayName(
                            getProfileName(m) || "U",
                          ) || "U"}
                        </Text>
                      </View>
                      <Text style={[styles.mentionName, { color: theme.text }]}>
                        {getProfileName(m) || "Usuario"}
                      </Text>
                      {m.id === group?.leaderId && (
                        <Text
                          style={[
                            styles.mentionLeader,
                            {
                              backgroundColor: theme.dark
                                ? "#1e1b4b"
                                : "#EEF2FF",
                              color: theme.dark ? "#A5B4FC" : "#4F46E5",
                            },
                          ]}
                        >
                          líder
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

            {/* Reply preview bar */}
            {replyingTo && (
              <View
                style={[
                  styles.replyBar,
                  {
                    backgroundColor: theme.card,
                    borderTopColor: theme.border,
                    borderLeftColor: "#6366F1",
                  },
                ]}
              >
                <CornerUpLeft
                  color="#6366F1"
                  size={16}
                  style={{ marginRight: 8, flexShrink: 0 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.replyBarAuthor, { color: "#6366F1" }]}
                    numberOfLines={1}
                  >
                    {replyingTo.authorId === user.uid
                      ? "Tú"
                      : getMemberName(replyingTo.authorId)}
                  </Text>
                  <Text
                    style={[
                      styles.replyBarText,
                      { color: theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {replyingTo.text}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setReplyingTo(null)}
                  style={{ padding: 4 }}
                >
                  <X color={theme.textMuted} size={16} />
                </TouchableOpacity>
              </View>
            )}

            {/* Input bar */}
            <View
              style={[
                styles.inputBar,
                {
                  marginBottom: 0,
                  paddingBottom: Math.max(insets.bottom, inputBottomPadding),
                  backgroundColor: theme.card,
                  borderTopColor: theme.border,
                },
              ]}
            >
              {isSubscriber ? (
                <TouchableOpacity
                  style={styles.attachButton}
                  onPress={() => setShowExtraMenu(true)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t("chatToolsMenuA11y")}
                  accessibilityHint={t("chatToolsMenuHint")}
                >
                  <Wrench color={theme.textMuted} size={20} />
                </TouchableOpacity>
              ) : null}
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: theme.input, borderColor: theme.border },
                ]}
              >
                <TextInput
                  ref={textInputRef}
                  value={inputText}
                  style={[styles.textInput, { color: theme.text }]}
                  onChangeText={(text) => {
                    inputValueRef.current = text;
                    setInputText(text);
                    setHasText(text.trim().length > 0);
                    // Detect @mention trigger: last word starting with @
                    const match = text.match(/@([^\s@]*)$/);
                    setMentionQuery(match ? match[1] : null);
                    if (user?.uid) {
                      firestoreService
                        .setTypingStatus(
                          groupId,
                          user.uid,
                          text.trim().length > 0,
                        )
                        .catch(() => {});
                      if (typingTimeoutRef.current)
                        clearTimeout(typingTimeoutRef.current);
                      if (text.trim().length > 0) {
                        typingTimeoutRef.current = setTimeout(() => {
                          firestoreService
                            .setTypingStatus(groupId, user.uid, false)
                            .catch(() => {});
                        }, 4000);
                      }
                    }
                  }}
                  placeholder={t("writeMessage")}
                  placeholderTextColor={theme.textMuted}
                  blurOnSubmit={false}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                  scrollEnabled={false}
                  underlineColorAndroid="transparent"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={handleSend}
                  style={styles.sendButton}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t("send") || "Enviar mensaje"}
                  accessibilityHint="Doble toque para enviar el mensaje"
                >
                  <View style={styles.sendIconContainer}>
                    <Send color={hasText ? "#4F46E5" : "#9CA3AF"} size={20} />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ChatBodyShell>

      {/* Action sheet: editar / eliminar mensaje propio */}
      <Modal
        visible={!!actionMsg}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setActionMsg(null)}
        accessibilityViewIsModal={true}
      >
        <TouchableOpacity
          style={styles.actionOverlay}
          activeOpacity={1}
          onPress={() => setActionMsg(null)}
        >
          <View
            style={[
              styles.actionSheet,
              {
                backgroundColor: theme.card,
                paddingBottom: Math.max(16, insets.bottom),
              },
            ]}
          >
            <View
              style={[styles.actionHandle, { backgroundColor: theme.border }]}
            />
            <Text
              style={[styles.actionPreview, { color: theme.textMuted }]}
              numberOfLines={2}
            >
              {actionMsg?.text}
            </Text>
            <View
              style={[styles.actionDivider, { backgroundColor: theme.border }]}
            />
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleStartEdit}
            >
              <Pencil color="#4F46E5" size={20} />
              <Text style={[styles.actionLabel, { color: theme.text }]}>
                {t("edit") + " " + t("messages")}
              </Text>
            </TouchableOpacity>
            <View
              style={[styles.actionDivider, { backgroundColor: theme.border }]}
            />
            <TouchableOpacity style={styles.actionRow} onPress={handleDelete}>
              <Trash2 color="#DC2626" size={20} />
              <Text style={[styles.actionLabel, { color: "#DC2626" }]}>
                {t("deleteMessage")}
              </Text>
            </TouchableOpacity>
            <View
              style={[styles.actionDivider, { backgroundColor: theme.border }]}
            />
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => setActionMsg(null)}
            >
              <Text
                style={[styles.actionCancel, { color: theme.textSecondary }]}
              >
                {t("cancel")}
              </Text>
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
        accessibilityViewIsModal={true}
      >
        <View style={styles.editOverlay}>
          <View style={[styles.editCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.editTitle, { color: theme.text }]}>
              {t("edit") + " " + t("messages")}
            </Text>
            <TextInput
              style={[
                styles.editInput,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              maxLength={500}
              placeholderTextColor={theme.textMuted}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[
                  styles.editBtn,
                  { backgroundColor: theme.dark ? "#374151" : "#F3F4F6" },
                ]}
                onPress={() => setEditingMsg(null)}
                disabled={editLoading}
              >
                <Text style={[styles.editBtnCancel, { color: theme.text }]}>
                  {t("cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editBtn,
                  styles.editBtnSave,
                  editLoading && { opacity: 0.6 },
                ]}
                onPress={handleSaveEdit}
                disabled={editLoading}
              >
                <Text style={styles.editBtnSaveText}>
                  {editLoading ? t("loading") : t("save")}
                </Text>
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
        accessibilityViewIsModal={true}
      >
        <TouchableOpacity
          style={styles.onlineOverlay}
          activeOpacity={1}
          onPress={() => setShowOnline(false)}
        >
          <View style={[styles.onlinePanel, { backgroundColor: theme.card }]}>
            <Text
              style={[
                styles.onlineTitle,
                { color: "#4F46E5", borderBottomColor: theme.border },
              ]}
            >
              {t("groupMembers")}
            </Text>

            {/* Conectados */}
            <Text style={styles.onlineSectionLabel}>
              🟢 {t("online")} ({onlineMembers.length})
            </Text>
            {onlineMembers.length === 0 ? (
              <Text style={styles.onlineEmpty}>
                {t("online")} - {t("noMessages")}
              </Text>
            ) : (
              onlineMembers.map((m) => (
                <View key={m.id} style={styles.onlineMemberRow}>
                  <View style={styles.onlineIndicator} />
                  <Text
                    style={[styles.onlineMemberName, { color: theme.text }]}
                  >
                    {getMemberName(m.id, m.name || m.displayName || m.username)}
                  </Text>
                  {m.id === group?.leaderId && (
                    <View style={styles.onlineLeaderBadge}>
                      <Text style={styles.onlineLeaderText}>{t("leader")}</Text>
                    </View>
                  )}
                </View>
              ))
            )}

            <View
              style={[styles.onlineDivider, { backgroundColor: theme.border }]}
            />

            {/* Desconectados */}
            {(() => {
              const onlineIds = onlineMembers.map((m) => m.id);
              const offline = members.filter((m) => !onlineIds.includes(m.id));
              return (
                <>
                  <Text style={styles.offlineSectionLabel}>
                    ⚫ {t("disconnected")} ({offline.length})
                  </Text>
                  {offline.length === 0 ? (
                    <Text style={styles.onlineEmpty}>{t("allConnected")}</Text>
                  ) : (
                    offline.map((m) => (
                      <View key={m.id} style={styles.onlineMemberRow}>
                        <View style={styles.offlineIndicator} />
                        <Text
                          style={[
                            styles.offlineMemberName,
                            { color: theme.textMuted },
                          ]}
                        >
                          {getMemberName(
                            m.id,
                            m.name || m.displayName || m.username,
                          )}
                        </Text>
                        {m.id === group?.leaderId && (
                          <View style={styles.onlineLeaderBadge}>
                            <Text style={styles.onlineLeaderText}>
                              {t("leader")}
                            </Text>
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
      <Modal
        visible={showExtraMenu && isSubscriber}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowExtraMenu(false)}
        accessibilityViewIsModal={true}
      >
        <TouchableOpacity
          style={styles.actionOverlay}
          activeOpacity={1}
          onPress={() => setShowExtraMenu(false)}
        >
          <View
            style={[
              styles.actionSheet,
              {
                backgroundColor: theme.card,
                paddingBottom: Math.max(16, insets.bottom),
              },
            ]}
          >
            <View
              style={[styles.actionHandle, { backgroundColor: theme.border }]}
            />
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                setShowExtraMenu(false);
                setShowPollModal(true);
              }}
            >
              <BarChart2 color="#6366F1" size={22} />
              <Text style={[styles.actionLabel, { color: theme.text }]}>
                {t("createPoll")}
              </Text>
            </TouchableOpacity>
            <View
              style={[styles.actionDivider, { backgroundColor: theme.border }]}
            />
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                setShowExtraMenu(false);
                setRouletteTitle("");
                setRouletteItems(["", ""]);
                setRouletteResult(null);
                setRouletteCurrent("");
                setShowRouletteModal(true);
              }}
            >
              <Shuffle color="#6366F1" size={22} />
              <Text style={[styles.actionLabel, { color: theme.text }]}>
                {t("rouletteTitle")}
              </Text>
            </TouchableOpacity>
            <View
              style={[styles.actionDivider, { backgroundColor: theme.border }]}
            />
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => setShowExtraMenu(false)}
            >
              <Text
                style={[styles.actionCancel, { color: theme.textSecondary }]}
              >
                {t("cancel")}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal encuesta */}
      <Modal
        visible={showPollModal && isSubscriber}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowPollModal(false)}
        accessibilityViewIsModal={true}
      >
        <View style={styles.editOverlay}>
          <View
            style={[
              styles.editCard,
              { backgroundColor: theme.card, maxHeight: "80%" },
            ]}
          >
            <View style={styles.modalTitleRow}>
              <BarChart2 color="#6366F1" size={18} />
              <Text style={[styles.editTitle, { color: theme.text }]}>
                {t("newPoll")}
              </Text>
              <TouchableOpacity onPress={() => setShowPollModal(false)}>
                <X color={theme.textMuted} size={20} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.editInput,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
              placeholder={t("pollQuestion")}
              placeholderTextColor={theme.textMuted}
              value={pollQuestion}
              onChangeText={setPollQuestion}
              maxLength={120}
            />
            {pollOptions.map((opt, i) => (
              <View key={i} style={styles.pollOptionRow}>
                <TextInput
                  style={[
                    styles.pollOptionInput,
                    {
                      backgroundColor: theme.input,
                      borderColor: theme.inputBorder,
                      color: theme.text,
                    },
                  ]}
                  placeholder={
                    i === 0 ? t("option1") : i === 1 ? t("option2") : `${i + 1}`
                  }
                  placeholderTextColor={theme.textMuted}
                  value={opt}
                  onChangeText={(t) => {
                    const arr = [...pollOptions];
                    arr[i] = t;
                    setPollOptions(arr);
                  }}
                  maxLength={80}
                />
                {pollOptions.length > 2 && (
                  <TouchableOpacity
                    onPress={() =>
                      setPollOptions(pollOptions.filter((_, j) => j !== i))
                    }
                    style={styles.pollRemoveBtn}
                  >
                    <X color="#EF4444" size={16} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {pollOptions.length < 6 && (
              <TouchableOpacity
                style={[styles.addOptionBtn, { borderColor: theme.border }]}
                onPress={() => setPollOptions([...pollOptions, ""])}
              >
                <Plus color="#6366F1" size={16} />
                <Text
                  style={{ color: "#6366F1", fontSize: 13, fontWeight: "600" }}
                >
                  {t("addOption")}
                </Text>
              </TouchableOpacity>
            )}
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[
                  styles.editBtn,
                  { backgroundColor: theme.dark ? "#374151" : "#F3F4F6" },
                ]}
                onPress={() => setShowPollModal(false)}
              >
                <Text style={[styles.editBtnCancel, { color: theme.text }]}>
                  {t("cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editBtn,
                  styles.editBtnSave,
                  (!pollQuestion.trim() ||
                    pollOptions.filter((o) => o.trim()).length < 2) && {
                    opacity: 0.5,
                  },
                ]}
                onPress={handleSendPoll}
                disabled={
                  !pollQuestion.trim() ||
                  pollOptions.filter((o) => o.trim()).length < 2
                }
              >
                <Text style={styles.editBtnSaveText}>{t("send")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal ruleta */}
      <Modal
        visible={showRouletteModal && isSubscriber}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (!rouletteSpinning) setShowRouletteModal(false);
        }}
        accessibilityViewIsModal={true}
      >
        <View style={styles.editOverlay}>
          <View
            style={[
              styles.editCard,
              { backgroundColor: theme.card, maxHeight: "90%" },
            ]}
          >
            {/* Header */}
            <View style={styles.modalTitleRow}>
              <Shuffle color="#6366F1" size={18} />
              <Text style={[styles.editTitle, { color: theme.text }]}>
                {t("rouletteTitle")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (!rouletteSpinning) setShowRouletteModal(false);
                }}
              >
                <X color={theme.textMuted} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 14, paddingBottom: 4 }}
            >
              {/* Título del sorteo */}
              <TextInput
                style={[
                  styles.editInput,
                  {
                    backgroundColor: theme.input,
                    borderColor: theme.inputBorder,
                    color: theme.text,
                  },
                ]}
                placeholder={t("rouletteTitle")}
                placeholderTextColor={theme.textMuted}
                value={rouletteTitle}
                onChangeText={setRouletteTitle}
                maxLength={80}
                editable={!rouletteSpinning}
              />

              {/* Chips de miembros */}
              {members.length > 0 && (
                <View style={styles.memberChipsSection}>
                  <Text
                    style={[
                      styles.memberChipsLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {t("addMembers")}
                  </Text>
                  <View style={styles.memberChipsRow}>
                    {members.map((m) => {
                      const selected = rouletteItems.includes(m.name);
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[
                            styles.memberChip,
                            {
                              backgroundColor: selected
                                ? "#6366F1"
                                : theme.dark
                                  ? "#374151"
                                  : "#F3F4F6",
                              borderColor: selected ? "#6366F1" : theme.border,
                            },
                          ]}
                          onPress={() =>
                            !rouletteSpinning && toggleMemberInRoulette(m.name)
                          }
                          disabled={rouletteSpinning}
                        >
                          <View
                            style={[
                              styles.memberChipAvatar,
                              {
                                backgroundColor: selected
                                  ? "#4338CA"
                                  : theme.dark
                                    ? "#4B5563"
                                    : "#E5E7EB",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.memberChipInitial,
                                {
                                  color: selected ? "#E0E7FF" : theme.textMuted,
                                },
                              ]}
                            >
                              {initialsFromDisplayName(m.name || "") || "?"}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.memberChipName,
                              { color: selected ? "#FFFFFF" : theme.text },
                            ]}
                            numberOfLines={1}
                          >
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
                <Text
                  style={[
                    styles.memberChipsLabel,
                    { color: theme.textSecondary },
                  ]}
                >
                  {t("rouletteOptions")}
                </Text>
                {rouletteItems.map((item, i) => (
                  <View key={i} style={styles.pollOptionRow}>
                    <TextInput
                      style={[
                        styles.pollOptionInput,
                        {
                          backgroundColor: theme.input,
                          borderColor: theme.inputBorder,
                          color: theme.text,
                        },
                      ]}
                      placeholder={
                        i === 0
                          ? t("element1")
                          : i === 1
                            ? t("element2")
                            : `${i + 1}`
                      }
                      placeholderTextColor={theme.textMuted}
                      value={item}
                      onChangeText={(t) => {
                        const arr = [...rouletteItems];
                        arr[i] = t;
                        setRouletteItems(arr);
                      }}
                      maxLength={60}
                      editable={!rouletteSpinning}
                    />
                    {rouletteItems.length > 2 && (
                      <TouchableOpacity
                        onPress={() =>
                          setRouletteItems(
                            rouletteItems.filter((_, j) => j !== i),
                          )
                        }
                        style={styles.pollRemoveBtn}
                        disabled={rouletteSpinning}
                      >
                        <X color="#EF4444" size={16} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {rouletteItems.length < 10 && (
                  <TouchableOpacity
                    style={[styles.addOptionBtn, { borderColor: theme.border }]}
                    onPress={() => setRouletteItems([...rouletteItems, ""])}
                    disabled={rouletteSpinning}
                  >
                    <Plus color="#6366F1" size={16} />
                    <Text
                      style={{
                        color: "#6366F1",
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      {t("addElement")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            {rouletteResult && (
              <View
                style={[
                  styles.rouletteWinnerBanner,
                  { backgroundColor: theme.dark ? "#312E81" : "#EDE9FE" },
                ]}
              >
                <Text
                  style={[
                    styles.rouletteWinnerBannerLabel,
                    { color: theme.dark ? "#A5B4FC" : "#6D28D9" },
                  ]}
                >
                  🏆 {t("winner")}
                </Text>
                <Text
                  style={[
                    styles.rouletteWinnerBannerName,
                    { color: theme.dark ? "#E0E7FF" : "#4C1D95" },
                  ]}
                  numberOfLines={1}
                >
                  {rouletteResult}
                </Text>
              </View>
            )}

            <View style={[styles.editActions, { marginTop: 8 }]}>
              {rouletteResult ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.editBtn,
                      { backgroundColor: theme.dark ? "#374151" : "#F3F4F6" },
                    ]}
                    onPress={() => {
                      setRouletteResult(null);
                      setRouletteCurrent("");
                    }}
                  >
                    <Text style={[styles.editBtnCancel, { color: theme.text }]}>
                      {t("spinAgain")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editBtn, styles.editBtnSave]}
                    onPress={handleSendRouletteResult}
                  >
                    <Text style={styles.editBtnSaveText}>
                      {t("sendToChat")}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.editBtn,
                    styles.editBtnSave,
                    { flex: 1 },
                    (rouletteSpinning ||
                      rouletteItems.filter((i) => i.trim()).length < 2) && {
                      opacity: 0.5,
                    },
                  ]}
                  onPress={handleSpin}
                  disabled={
                    rouletteSpinning ||
                    rouletteItems.filter((i) => i.trim()).length < 2
                  }
                >
                  <Text style={styles.editBtnSaveText}>
                    {rouletteSpinning ? t("spinning") : "🎡 Girar"}
                  </Text>
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
  messageWrapperHighlighted: {
    backgroundColor: "rgba(251,191,36,0.2)",
    borderRadius: 18,
    paddingHorizontal: 6,
    marginHorizontal: -6,
  },
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
  mention: { color: "#4F46E5", fontWeight: "700" },
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
  // @mention suggestions
  mentionList: {
    borderTopWidth: 1,
    maxHeight: 180,
    overflow: "hidden",
  },
  mentionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mentionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  mentionAvatarText: { fontSize: 13, fontWeight: "700", color: "#4F46E5" },
  mentionName: { flex: 1, fontSize: 14, fontWeight: "600" },
  mentionLeader: {
    fontSize: 11,
    color: "#4F46E5",
    fontWeight: "700",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  // Reply quote inside bubble
  replyQuote: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },
  replyQuoteAuthor: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  replyQuoteText: {
    fontSize: 12,
  },
  // Reply bar above input
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderLeftWidth: 3,
  },
  replyBarAuthor: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 1,
  },
  replyBarText: {
    fontSize: 12,
  },
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
