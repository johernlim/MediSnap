import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

const chatHistoryCollection = collection(db, 'chat_history');

export function createConversationTitle(question) {
  const trimmedQuestion = String(question || '').trim();

  if (!trimmedQuestion) {
    return 'New Chat';
  }

  if (trimmedQuestion.length <= 40) {
    return trimmedQuestion;
  }

  return `${trimmedQuestion.slice(0, 40)}...`;
}

export async function generateChatbotReply(userQuestion, conversationMessages = []) {
  const apiBaseUrl = process.env.EXPO_PUBLIC_MEDISNAP_API_URL?.replace(/\/$/, '');

  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_MEDISNAP_API_URL is not configured.');
  }

  const response = await fetch(`${apiBaseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: userQuestion,
      history: conversationMessages,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Unable to generate a chatbot response.');
  }

  if (!result.reply) {
    throw new Error('The chatbot returned an empty response.');
  }

  return result.reply;
}

/**
 * Writes one question-and-answer pair as soon as the reply arrives.
 *
 * This replaces the old save-everything-on-Finish-Chat approach. Saving was
 * previously opt-in via a button at the end of a conversation, so anything the
 * user walked away from was lost.
 */
export async function saveExchange({
  userId,
  sessionId,
  sessionTitle,
  question,
  reply,
}) {
  await addDoc(chatHistoryCollection, {
    user_id: userId,
    user_question: question,
    chat_response: reply,
    session_id: sessionId,
    session_title: sessionTitle,
    chat_time: serverTimestamp(),
  });
}

/**
 * Rolls the flat chat_history rows up into conversations.
 *
 * Each row is one exchange; a conversation is every row sharing a session_id.
 */
export function groupIntoConversations(chatItems) {
  const grouped = {};

  for (const item of chatItems || []) {
    const conversationId = item.session_id || item.id;

    if (!grouped[conversationId]) {
      grouped[conversationId] = {
        id: conversationId,
        title: item.session_title || createConversationTitle(item.user_question),
        items: [],
        latestTime: 0,
      };
    }

    grouped[conversationId].items.push(item);
    grouped[conversationId].latestTime = Math.max(
      grouped[conversationId].latestTime,
      item.chat_time?.seconds || 0
    );
  }

  return Object.values(grouped).sort((a, b) => b.latestTime - a.latestTime);
}

/**
 * Keyword search across the user's own conversations.
 *
 * Filtering happens on the device rather than in Firestore, because Firestore
 * has no substring or full-text operator — it can match a whole field value,
 * not a word inside one. The user's own history is small enough that this is
 * the pragmatic approach.
 */
export function filterConversations(conversations, searchText) {
  const needle = String(searchText || '').trim().toLowerCase();

  if (!needle) {
    return conversations;
  }

  return conversations.filter((conversation) => {
    if (conversation.title.toLowerCase().includes(needle)) {
      return true;
    }

    return conversation.items.some(
      (item) =>
        String(item.user_question || '').toLowerCase().includes(needle) ||
        String(item.chat_response || '').toLowerCase().includes(needle)
    );
  });
}

/** Turns the stored exchanges of one conversation into renderable messages. */
export function toMessages(items) {
  return [...(items || [])]
    .sort((a, b) => (a.chat_time?.seconds || 0) - (b.chat_time?.seconds || 0))
    .flatMap((item) => [
      { id: `${item.id}-user`, sender: 'user', text: item.user_question },
      { id: `${item.id}-bot`, sender: 'bot', text: item.chat_response },
    ]);
}

export function subscribeToUserChatHistory(userId, onSuccess, onError) {
  const chatQuery = query(chatHistoryCollection, where('user_id', '==', userId));

  return onSnapshot(
    chatQuery,
    (snapshot) => {
      const chatItems = snapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data(),
        }))
        .sort((a, b) => {
          const aSeconds = a.chat_time?.seconds || 0;
          const bSeconds = b.chat_time?.seconds || 0;
          return aSeconds - bSeconds;
        });

      onSuccess(chatItems);
    },
    onError
  );
}

/**
 * Live view of a single conversation.
 *
 * Both filters are equality checks, which Firestore serves without a composite
 * index. Ordering is done on the device for the same reason — adding orderBy
 * here would require creating an index in the console.
 */
export function subscribeToSession(userId, sessionId, onSuccess, onError) {
  const sessionQuery = query(
    chatHistoryCollection,
    where('user_id', '==', userId),
    where('session_id', '==', sessionId)
  );

  return onSnapshot(
    sessionQuery,
    (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      onSuccess(items);
    },
    onError
  );
}
