import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../firebaseConfig';
import {
  filterConversations,
  groupIntoConversations,
  subscribeToUserChatHistory,
} from '../services/chatbotService';
import { useLanguage } from '../contexts/LanguageContext';
import { useThemedStyles } from '../hooks/use-themed-styles';

export default function ChatHistoryScreen() {
  const { language, t } = useLanguage();
  const styles = useThemedStyles(baseStyles);
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [searchText, setSearchText] = useState('');

  const currentUser = auth.currentUser;

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
        Alert.alert(t('error'), t('unableLoadChat'));
        setLoadingHistory(false);
      }
    );

    return unsubscribe;
  }, [currentUser, t]);

  const conversations = useMemo(
    () => groupIntoConversations(chatHistory),
    [chatHistory]
  );

  const visibleConversations = useMemo(
    () => filterConversations(conversations, searchText),
    [conversations, searchText]
  );

  const isSearching = searchText.trim().length > 0;

  const formatPreviewTime = (chatTime) => {
    if (!chatTime?.seconds) {
      return t('justNow');
    }

    return new Date(chatTime.seconds * 1000).toLocaleString(
      language === 'zh' ? 'zh-CN' : language === 'ms' ? 'ms-MY' : 'en-MY');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t('back')}</Text>
          </Pressable>
        </View>

        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('chatHistory')}</Text>
          {!loadingHistory && conversations.length > 0 ? (
            <Text style={styles.countText}>
              {isSearching
                ? `${visibleConversations.length}/${conversations.length}`
                : t('chatCount', { count: conversations.length })}
            </Text>
          ) : null}
        </View>

        {!currentUser ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t('noUser')}</Text>
          </View>
        ) : loadingHistory ? (
          <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
        ) : (
          <>
            {conversations.length > 0 ? (
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('searchChats')}
                  placeholderTextColor="#94a3b8"
                  value={searchText}
                  onChangeText={setSearchText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />

                {isSearching ? (
                  <Pressable
                    style={styles.clearButton}
                    onPress={() => setSearchText('')}
                  >
                    <Text style={styles.clearButtonText}>{t('clear')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <ScrollView
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {conversations.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    {t('noChatHistory')}
                  </Text>
                </View>
              ) : visibleConversations.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    {t('chatsMatch', { query: searchText.trim() })}
                  </Text>
                </View>
              ) : (
                visibleConversations.map((conversation) => {
                  const lastItem =
                    conversation.items[conversation.items.length - 1];

                  return (
                    <Pressable
                      key={conversation.id}
                      style={styles.historyCard}
                      onPress={() =>
                        router.push(
                          `/chat?sessionId=${encodeURIComponent(conversation.id)}`
                        )
                      }
                    >
                      <Text style={styles.historyTitle} numberOfLines={1}>
                        {conversation.title}
                      </Text>
                      <Text style={styles.historyPreview} numberOfLines={2}>
                        {lastItem?.chat_response || t('noChatResponse')}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {conversation.items.length} {t('questions')} •{' '}
                        {formatPreviewTime(lastItem?.chat_time)}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
  },
  countText: {
    fontSize: 13,
    color: '#64748b',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  clearButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  clearButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 36,
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
  loader: {
    marginTop: 24,
  },
});
