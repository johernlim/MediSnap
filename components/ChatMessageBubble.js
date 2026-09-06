import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../hooks/use-themed-styles';

export default function ChatMessageBubble({ message }) {
  const styles = useThemedStyles(baseStyles);
  const isUser = message.sender === 'user';

  return (
    <View style={[styles.wrapper, isUser ? styles.userWrapper : styles.botWrapper]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
        <Text style={[styles.senderText, isUser ? styles.userSender : styles.botSender]}>
          {isUser ? 'You' : 'MediSnap Bot'}
        </Text>
        <Text style={[styles.messageText, isUser ? styles.userMessage : styles.botMessage]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  botWrapper: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  userBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 6,
  },
  botBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#dbe4f0',
  },
  senderText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  userSender: {
    color: '#dbeafe',
  },
  botSender: {
    color: '#2563eb',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMessage: {
    color: '#ffffff',
  },
  botMessage: {
    color: '#0f172a',
  },
});
