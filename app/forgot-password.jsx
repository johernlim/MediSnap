import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { validateEmail } from '../services/emailValidator';
import { sendResetEmailAndLog } from '../services/passwordResetService';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendResetEmail = () => {
    const result = validateEmail(email);

    if (!result.valid) {
      Alert.alert('Validation Error', result.message);
      return;
    }

    // Format is fine, but the domain looks like a typo of a common provider
    // (gmail.cm, gmail.co, gmial.com...). Confirm before sending, because a
    // reset email delivered to the wrong address is lost silently.
    if (result.suggestion) {
      Alert.alert(
        'Check Your Email Address',
        `You entered ${result.email}. Did you mean ${result.suggestion}?\n\n` +
          'If the address is wrong, the password reset email will never reach you.',
        [
          { text: 'Edit', style: 'cancel' },
          {
            text: `Use ${result.suggestion}`,
            onPress: () => {
              setEmail(result.suggestion);
              sendResetEmail(result.suggestion);
            },
          },
          {
            text: 'Use mine anyway',
            style: 'destructive',
            onPress: () => sendResetEmail(result.email),
          },
        ]
      );
      return;
    }

    sendResetEmail(result.email);
  };

  const sendResetEmail = async (trimmedEmail) => {
    setSending(true);

    try {
      // Deliberately no "is this email registered?" check before sending.
      // Answering that question lets anyone test addresses against the user
      // database one at a time, which is why the response below is identical
      // whether or not the account exists.
      await sendResetEmailAndLog(trimmedEmail);

      setEmail('');

      Alert.alert(
        'Check Your Email',
        `If ${trimmedEmail} is registered with MediSnap, a password reset link is on its way.\n\n` +
          'If nothing arrives within a few minutes, check your spam folder or sign up first.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/'),
          },
        ]
      );
    } catch (error) {
      console.error('Password reset failed:', error);
      Alert.alert(
        'Reset Failed',
        error?.message || 'Unable to send password reset email right now.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter your registered email address and we will send a password reset email.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable
          style={[styles.primaryButton, sending && styles.disabledButton]}
          onPress={handleSendResetEmail}
          disabled={sending}
        >
          <Text style={styles.primaryButtonText}>
            {sending ? 'Sending...' : 'Send Reset Email'}
          </Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Back to Login</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
});
