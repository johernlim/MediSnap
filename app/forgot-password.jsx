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
import {
    checkEmailRegistered,
    sendResetEmailAndLog,
} from '../services/passwordResetService';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const isValidEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const handleSendResetEmail = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      Alert.alert('Validation Error', 'Please enter your email address.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    setSending(true);

    try {
      const registeredUser = await checkEmailRegistered(trimmedEmail);

      if (!registeredUser.exists) {
        Alert.alert(
          'Email Not Found',
          'Please enter a registered email or Please signup first.'
        );
        return;
      }

      await sendResetEmailAndLog(trimmedEmail);

      setEmail('');

      Alert.alert(
        'Reset Email Sent',
        'A password reset email has been sent to your registered email address.',
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
