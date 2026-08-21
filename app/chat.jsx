import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChatInputBox from '../components/ChatInputBox';
import ChatMessageBubble from '../components/ChatMessageBubble';
import { auth } from '../firebaseConfig';
import {
  createConversationTitle,
  generateChatbotReply,
  saveExchange,
  subscribeToSession,
  toMessages,
} from '../services/chatbotService';

/**
 * One screen for every conversation, new or saved.
 *
 * A "new chat" is simply a session id with no rows behind it yet, so opening
 * an old conversation and starting a fresh one run through identical code.
 * This replaces the previous split between a live chat screen and a read-only
 * chat-session screen.
 */
export default function ChatScreen() {
  const params = useLocalSearchParams();

  const sessionIdRef = useRef(
    typeof params.sessionId === 'string' && params.sessionId
      ? params.sessionId
      : `chat-${Date.now()}`
  );

  // Saved exchanges. Firestore is the single source of truth for these, so a
  // message can never be shown twice from two different places.
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // The question currently in flight. It has no saved row yet, so it is held
  // here and rendered on top of the saved list until Firestore catches up.
  const [pending, setPending] = useState(null);

  const [localTitle, setLocalTitle] = useState('');
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const scrollRef = useRef(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = subscribeToSession(
      currentUser.uid,
      sessionIdRef.current,
      (sessionItems) => {
        setItems(sessionItems);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to load conversation:', error);
        Alert.alert('Error', 'Unable to load this conversation right now.');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  // Hand the in-flight question over to its saved row only once that row has
  // actually arrived. Clearing it any earlier makes the message vanish for a
  // frame and reappear; the row count is used rather than the text so that
  // asking the same question twice still behaves.
  useEffect(() => {
    if (pending && items.length > pending.baselineCount) {
      setPending(null);
    }
  }, [items, pending]);

  const savedMessages = useMemo(() => toMessages(items), [items]);

  const messages = useMemo(() => {
    if (!pending) return savedMessages;

    return [
      ...savedMessages,
      { id: 'pending-user', sender: 'user', text: pending.question },
    ];
  }, [savedMessages, pending]);

  const title = useMemo(() => {
    const saved = items.find((item) => item.session_title);
    return saved?.session_title || localTitle || 'New Chat';
  }, [items, localTitle]);

  const handleSend = async () => {
    const trimmedQuestion = inputText.trim();

    if (!currentUser) {
      Alert.alert('Login required', 'Please log in to use the chatbot.');
      return;
    }

    if (!trimmedQuestion) {
      Alert.alert('Empty message', 'Please enter a medicine-related question.');
      return;
    }

    const historyForModel = messages;
    const savedTitle = items.find((item) => item.session_title)?.session_title;
    const conversationTitle =
      savedTitle || localTitle || createConversationTitle(trimmedQuestion);

    if (!savedTitle && !localTitle) {
      setLocalTitle(conversationTitle);
    }

    setPending({ question: trimmedQuestion, baselineCount: items.length });
    setInputText('');
    setSending(true);

    try {
      const reply = await generateChatbotReply(trimmedQuestion, historyForModel);

      await saveExchange({
        userId: currentUser.uid,
        sessionId: sessionIdRef.current,
        sessionTitle: conversationTitle,
        question: trimmedQuestion,
        reply,
      });
    } catch (error) {
      console.error('Failed to get chatbot response:', error);

      // Give the question back rather than losing what they typed.
      setPending(null);
      setInputText(trimmedQuestion);
      Alert.alert('Error', 'Unable to get chatbot response right now.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          <Text style={styles.disclaimer}>
            AI-generated information. Not medical advice — confirm with a doctor
            or pharmacist before changing any medication.
          </Text>

          {loading ? (
            <ActivityIndicator
              size="large"
              color="#2563eb"
              style={styles.loader}
            />
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.chatArea}
              contentContainerStyle={styles.chatContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({ animated: true })
              }
            >
              {messages.map((message) => (
                <ChatMessageBubble key={message.id} message={message} />
              ))}
            </ScrollView>
          )}

          <View style={styles.inputCard}>
            {sending ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.loadingText}>
                  Generating chatbot response...
                </Text>
              </View>
            ) : null}

            <ChatInputBox
              value={inputText}
              onChangeText={setInputText}
              onSend={handleSend}
              disabled={sending}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 0,
  },
  topBar: {
    marginTop: 6,
    marginBottom: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    color: '#9a3412',
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    paddingBottom: 16,
  },
  inputCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingText: {
    marginLeft: 10,
    color: '#334155',
    fontSize: 14,
  },
  loader: {
    flex: 1,
    marginTop: 24,
  },
});
