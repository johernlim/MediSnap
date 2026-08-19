import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
  saveConversationHistory,
  subscribeToUserChatHistory,
} from '../services/chatbotService';

export default function ChatbotScreen() {
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [draftMessages, setDraftMessages] = useState([]);
  const [draftSessionId, setDraftSessionId] = useState(null);
  const [draftSessionTitle, setDraftSessionTitle] = useState('');
  const [inputText, setInputText] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [finishingChat, setFinishingChat] = useState(false);

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setLoadingHistory(false);
      return undefined;
    }

    const unsubscribe = subscribeToUserChatHistory(
      currentUser.uid,
      (items) => {
        setChatHistory(items);
        setLoadingHistory(false);
      },
      (error) => {
        console.error('Failed to load chat history:', error);
        Alert.alert('Error', 'Unable to load chat history right now.');
        setLoadingHistory(false);
      }
    );

    return unsubscribe;
  }, []);

  const currentUser = auth.currentUser;

  const conversationList = Object.values(
    chatHistory.reduce((accumulator, item) => {
      const conversationId = item.session_id || item.id;

      if (!accumulator[conversationId]) {
        accumulator[conversationId] = {
          id: conversationId,
          title: item.session_title || createConversationTitle(item.user_question),
          items: [],
          latestTime: item.chat_time?.seconds || 0,
        };
      }

      accumulator[conversationId].items.push(item);
      accumulator[conversationId].latestTime = Math.max(
        accumulator[conversationId].latestTime,
        item.chat_time?.seconds || 0
      );

      return accumulator;
    }, {})
  ).sort((a, b) => b.latestTime - a.latestTime);

  const selectedConversationData = conversationList.find(
    (conversation) => conversation.id === selectedConversation
  );

  const selectedMessages = selectedConversationData
    ? selectedConversationData.items.flatMap((item) => [
        {
          id: `${item.id}-user`,
          sender: 'user',
          text: item.user_question,
        },
        {
          id: `${item.id}-bot`,
          sender: 'bot',
          text: item.chat_response,
        },
      ])
    : [];

  const startNewChat = () => {
    setDraftSessionId(`chat-${Date.now()}`);
    setDraftSessionTitle('');
    setDraftMessages([]);
    setInputText('');
    setSelectedConversation('draft');
  };

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

    if (!draftSessionId) {
      setDraftSessionId(`chat-${Date.now()}`);
    }

    setSending(true);

    try {
      const reply = await generateChatbotReply(trimmedQuestion, draftMessages);

      const userMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: trimmedQuestion,
      };

      const botMessage = {
        id: `bot-${Date.now()}-${Math.random()}`,
        sender: 'bot',
        text: reply,
      };

      setDraftMessages((prev) => [...prev, userMessage, botMessage]);

      if (!draftSessionTitle) {
        setDraftSessionTitle(createConversationTitle(trimmedQuestion));
      }

      setSelectedConversation('draft');
      setInputText('');
    } catch (error) {
      console.error('Failed to get chatbot response:', error);
      Alert.alert('Error', 'Unable to get chatbot response right now.');
    } finally {
      setSending(false);
    }
  };

  const handleFinishChat = async () => {
    if (!currentUser) {
      Alert.alert('Login required', 'Please log in to use the chatbot.');
      return;
    }

    if (draftMessages.length === 0) {
      Alert.alert('No Chat Yet', 'Please ask at least one question before finishing the chat.');
      return;
    }

    setFinishingChat(true);

    try {
      await saveConversationHistory({
        userId: currentUser.uid,
        sessionId: draftSessionId || `chat-${Date.now()}`,
        sessionTitle: draftSessionTitle || 'New Chat',
        messages: draftMessages,
      });

      setDraftMessages([]);
      setDraftSessionId(null);
      setDraftSessionTitle('');
      setInputText('');
      setSelectedConversation(null);

      Alert.alert('Saved', 'Chat conversation saved successfully.');
    } catch (error) {
      console.error('Failed to save chat history:', error);
      Alert.alert('Error', 'Unable to save chat history right now.');
    } finally {
      setFinishingChat(false);
    }
  };

  const handleBackFromDraft = () => {
    if (draftMessages.length === 0) {
      setDraftMessages([]);
      setDraftSessionId(null);
      setDraftSessionTitle('');
      setInputText('');
      setSelectedConversation(null);
      return;
    }

    Alert.alert(
      'Leave Chat',
      'This conversation has not been saved yet. Do you want to discard it?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setDraftMessages([]);
            setDraftSessionId(null);
            setDraftSessionTitle('');
            setInputText('');
            setSelectedConversation(null);
          },
        },
      ]
    );
  };

  const formatPreviewTime = (chatTime) => {
    if (!chatTime?.seconds) {
      return 'Just now';
    }

    return new Date(chatTime.seconds * 1000).toLocaleString();
  };

  const isViewingDraft = selectedConversation === 'draft';

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

          <Text style={styles.title}>Medicine Chatbot</Text>
          <Text style={styles.subtitle}>
            Ask general medicine-related questions and keep your conversations in one place.
          </Text>

          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerTitle}>AI-generated information</Text>
            <Text style={styles.disclaimerText}>
              Responses may be incorrect and are not medical advice. Do not start, stop, or
              change medication based only on this chatbot. Confirm medication decisions with
              a doctor or pharmacist. For severe symptoms or an emergency, seek urgent medical
              help.
            </Text>
          </View>

          {!currentUser ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No authenticated user found.</Text>
            </View>
          ) : loadingHistory ? (
            <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
          ) : selectedConversation ? (
            <>
              <View style={styles.conversationHeader}>
                <Pressable
                  style={styles.historyBackButton}
                  onPress={isViewingDraft ? handleBackFromDraft : () => setSelectedConversation(null)}
                >
                  <Text style={styles.historyBackText}>← Back to Ask Form</Text>
                </Pressable>

                <Text style={styles.sectionTitle}>
                  {isViewingDraft
                    ? draftSessionTitle || 'Current Conversation'
                    : selectedConversationData?.title || 'Conversation'}
                </Text>
              </View>

              <ScrollView
                style={styles.chatArea}
                contentContainerStyle={styles.chatContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {(isViewingDraft ? draftMessages : selectedMessages).map((message) => (
                  <ChatMessageBubble key={message.id} message={message} />
                ))}
              </ScrollView>

              {isViewingDraft ? (
                <View style={styles.inlineFormCard}>
                  {sending ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#2563eb" />
                      <Text style={styles.loadingText}>Generating chatbot response...</Text>
                    </View>
                  ) : null}

                  <ChatInputBox
                    value={inputText}
                    onChangeText={setInputText}
                    onSend={handleSend}
                    disabled={sending || finishingChat}
                  />

                  <Pressable
                    style={[styles.finishButton, finishingChat && styles.finishButtonDisabled]}
                    onPress={handleFinishChat}
                    disabled={finishingChat || sending}
                  >
                    <Text style={styles.finishButtonText}>
                      {finishingChat ? 'Saving...' : 'Finish Chat'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : (
            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Ask a Question</Text>
                <Text style={styles.formSubtitle}>
                  Start a new medicine-related conversation here.
                </Text>

                <Pressable style={styles.startButton} onPress={startNewChat}>
                  <Text style={styles.startButtonText}>Start New Chat</Text>
                </Pressable>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Chat History</Text>
                <Text style={styles.countText}>{conversationList.length} item(s)</Text>
              </View>

              {conversationList.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    No chat history yet. Start by asking your first medicine-related question.
                  </Text>
                </View>
              ) : (
                conversationList.map((conversation) => {
                  const lastItem = conversation.items[conversation.items.length - 1];

                  return (
                    <Pressable
                      key={conversation.id}
                      style={styles.historyCard}
                      onPress={() => setSelectedConversation(conversation.id)}
                    >
                      <Text style={styles.historyTitle}>{conversation.title}</Text>
                      <Text style={styles.historyPreview}>
                        {lastItem?.chat_response || 'No chatbot response available.'}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {conversation.items.length} interaction(s) •{' '}
                        {formatPreviewTime(lastItem?.chat_time)}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          )}
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
  content: {
    paddingBottom: 36,
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
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 14,
    lineHeight: 23,
  },
  disclaimerBox: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
  },
  disclaimerTitle: {
    color: '#9a3412',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  disclaimerText: {
    color: '#7c2d12',
    fontSize: 13,
    lineHeight: 19,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 14,
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  inlineFormCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  finishButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  finishButtonDisabled: {
    opacity: 0.7,
  },
  finishButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  countText: {
    fontSize: 14,
    color: '#64748b',
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  historyPreview: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 10,
  },
  historyMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  conversationHeader: {
    marginBottom: 10,
  },
  historyBackButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  historyBackText: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '600',
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    paddingBottom: 20,
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
    marginTop: 24,
  },
  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
    lineHeight: 22,
  },
});
