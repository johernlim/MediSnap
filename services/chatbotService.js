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

export async function saveConversationHistory({
  userId,
  sessionId,
  sessionTitle,
  messages,
}) {
  const questionAnswerPairs = [];
  let currentQuestion = null;

  messages.forEach((message) => {
    if (message.sender === 'user') {
      currentQuestion = message.text;
      return;
    }

    if (message.sender === 'bot' && currentQuestion) {
      questionAnswerPairs.push({
        user_question: currentQuestion,
        chat_response: message.text,
      });
      currentQuestion = null;
    }
  });

  for (const pair of questionAnswerPairs) {
    await addDoc(chatHistoryCollection, {
      user_id: userId,
      user_question: pair.user_question,
      chat_response: pair.chat_response,
      session_id: sessionId,
      session_title: sessionTitle,
      chat_time: serverTimestamp(),
    });
  }
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
