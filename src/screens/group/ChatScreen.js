// ============================================
// CHAT SCREEN - StudySync
// Migración de líneas 885-993 del frontend React
// Chat en tiempo real con Firestore onSnapshot
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import {
  ChevronLeft,
  Send,
  Star,
  Users,
  Paperclip,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import * as firestoreService from '../../services/firestoreService';
import { formatTime } from '../../utils/dateUtils';

export default function ChatScreen({ route, navigation }) {
  const { groupId } = route.params;
  const { user, userProfile } = useAuth();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    // Cargar datos del grupo
    const loadGroup = async () => {
      try {
        const groupData = await firestoreService.getGroup(groupId);
        if (cancelled) return;
        setGroup(groupData);
        if (groupData?.members) {
          const memberData = await firestoreService.getUsersByIds(groupData.members);
          if (cancelled) return;
          setMembers(memberData);
        }
      } catch (e) {
        console.error('Error cargando grupo:', e);
      }
    };
    loadGroup();

    // Escuchar mensajes en tiempo real
    const unsubMessages = firestoreService.getGroupMessages(groupId, (fetchedMessages) => {
      if (cancelled) return;
      setMessages(fetchedMessages);
    });

    // Marcar mensajes como leídos
    if (user?.uid) {
      firestoreService.markMessagesAsRead(groupId, user.uid).catch((e) =>
        console.error('Error marcando mensajes como leídos:', e)
      );
    }

    return () => {
      cancelled = true;
      unsubMessages();
    };
  }, [groupId, user]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const messageData = {
      groupId: groupId,
      authorId: user.uid,
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      important: false,
    };

    setInputText('');
    await firestoreService.sendMessage(messageData);
  };

  const handleToggleImportant = async (msgId, currentValue) => {
    await firestoreService.toggleMessageImportant(msgId, currentValue);
  };

  const getMemberName = (authorId) => {
    const member = members.find(m => m.id === authorId);
    return member?.name || 'Usuario';
  };

  const isLeaderMember = (authorId) => {
    return group?.leaderId === authorId;
  };

  /**
   * Renderizar texto del mensaje con @menciones resaltadas
   */
  const renderMessageText = (text, isMe) => {
    const parts = text.split(/(@\w+)/g);
    return (
      <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
        {parts.map((part, index) =>
          part.startsWith('@') ? (
            <Text key={index} style={styles.mention}>{part}</Text>
          ) : (
            <Text key={index}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  const renderMessage = ({ item: msg }) => {
    const isMe = msg.authorId === user.uid;
    const authorName = getMemberName(msg.authorId);
    const isLeader = isLeaderMember(msg.authorId);

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperOther]}>
        {!isMe && (
          <Text style={styles.authorName}>
            {authorName} {isLeader ? '(Líder)' : ''}
          </Text>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <View style={styles.messageContent}>
            <View style={styles.messageTextContainer}>
              {renderMessageText(msg.text, isMe)}
            </View>
            <TouchableOpacity
              onPress={() => handleToggleImportant(msg.id, msg.important)}
              style={styles.starButton}
            >
              <Star
                color={msg.important ? '#FACC15' : (isMe ? 'rgba(165,180,252,0.5)' : '#D1D5DB')}
                size={16}
                fill={msg.important ? '#FACC15' : 'none'}
              />
            </TouchableOpacity>
          </View>
          <Text style={[styles.messageTime, isMe ? styles.messageTimeMe : styles.messageTimeOther]}>
            {msg.time || formatTime(msg.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  if (!group) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando chat...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ChevronLeft color="#FFFFFF" size={24} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Chat - {group.name}</Text>
            <Text style={styles.headerSubtitle}>Solo temas académicos</Text>
          </View>
        </View>
        <Users color="#C7D2FE" size={20} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={
          <View style={styles.reminderBanner}>
            <Text style={styles.reminderText}>
              💡 Recordatorio: Este chat es exclusivo para coordinar el trabajo de <Text style={styles.reminderBold}>{group.name}</Text>.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatText}>No hay mensajes aún. ¡Sé el primero en escribir!</Text>
          </View>
        }
      />

      {/* Input */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.attachButton}>
          <Paperclip color="#9CA3AF" size={20} />
        </TouchableOpacity>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleSend}
            style={styles.sendButton}
            disabled={!inputText.trim()}
          >
            <Send
              color={inputText.trim() ? '#4F46E5' : '#9CA3AF'}
              size={20}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#C7D2FE',
    marginTop: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  reminderBanner: {
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    marginHorizontal: 8,
  },
  reminderText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },
  reminderBold: {
    fontWeight: '700',
  },
  // Messages
  messageWrapper: {
    maxWidth: '85%',
    marginBottom: 12,
  },
  messageWrapperMe: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageWrapperOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  authorName: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleMe: {
    backgroundColor: '#4F46E5',
    borderTopRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  messageContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  messageTextContainer: {
    flex: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1F2937',
  },
  messageTextMe: {
    color: '#FFFFFF',
  },
  mention: {
    color: '#818CF8',
    fontWeight: '700',
  },
  starButton: {
    paddingTop: 2,
  },
  messageTime: {
    fontSize: 10,
    textAlign: 'right',
    marginTop: 4,
  },
  messageTimeMe: {
    color: '#C7D2FE',
  },
  messageTimeOther: {
    color: '#9CA3AF',
  },
  emptyChat: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyChatText: {
    color: '#6B7280',
    fontSize: 14,
  },
  // Input Bar
  inputBar: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachButton: {
    padding: 8,
    marginBottom: 4,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    maxHeight: 100,
  },
  sendButton: {
    padding: 10,
  },
});
