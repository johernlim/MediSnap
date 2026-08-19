import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function ChatInputBox({ value, onChangeText, onSend, disabled }) {
  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder="Ask a medicine-related question..."
        placeholderTextColor="#6b7280"
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        multiline
      />

      <Pressable
        style={[styles.sendButton, disabled && styles.sendButtonDisabled]}
        onPress={onSend}
        disabled={disabled}
      >
        <Text style={styles.sendButtonText}>{disabled ? 'Sending...' : 'Send'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 56,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});