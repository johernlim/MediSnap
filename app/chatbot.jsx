import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../firebaseConfig';
import {
  groupIntoConversations,
  subscribeToUserChatHistory,
} from '../services/chatbotService';

export default function ChatbotScreen() {
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const currentUser = auth.currentUser;

  // Only used for the count on the history button. The list itself lives on
  // its own screen now.
  useEffect(() => {
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
        setLoadingHistory(false);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  const conversationCount = useMemo(
    () => groupIntoConversations(chatHistory).length,
    [chatHistory]
  );

  const historySubtitle = () => {
    if (loadingHistory) return 'Loading...';
    if (conversationCount === 0) return 'No saved chats yet';
    if (conversationCount === 1) return '1 saved chat';
    return `${conversationCount} saved chats`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Medicine Chatbot</Text>

        <Text style={styles.subtitle}>
          Ask about dosages, side effects, storage or interactions.
        </Text>

        <Text style={styles.disclaimer}>
          AI-generated information. Not medical advice — confirm with a doctor or
          pharmacist before changing any medication.
        </Text>

        {!currentUser ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No authenticated user found.</Text>
          </View>
        ) : (
          <View style={styles.actions}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push(`/chat?sessionId=chat-${Date.now()}`)}
            >
              <Text style={styles.primaryButtonText}>Start New Chat</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push('/chat-history')}
            >
              <Text style={styles.secondaryButtonText}>Chat History</Text>
              <Text style={styles.secondaryButtonHint}>{historySubtitle()}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 21,
    marginBottom: 16,
  },
  disclaimer: {
    fontSize: 13,
    lineHeight: 19,
    color: '#9a3412',
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 24,
  },
  actions: {
    gap: 14,
  },
  // minHeight rather than tuned padding, so the two buttons stay the same size
  // even though only one of them carries a second line.
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    minHeight: 82,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    minHeight: 82,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButtonHint: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
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
    fontSize: 15,
    lineHeight: 22,
  },
});
